// Administrative recovery of an existing attempt only. The Guard must verify
// its configured administrator, exact event/preview and AWAITING_DECISION fence
// under locks. This adapter neither starts an attempt nor grants write access.
export const unacknowledgedRecoveryTool='recuperar_intento_sin_decision_telegram_opmx';
const pkg=/^tg_[a-f0-9]{40}$/,event=/^evt_[a-f0-9]{48}$/,hash=/^[a-f0-9]{64}$/;
const revision=x=>Number.isSafeInteger(x)&&x>0&&x<=4294967295;
const operation='recover-unacknowledged';
const properties={package_id:{type:'string',pattern:'^tg_[a-f0-9]{40}$'},revision:{type:'integer',minimum:1,maximum:4294967295},event_id:{type:'string',pattern:'^evt_[a-f0-9]{48}$'},preview_hash:{type:'string',pattern:'^[a-f0-9]{64}$'}};

export function classifyUnacknowledgedRecovery(message,base,identity){
 if(!message||typeof message!=='object'||Array.isArray(message))return base;
 if(message.method==='tools/list'&&Array.isArray(base?.response?.result?.tools)){
  if(base.response.result.tools.some(t=>t?.name===unacknowledgedRecoveryTool))return base;
  const tool={name:unacknowledgedRecoveryTool,title:'Recuperar intento sin decisión reconocida',description:'Sólo para recuperación administrativa explícita de un intento existente antes de reconocer la decisión. El Guard verifica administrador, revisión READY, evento y preview exactos y fence AWAITING_DECISION, revoca la capacidad anterior y devuelve otra privada. Nunca reintentar una respuesta incierta ni divulgar la capacidad.',inputSchema:{type:'object',properties,required:Object.keys(properties),additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}};
  return {...base,response:{...base.response,result:{...base.response.result,tools:[...base.response.result.tools,tool]}}};
 }
 if(message.method!=='tools/call'||message.params?.name!==unacknowledgedRecoveryTool)return base;
 const fail=()=>({httpStatus:200,response:{jsonrpc:'2.0',id:message.id??null,error:{code:-32602,message:'Recuperación administrativa inválida'}}}),a=message.params.arguments;
 if(message.jsonrpc!=='2.0'||!Object.hasOwn(message,'id')||typeof identity?.owner!=='string'||identity.owner!==identity.chat||!/^[1-9][0-9]{0,15}$/.test(identity.owner)||!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).sort().join(',')!=='event_id,package_id,preview_hash,revision'||!pkg.test(a.package_id??'')||!revision(a.revision)||!event.test(a.event_id??'')||!hash.test(a.preview_hash??''))return fail();
 return {httpStatus:200,route:'telegram-attempt',request:{id:message.id,action:operation,body:{owner:identity.owner,chat:identity.chat,packageId:a.package_id,revision:a.revision,eventId:a.event_id,previewHash:a.preview_hash}}};
}

export function formatUnacknowledgedRecovery(request,result){
 const fail=()=>({httpStatus:200,response:{jsonrpc:'2.0',id:request?.id??null,result:{content:[{type:'text',text:JSON.stringify({status:'ATTEMPT_UNCONFIRMED',retryPermitted:false})}],structuredContent:{status:'ATTEMPT_UNCONFIRMED',retryPermitted:false},isError:true}}});
 if(request?.action!==operation||!result||typeof result!=='object')return fail();
 let data;
 // Only the authenticated tool caller receives this one-use capability. A
 // changed event, malformed response or unknown status never exposes a token.
 if(result.status==='UNACKNOWLEDGED_ATTEMPT_RECOVERED'&&result.retryPermitted===false&&event.test(result.eventId??'')&&result.eventId===request.body?.eventId&&hash.test(result.token??''))data={status:result.status,event_id:result.eventId,attempt_token:result.token,retryPermitted:false};
 else if(result.retryPermitted===false&&['RECOVERY_NOT_AUTHORIZED','STALE_REVISION','RECOVERY_NOT_PERMITTED','RECONCILIATION_REQUIRED','DECISION_UNCONFIRMED','DECISION_MISMATCH'].includes(result.status))data={status:result.status,retryPermitted:false};
 else return fail();
 return {httpStatus:200,response:{jsonrpc:'2.0',id:request.id,result:{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:false}}};
}
