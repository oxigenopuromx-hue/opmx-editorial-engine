import {packageIngressCode} from './package-ingress.mjs';
import {validateTelegramDownload} from './intake.mjs';

export function buildPackageIntakeOperations({guardCredential}) {
 if(!guardCredential?.id||!guardCredential?.name)throw Error('Reutilizar la credencial guard observada antes de generar operaciones');
 const code=packageIngressCode(),ops=[];
 const add=(name,type,typeVersion,parameters,x,y)=>ops.push({type:'addNode',node:{name,type,typeVersion,parameters,position:[x,y],...(type==='n8n-nodes-base.httpRequest'?{credentials:{httpHeaderAuth:guardCredential}}:{})}});
 const conn=(source,target,sourceIndex=0)=>ops.push({type:'addConnection',source,target,sourceIndex,targetIndex:0});
 const remove=(source,target,sourceIndex=0)=>ops.push({type:'removeConnection',source,target,sourceIndex,targetIndex:0});
 const addCode=(name,jsCode,x,y)=>add(name,'n8n-nodes-base.code',2,{mode:'runOnceForAllItems',jsCode},x,y);
 const addIf=(name,field,x,y)=>add(name,'n8n-nodes-base.if',2.2,{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{leftValue:`={{ $json.${field} }}`,rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},x,y);
 const http=(name,url,jsonBody,x,y)=>{
  add(name,'n8n-nodes-base.httpRequest',4.3,{method:'POST',url,authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',jsonBody,options:{timeout:30000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json'}}}},x,y);
  ops.push({type:'setNodeSettings',nodeName:name,settings:{onError:'continueRegularOutput',retryOnFail:false}});
 };
 addCode('Preparar paquete Telegram',code.prepare,672,320);
 addIf('¿Consultar almacenamiento Telegram?','requires_storage',896,320);
 http('Consultar sesión Telegram',"={{ 'https://publisher.oxigenopuro.com.mx/v1/telegram/packages/' + $json.storage_action }}",'={{ JSON.stringify($json.storage_body) }}',1120,320);
 addCode('Resolver paquete Telegram',code.session,1344,320);
 addIf('¿Operar paquete Telegram?','requires_operation',1568,320);
 http('Operar paquete Telegram',"={{ 'https://publisher.oxigenopuro.com.mx/v1/telegram/packages/' + $json.next_action }}",'={{ JSON.stringify($json.next_body) }}',1792,320);
 addCode('Confirmar operación de paquete Telegram',code.operation,2016,320);
 addIf('¿Guardar bytes Telegram?','has_file',2464,0);
 http('Guardar original Telegram','https://publisher.oxigenopuro.com.mx/v1/telegram/packages/complete','={{ JSON.stringify({owner:$json.user_id,chat:$json.chat_id,packageId:$json.packageId,itemId:$json.itemId,contentBase64:$json.contentBase64}) }}',2688,0);
 addCode('Confirmar original Telegram',code.stored,2912,0);
 remove('¿Identificación Telegram?','¿Descargar archivo Telegram?',1);
 conn('¿Identificación Telegram?','Preparar paquete Telegram',1);
 conn('Preparar paquete Telegram','¿Consultar almacenamiento Telegram?');
 conn('¿Consultar almacenamiento Telegram?','Consultar sesión Telegram');
 conn('¿Consultar almacenamiento Telegram?','Confirmar recepción Telegram',1);
 conn('Consultar sesión Telegram','Resolver paquete Telegram');
 conn('Resolver paquete Telegram','¿Operar paquete Telegram?');
 conn('¿Operar paquete Telegram?','Operar paquete Telegram');
 conn('¿Operar paquete Telegram?','Confirmar recepción Telegram',1);
 conn('Operar paquete Telegram','Confirmar operación de paquete Telegram');
 conn('Confirmar operación de paquete Telegram','¿Descargar archivo Telegram?');
 remove('Comprobar bytes Telegram','Confirmar recepción Telegram');
 conn('Comprobar bytes Telegram','¿Guardar bytes Telegram?');
 conn('¿Guardar bytes Telegram?','Guardar original Telegram');
 conn('¿Guardar bytes Telegram?','Confirmar recepción Telegram',1);
 conn('Guardar original Telegram','Confirmar original Telegram');
 conn('Confirmar original Telegram','Confirmar recepción Telegram');
 const check=validateTelegramDownload.toString()+`\nconst original=$('Confirmar operación de paquete Telegram').first(0,0).json;try{const keys=Object.keys($input.first().binary??{});if(keys.length!==1)throw Error('Binario ausente');const bytes=await this.helpers.getBinaryDataBuffer(0,keys[0]);const verified=validateTelegramDownload(original,bytes);return [{json:{...verified,contentBase64:bytes.toString('base64')}}];}catch{return [{json:{...original,kind:'DOWNLOAD_NOT_CONFIRMED',has_file:false,bytes_received:null,source_stored:false,original_stored:false,reply_text:'No se pudo confirmar la descarga. La reserva sigue pendiente; no se envió material al Motor.'}}];}`;
 ops.push({type:'updateNodeParameters',nodeName:'Comprobar bytes Telegram',parameters:{mode:'runOnceForAllItems',jsCode:check}});
 const result=`const sent=$input.first().json;const m=sent.result??sent;let input;for(const name of ['Confirmar original Telegram','Comprobar bytes Telegram','Confirmar operación de paquete Telegram','Resolver paquete Telegram','Preparar paquete Telegram','Normalizar entrada Telegram']){try{input=$(name).first(0,0).json;break}catch{}}if(!input)throw Error('Contexto de recepción ausente');const ack=String(m.chat?.id)===input.chat_id&&Number.isSafeInteger(m.message_id)&&m.message_id>0;const out={status:ack?'RECEIPT_CONFIRMED':'RECEIPT_NOT_CONFIRMED',mode:input.mode??'RECEIPT_ONLY',kind:input.kind,receipt_id:input.receipt_id,bytes_received:input.bytes_received??null,mime_type:input.attachment?.mime_type??null,package_id:input.packageId??null,item_id:input.itemId??null,package_state:input.package_state??null,source_stored:input.source_stored===true,original_stored:input.original_stored===true,publisher_called:false,work_event_sent:null};return [{json:out}];`;
 ops.push({type:'updateNodeParameters',nodeName:'Resultado piloto Telegram',parameters:{mode:'runOnceForAllItems',jsCode:result}});
 return ops;
}
