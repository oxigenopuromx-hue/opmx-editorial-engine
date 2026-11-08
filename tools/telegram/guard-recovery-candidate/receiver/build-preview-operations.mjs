// Candidate operations for the existing receiver. They are data only: this
// module neither calls n8n nor enables the graph. Apply only together with the
// guard, Motor and all publication fences after independent verification.
const guard='https://publisher.oxigenopuro.com.mx/v1/telegram/';
const names={branch:'¿Solicitar vista de recuperación?',preview:'Solicitar vista de recuperación',identity:'Preparar identidad de vista',identityIf:'¿Identidad de vista acreditada?',init:'Inicializar entrega de vista',next:'Preparar siguiente parte de vista',nextIf:'¿Reclamar siguiente parte?',claim:'Reclamar parte de vista',send:'Preparar envío de vista',sendIf:'¿Enviar parte de vista?',completeIf:'¿Vista completamente entregada?',telegram:'Enviar parte de vista',ack:'Preparar acuse de vista',ackIf:'¿Acuse de vista acreditado?',report:'Registrar acuse de vista',fail:'Informar vista no confirmada'};
export function buildPreviewOperations({scripts,guardCredential,telegramCredential}){
 for(const k of ['identity','next','send','ack'])if(typeof scripts?.[k]!=='string'||!scripts[k].trim())throw Error('PREVIEW_SCRIPT_MISSING');
 for(const x of [guardCredential,telegramCredential])if(!x||typeof x.id!=='string'||!x.id||typeof x.name!=='string'||!x.name)throw Error('PREVIEW_CREDENTIAL_MISSING');
 const ops=[],add=(name,type,parameters,x,y,credentials)=>ops.push({type:'addNode',node:{name,type:'n8n-nodes-base.'+type,typeVersion:type==='if'?2.2:type==='code'?2:type==='httpRequest'?4.2:1.2,position:[x,y],parameters,...(credentials?{credentials}:{} )}});
 const cond=(name,expr,x,y)=>add(name,'if',{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{leftValue:'={{ '+expr+' }}',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},x,y);
 const code=(name,js,x,y)=>add(name,'code',{jsCode:js},x,y);
 const post=(name,path,body,x,y)=>add(name,'httpRequest',{method:'POST',url:guard+path,authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',jsonBody:'={{ JSON.stringify('+body+') }}',options:{timeout:30000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json'}}}},x,y,{httpHeaderAuth:guardCredential});
 const connect=(source,target,sourceIndex=0)=>ops.push({type:'addConnection',source,target,sourceIndex});
 cond(names.branch,'$json.preview_requested === true',900,1040);
 post(names.preview,'corrections/preview','$json.preview_body',1120,1000);
 code(names.identity,scripts.identity,1340,1000);
 cond(names.identityIf,"$json.status === 'PREVIEW_IDENTITY_READY'",1560,1000);
 post(names.init,'previews/delivery/initialize','{owner:$json.owner,chat:$json.chat,packageId:$json.packageId,revision:$json.revision,previewHash:$json.previewHash}',1780,960);
 code(names.next,scripts.next,2000,960);
 cond(names.nextIf,"$json.status === 'CLAIM_NEXT'",2220,960);
 post(names.claim,'previews/delivery/claim','$json.body',2440,920);
 code(names.send,scripts.send,2660,920);
 cond(names.sendIf,"$json.status === 'SEND_READY'",2880,920);
 cond(names.completeIf,"$json.status === 'DELIVERY_COMPLETE'",3100,1040);
 add(names.telegram,'telegram',{chatId:'={{ $json.telegram.chatId }}',text:'={{ $json.telegram.text }}',additionalFields:{appendAttribution:false,parse_mode:'HTML'}},3100,880,{telegramApi:telegramCredential});
 code(names.ack,scripts.ack,3320,880);
 cond(names.ackIf,"$json.status === 'RECEIPT_READY'",3540,880);
 post(names.report,'previews/delivery/report','$json.body',3760,840);
 for(const nodeName of [names.preview,names.init,names.claim,names.telegram,names.report])ops.push({type:'setNodeSettings',nodeName,settings:{retryOnFail:false,onError:'continueRegularOutput'}});
 code(names.fail,"const c=$('Resolver paquete Telegram').first(0,0).json; return [{json:{...c,has_file:false,reply_text:'No pude confirmar la entrega completa de la vista. No se envió la revisión al Motor; consulta el estado antes de reintentar.'}}];",3320,1180);
 ops.push({type:'removeConnection',source:'¿Cierre acreditado guardado?',sourceIndex:1,target:'Conservar operación sin sellado'});
 connect('¿Cierre acreditado guardado?',names.branch,1);connect(names.branch,names.preview);connect(names.branch,'Conservar operación sin sellado',1);
 connect(names.preview,names.identity);connect(names.identity,names.identityIf);connect(names.identityIf,names.init);connect(names.identityIf,names.fail,1);
 connect(names.init,names.next);connect(names.next,names.nextIf);connect(names.nextIf,names.claim);connect(names.nextIf,names.fail,1);
 connect(names.claim,names.send);connect(names.send,names.sendIf);connect(names.sendIf,names.telegram);connect(names.sendIf,names.completeIf,1);
 connect(names.completeIf,names.fail,1);connect(names.telegram,names.ack);connect(names.ack,names.ackIf);connect(names.ackIf,names.report);connect(names.ackIf,names.fail,1);
 connect(names.report,names.next);connect(names.fail,'Confirmar recepción Telegram');
 return {names,operations:ops};
}
