// Candidate MCP adapter for the existing Motor. It exposes no external target,
// chat, permissions or publication parameters from content. The guard bearer
// stays in the existing n8n credential; start returns a one-use capability only
// to the authenticated tool caller. A lost response is never retried.
const pkg=/^tg_[a-f0-9]{40}$/,event=/^evt_[a-f0-9]{48}$/,token=/^[a-f0-9]{64}$/;
const rev=x=>Number.isSafeInteger(x)&&x>0&&x<=4294967295;
const start='iniciar_intento_telegram_opmx',block='bloquear_intento_telegram_opmx';
const properties={package_id:{type:'string',pattern:'^tg_[a-f0-9]{40}$'},revision:{type:'integer',minimum:1,maximum:4294967295},event_id:{type:'string',pattern:'^evt_[a-f0-9]{48}$'},attempt_token:{type:'string',pattern:'^[a-f0-9]{64}$'}};
export function classifyMotorAttempt(message,base,identity){
 if(!message||typeof message!=='object'||Array.isArray(message))return base;
 if(message.method==='tools/list'&&Array.isArray(base?.response?.result?.tools)){
  const tools=[{name:start,title:'Iniciar intento Telegram',description:'Reclama una sola ejecución de la revisión READY exacta. Nunca reintentar un resultado incierto.',inputSchema:{type:'object',properties:{package_id:properties.package_id,revision:properties.revision},required:['package_id','revision'],additionalProperties:false}},{name:block,title:'Bloquear intento Telegram',description:'Congela un intento que no inició escrituras; conserva la capacidad en privado y no la reintentes si la respuesta es incierta.',inputSchema:{type:'object',properties,required:['package_id','revision','event_id','attempt_token'],additionalProperties:false}}];
  return {...base,response:{...base.response,result:{...base.response.result,tools:[...base.response.result.tools,...tools]}}};
 }
 if(message.method!=='tools/call'||![start,block].includes(message.params?.name)||message.jsonrpc!=='2.0'||!Object.hasOwn(message,'id'))return base;
 const a=message.params.arguments,isStart=message.params.name===start,keys=isStart?['package_id','revision']:['package_id','revision','event_id','attempt_token'];
 if(typeof identity?.owner!=='string'||identity.owner!==identity.chat||!/^[1-9][0-9]{0,15}$/.test(identity.owner)||!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).sort().join(',')!==keys.sort().join(',')||!pkg.test(a.package_id??'')||!rev(a.revision)||(!isStart&&(!event.test(a.event_id??'')||!token.test(a.attempt_token??''))))return {httpStatus:200,response:{jsonrpc:'2.0',id:message.id,error:{code:-32602,message:'Intento inválido'}}};
 return {httpStatus:200,route:'telegram-attempt',request:{id:message.id,action:isStart?'start':'block',body:{packageId:a.package_id,revision:a.revision,...(isStart?{owner:identity.owner,chat:identity.chat}:{eventId:a.event_id,token:a.attempt_token})}}};
}
export function formatMotorAttempt(request,result){
 const fail=()=>({httpStatus:200,response:{jsonrpc:'2.0',id:request?.id??null,result:{content:[{type:'text',text:JSON.stringify({status:'ATTEMPT_UNCONFIRMED',retryPermitted:false})}],structuredContent:{status:'ATTEMPT_UNCONFIRMED',retryPermitted:false},isError:true}}});
 if(!request||!['start','block'].includes(request.action)||!result||typeof result!=='object')return fail();
 let data;
 if(request.action==='start'&&result.status==='ATTEMPT_STARTED'&&event.test(result.eventId??'')&&token.test(result.token??''))data={status:'ATTEMPT_STARTED',event_id:result.eventId,attempt_token:result.token,retryPermitted:false};
 else if(request.action==='start'&&['ATTEMPT_ALREADY_CLAIMED','ATTEMPT_NOT_REGISTERED','ATTEMPT_NOT_PERMITTED','STALE_REVISION'].includes(result.status))data={status:result.status,retryPermitted:false};
 else if(request.action==='block'&&['ATTEMPT_BLOCKED','BLOCKED_REPLAY','RECONCILIATION_REQUIRED','ATTEMPT_NOT_AUTHORIZED','ATTEMPT_NOT_RUNNING','STALE_REVISION'].includes(result.status))data={status:result.status,reopenPermitted:false,retryPermitted:false};
 else return fail();
 return {httpStatus:200,response:{jsonrpc:'2.0',id:request.id,result:{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:false}}};
}
