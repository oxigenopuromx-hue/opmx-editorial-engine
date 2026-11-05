export function classifyTelegramReview(envelope,identity,classifyBase) {
 const base=classifyBase(envelope);let m=envelope.body??envelope;
 if(typeof m==='string')try{m=JSON.parse(m);}catch{return base;}
 if(m?.method==='initialize'&&base.response?.result){base.response.result.serverInfo.version='1.4.0';return base;}
 const name='informar_revision_telegram_opmx',outcomes=['SOURCES_VERIFIED','COHERENCE_REQUIRED','INTEGRITY_FAILED'];
 if(m?.method==='tools/list'&&base.response?.result?.tools){base.response.result.tools.push({name,title:'Informar revisión al usuario Telegram',description:'Devuelve al mismo operador privado del bot el resultado de revisar las fuentes de un paquete READY y su versión exacta. Sólo mensajes fijos de integridad/coherencia; sin destinatario, texto ni enlaces libres. No genera ni publica notas. Úsala después de leer y verificar las fuentes. Mantén mismo paquete/versión/resultado; un envío incierto no se reintenta.',inputSchema:{type:'object',properties:{package_id:{type:'string',pattern:'^tg_[a-f0-9]{40}$'},revision:{type:'integer',minimum:1},outcome:{type:'string',enum:outcomes}},required:['package_id','revision','outcome'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false,idempotentHint:true}});return base;}
 if(m?.method!=='tools/call'||m.params?.name!==name||m.jsonrpc!=='2.0'||!Object.hasOwn(m,'id'))return base;
 const bad=()=>({httpStatus:200,response:{jsonrpc:'2.0',id:m.id,error:{code:-32602,message:'Invalid private review'}}}),a=m.params.arguments;
 if(typeof identity?.owner!=='string'||identity.owner!==identity.chat||!/^[1-9][0-9]{0,15}$/.test(identity.owner)||!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).sort().join(',')!=='outcome,package_id,revision'||!/^tg_[a-f0-9]{40}$/.test(a.package_id??'')||!Number.isSafeInteger(a.revision)||a.revision<1||!outcomes.includes(a.outcome))return bad();
 return {httpStatus:200,route:'telegram-review',request:{id:m.id,body:{owner:identity.owner,chat:identity.chat,packageId:a.package_id,revision:a.revision,outcome:a.outcome}}};
}
export function telegramReviewAck(request,result) {
 const m=result?.result??result,ok=String(m?.chat?.id)===request.body.chat&&Number.isSafeInteger(m?.message_id)&&m.message_id>0;
 return {...request.body,messageId:ok?m.message_id:0};
}
export function formatTelegramReviewResult(request,result) {
 const valid=result?.status==='REVIEW_REPORTED'&&result.packageId===request.body.packageId&&result.revision===request.body.revision&&result.outcome===request.body.outcome&&Number.isSafeInteger(result.messageId)&&result.messageId>0;
 const data=valid?{status:'REVIEW_REPORTED',package_id:result.packageId,revision:result.revision,outcome:result.outcome}:{status:result?.status==='REVIEW_UNCERTAIN'?'REVIEW_UNCERTAIN':'REVIEW_NOT_CONFIRMED',retryPermitted:false};
 return {httpStatus:200,response:{jsonrpc:'2.0',id:request.id,result:{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:!valid}}};
}

