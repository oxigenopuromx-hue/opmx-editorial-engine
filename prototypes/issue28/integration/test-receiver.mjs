import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const names={normalize:'normalize.js',prepare:'prepare.js',resolve:'resolve.js',confirm:'confirm.js'};
const scripts=Object.fromEntries(Object.entries(names).map(([k,p])=>[k,readFileSync(new URL('./receiver/'+p,import.meta.url),'utf8')]));
function run(name,input,refs={}){return new Function('$input','$',scripts[name])({first:()=>({json:input})},key=>({first:()=>({json:refs[key]})}));}
const config={allowedUserIds:['111'],allowedChatIds:['111']};
const packageId='tg_'+'a'.repeat(40);
const msg={message_id:4,chat:{id:111,type:'private'},from:{id:111,is_bot:false},text:'/cancelar duplicado '+packageId+' 9'};
const update={update_id:5,message:msg};
const normal=run('normalize',{update,config})[0].json;
assert.equal(normal.cancel_attested,true);
const intent=run('prepare',normal)[0].json;
assert.equal(intent.package_operation,'CANCEL_DUPLICATE');
const session={statusCode:200,body:{status:'OPEN',packageId,revision:9}};
const resolved=run('resolve',session,{'Preparar paquete Telegram':intent})[0].json;
assert.equal(resolved.next_body.revision,9);
for(const different of [{status:'OPEN',packageId:'tg_'+'b'.repeat(40),revision:9},{status:'OPEN',packageId,revision:10}]){const stale=run('resolve',{statusCode:200,body:different},{'Preparar paquete Telegram':intent})[0].json;assert.equal(stale.requires_operation,false);assert.match(stale.reply_text,/cambió/);}
assert.ok(resolved.next_url.endsWith('/packages/cancel-duplicate'));
const response=run('confirm',{status:'CANCELLED',packageId,revision:9,reason:'DUPLICATE',writeAuthorized:false,retryPermitted:false},{'Resolver paquete Telegram':resolved})[0].json;
assert.equal(response.package_state,'CANCELLED');
const wrong=run('confirm',{status:'CANCELLED',packageId,revision:10,reason:'DUPLICATE',writeAuthorized:false,retryPermitted:false},{'Resolver paquete Telegram':resolved})[0].json;
assert.notEqual(wrong.package_state,'CANCELLED');
const state=run('confirm',{status:'FOUND',packageId,state:'OPEN',revision:9,items:[],diagnostic:{schema:'opmx.package-diagnostic.v1',origin:'OWN'}},{'Resolver paquete Telegram':{...resolved,package_operation:'STATUS'}})[0].json;
assert.ok(state.reply_text.includes('/cancelar duplicado '+packageId+' 9'));
for(const m of [{...msg,forward_origin:{}},{...msg,document:{}},{...msg,text:'/cancelar duplicado'},{...msg,reply_to_message:{}},{...msg,text:'/cancelar duplicado adicional'},{...msg,text:'/cancelar duplicado\nextra'}]){
 const rejected=run('normalize',{update:{...update,message:m},config})[0].json;
 assert.equal(rejected.kind,'REJECTED');
}
console.log('PASS: receptor simulado y rechazo de órdenes indirectas');
