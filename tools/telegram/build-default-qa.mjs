import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { after } from './build-default-receiver.mjs';
const names=['Normalizar entrada Telegram','Resolver paquete Telegram','Preparar política tras aviso confirmado','Preparar sellado con cierre acreditado'];
const wrappers=names.map((name,i)=>`function run${i}(input,upstream={}){const $input={first:()=>({json:input})};const $=name=>({first:()=>({json:upstream[name]})});\n${after.nodes.find(n=>n.name===name).parameters.jsCode}\n}`).join('\n');
const jsCode=wrappers+`
let passed=0;
function check(ok,label){if(!ok)throw Error('QA: '+label);passed++;}
const pkg='tg_'+'a'.repeat(40),item='ti_'+'b'.repeat(40);
function message(text){return {update:{update_id:100,message:{message_id:10,chat:{id:123,type:'private'},from:{id:123},text}},config:{allowedUserIds:['123'],allowedChatIds:['123']}};}
for(const cmd of ['/nuevo','/listo','/borrador','/publicar opol']){
 const m=message(cmd);check(run0(m)[0].json.mode_attested===true,'direct '+cmd);
 m.update.message.forward_origin={type:'user'};check(run0(m)[0].json.kind==='REJECTED','forwarded '+cmd);
}
const denied=message('/listo');denied.update.message.from.id=456;check(run0(denied).length===0,'unauthorized');
const ctx={package_operation:'OPEN',message_id:10,receipt_id:'telegram-123-10-100',user_id:'123',chat_id:'123'};
const opening=run1({status:'OPEN',packageId:pkg,state:'OPEN'},{'Preparar paquete Telegram':ctx})[0].json;
check(opening.default_policy_candidate===true&&opening.reply_text.includes('PUBLICAR'),'announced default');
const policy=run2({ok:true,result:{message_id:11,chat:{id:123}}},{'Resolver paquete Telegram':opening})[0].json.body;
check(policy.packageId===pkg&&policy.receiptId===ctx.receipt_id&&policy.text.includes('notice_message_id'),'opening attested');
const closing=run1({status:'OPEN',packageId:pkg},{'Preparar paquete Telegram':{...ctx,package_operation:'SEAL',message_id:50,receipt_id:'telegram-123-50-101'}})[0].json;
check(closing.next_action==='reserve'&&closing.next_body.text.includes('/listo')&&closing.seal_after_close===true,'close reserved before seal');
for(const result of [{status:'STORED',packageId:pkg,itemId:item},{status:'RESERVATION_REPLAY',state:'STORED',itemId:item}])check(run3(result,{'Resolver paquete Telegram':closing})[0].json.seal_requested===true,'confirmed close');
check(run3({status:'QUOTA_EXCEEDED'},{'Resolver paquete Telegram':closing})[0].json.seal_requested===false,'no seal after failure');
const mode=run1({status:'OPEN',packageId:pkg},{'Preparar paquete Telegram':{...ctx,package_operation:'CONTENT',kind:'TEXT',text:'/borrador',mode_attested:true,message_id:20}})[0].json;
check(mode.next_body.text.includes('/borrador')&&mode.next_body.text.includes('publish-ambos-v1'),'explicit draft marked');
return [{json:{status:'QA_PASSED',assertions:passed,external_io:false,published_posts:0}}];`;
const code=`const start=trigger({type:'n8n-nodes-base.manualTrigger',version:1,config:{name:'Iniciar QA sin IO',position:[0,0]},output:[{}]});
const qa=node({type:'n8n-nodes-base.code',version:2,config:{name:'Comprobar controles acreditados',position:[240,0],parameters:{jsCode:${JSON.stringify(jsCode)}}},output:[{status:'QA_PASSED',assertions:16,external_io:false,published_posts:0}]});
export default workflow('opmx-telegram-default-qa','OPMX — QA política Telegram v1 · sin IO').add(start).to(qa);`;
export { code,jsCode };
if(process.argv[1]===fileURLToPath(import.meta.url)) {
 const qa={name:'OPMX — QA política Telegram v1 · sin IO',active:false,nodes:[{name:'Iniciar QA sin IO',type:'n8n-nodes-base.manualTrigger',typeVersion:1,position:[0,0],parameters:{}},{name:'Comprobar controles acreditados',type:'n8n-nodes-base.code',typeVersion:2,position:[240,0],parameters:{jsCode}}],connections:{'Iniciar QA sin IO':{main:[[{node:'Comprobar controles acreditados',type:'main',index:0}]]}},settings:{executionOrder:'v1'}};
 fs.writeFileSync(new URL('../../workflows/telegram/OPMX_TELEGRAM_DEFAULT_QA_v1.json',import.meta.url),JSON.stringify(qa,null,2)+'\n');
 console.log('Generated isolated QA: manual trigger + Code; no network, credentials or data tables.');
}
