import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const names={normalize:'normalize.js',prepare:'prepare.js',resolve:'resolve.js',confirm:'confirm.js'};
const scripts=Object.fromEntries(Object.entries(names).map(([k,p])=>[k,readFileSync(new URL('./receiver/'+p,import.meta.url),'utf8')]));
function run(name,input,refs={}){return new Function('$input','$',scripts[name])({first:()=>({json:input})},key=>({first:()=>({json:refs[key]})}));}
const config={allowedUserIds:['111'],allowedChatIds:['111']};
const msg={message_id:4,chat:{id:111,type:'private'},from:{id:111,is_bot:false},text:'/cancelar duplicado'};
const update={update_id:5,message:msg};
const normal=run('normalize',{update,config})[0].json;
assert.equal(normal.cancel_attested,true);
const intent=run('prepare',normal)[0].json;
assert.equal(intent.package_operation,'CANCEL_DUPLICATE');
const packageId='tg_'+'a'.repeat(40);
const session={statusCode:200,body:{status:'OPEN',packageId,revision:9}};
const resolved=run('resolve',session,{'Preparar paquete Telegram':intent})[0].json;
assert.equal(resolved.next_body.revision,9);
assert.ok(resolved.next_url.endsWith('/packages/cancel-duplicate'));
const response=run('confirm',{status:'CANCELLED',packageId,revision:9,reason:'DUPLICATE',writeAuthorized:false,retryPermitted:false},{'Resolver paquete Telegram':resolved})[0].json;
assert.equal(response.package_state,'CANCELLED');
for(const m of [{...msg,forward_origin:{}},{...msg,reply_to_message:{}},{...msg,text:'/cancelar duplicado adicional'},{...msg,text:'/cancelar duplicado\nextra'}]){
 const rejected=run('normalize',{update:{...update,message:m},config})[0].json;
 assert.equal(rejected.kind,'REJECTED');
}
console.log('PASS: receptor simulado y rechazo de órdenes indirectas');
