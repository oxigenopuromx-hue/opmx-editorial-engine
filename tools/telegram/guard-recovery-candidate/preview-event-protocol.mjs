// Extends the active MCP protocol without replacing its existing event catalog.
// The preview event requests editorial preparation only; it is not a ready event.
export function classifyPreviewEvent(message,base,identity){
 if(!message||typeof message!=='object'||Array.isArray(message)||message.jsonrpc!=='2.0'||!Object.hasOwn(message,'id'))return base;
 const fail=()=>({httpStatus:200,response:{jsonrpc:'2.0',id:message.id,error:{code:-32602,message:'Invalid preview event request'}}});
 if(message.method==='events/list'){
  const result=base?.response?.result;if(!Array.isArray(result?.events)||result.events.some(x=>x?.name==='opmx.package.preview'))return base;
  const p=message.params??{};if(!p||Array.isArray(p)||typeof p!=='object'||Object.keys(p).some(k=>!['cursor','_meta'].includes(k))||(p.cursor!==undefined&&p.cursor!==null))return base;
  const preview={name:'opmx.package.preview',description:'Solicita al Motor existente una propuesta de actualización de una revisión OPEN. No autoriza publicar ni actualizar.',delivery:['webhook'],inputSchema:{type:'object',properties:{queue_id:{type:'string',enum:['telegram-editorial']}},required:['queue_id'],additionalProperties:false},payloadSchema:{type:'object',properties:{queue_id:{type:'string',enum:['telegram-editorial']},package_id:{type:'string',pattern:'^tg_[a-f0-9]{40}$'},revision:{type:'integer',minimum:2},state:{type:'string',enum:['OPEN']},item_count:{type:'integer',minimum:1,maximum:40}},required:['queue_id','package_id','revision','state','item_count'],additionalProperties:false}};
  return {...base,response:{...base.response,result:{...result,events:[...result.events,preview]}}};
 }
 if(!['events/subscribe','events/unsubscribe'].includes(message.method)||message.params?.name!=='opmx.package.preview')return base;
 if(typeof identity?.owner!=='string'||identity.owner!==identity.chat||!/^[1-9][0-9]{0,15}$/.test(identity.owner))return fail();
 const p=message.params,sub=message.method==='events/subscribe';
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['name','arguments','delivery','_meta',...(sub?['ttlMs','cursor']:[])].includes(k))||!p.arguments||typeof p.arguments!=='object'||Array.isArray(p.arguments)||Object.keys(p.arguments).join(',')!=='queue_id'||p.arguments.queue_id!=='telegram-editorial'||!p.delivery||typeof p.delivery!=='object'||Array.isArray(p.delivery)||Object.keys(p.delivery).some(k=>!['mode','url',...(sub?['secret']:[])].includes(k))||p.delivery.mode!=='webhook'||typeof p.delivery.url!=='string'||p.delivery.url.length>4096||(sub&&(typeof p.delivery.secret!=='string'||p.delivery.secret.length>100))||(p.cursor!==undefined&&p.cursor!==null)||(p.ttlMs!==undefined&&p.ttlMs!==null&&(!Number.isSafeInteger(p.ttlMs)||p.ttlMs<0)))return fail();
 return {httpStatus:200,route:'telegram-events',request:{id:message.id,action:sub?'subscribe':'unsubscribe',body:{owner:identity.owner,chat:identity.chat,params:p}}};
}
