const MESSAGES={
 SOURCE_UNAVAILABLE:'No pude consultar una o más fuentes. El paquete está guardado; necesito una fuente accesible o su contenido.',
 CONTENT_INSUFFICIENT:'El material disponible necesita aclaración antes de redactar el borrador.',
 MEDIA_FAILED:'No pude preparar o verificar la imagen para el borrador.',
 VALIDATION_FAILED:'El paquete editorial no superó la validación y no fue enviado a Publisher.',
 DRAFT_FAILED:'Publisher no confirmó los borradores. Se requiere revisar el resultado antes de continuar.',
 DRAFT_UNCERTAIN:'El resultado de Publisher es incierto. Revisaré el estado antes de repetir cualquier envío.',
 INTERNAL_ERROR:'El procesamiento se detuvo por un error técnico. El material recibido permanece guardado.'
};
export function classifyTelegramFailure(envelope,identity,classifyBase) {
 const base=classifyBase(envelope);let m=envelope.body??envelope;
 if(typeof m==='string')try{m=JSON.parse(m)}catch{return base}
 const name='informar_bloqueo_telegram_opmx';
 if(m?.method==='tools/list'&&base.response?.result?.tools){base.response.result.tools.push({name,title:'Informar bloqueo al usuario Telegram',description:'Informa al mismo chat privado un bloqueo de procesamiento de un paquete READY y revisión exacta. Mensajes fijos; sin texto, enlaces ni destinatarios libres. No reintentes si el resultado es incierto.',inputSchema:{type:'object',properties:{package_id:{type:'string',pattern:'^tg_[a-f0-9]{40}$'},revision:{type:'integer',minimum:1},reason:{type:'string',enum:Object.keys(MESSAGES)}},required:['package_id','revision','reason'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false,idempotentHint:false}});return base}
 if(m?.method!=='tools/call'||m.params?.name!==name||m.jsonrpc!=='2.0'||!Object.hasOwn(m,'id'))return base;
 const bad=()=>({httpStatus:200,response:{jsonrpc:'2.0',id:m.id,error:{code:-32602,message:'Invalid failure report'}}}),a=m.params.arguments;
 if(typeof identity?.owner!=='string'||identity.owner!==identity.chat||!/^[1-9][0-9]{0,15}$/.test(identity.owner)||!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).sort().join(',')!=='package_id,reason,revision'||!/^tg_[a-f0-9]{40}$/.test(a.package_id??'')||!Number.isSafeInteger(a.revision)||a.revision<1||!Object.hasOwn(MESSAGES,a.reason))return bad();
 return {httpStatus:200,route:'telegram-failure',request:{id:m.id,body:{owner:identity.owner,chat:identity.chat,packageId:a.package_id,revision:a.revision,reason:a.reason}}};
}
export function prepareTelegramFailure(request,manifest) {
 if(manifest?.status!=='FOUND'||manifest.packageId!==request?.body?.packageId||manifest.state!=='READY'||Number(manifest.revision)!==request.body.revision)return {send:false,request};
 const b=request.body,msg=MESSAGES[b.reason];if(!msg)return {send:false,request};
 return {send:true,chatId:b.chat,text:`OPMX · proceso detenido\n\n${msg}\n\nPaquete: ${b.packageId}, versión ${b.revision}.`,request};
}
export function formatTelegramFailure(request,result) {
 const m=result?.result??result,sent=String(m?.chat?.id)===request.body.chat&&Number.isSafeInteger(m?.message_id)&&m.message_id>0;
 const data={status:sent?'FAILURE_REPORTED':'FAILURE_UNCERTAIN',package_id:request.body.packageId,revision:request.body.revision,reason:request.body.reason,retryPermitted:false};
 return {httpStatus:200,response:{jsonrpc:'2.0',id:request.id,result:{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:!sent}}};
}

