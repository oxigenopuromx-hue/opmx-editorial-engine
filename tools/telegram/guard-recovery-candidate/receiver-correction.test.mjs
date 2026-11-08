import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const path=n=>new URL('./receiver/'+n,import.meta.url);
const [normal,prepare,resolve,seal]=await Promise.all(['normalize-candidate.js','prepare-candidate.js','resolve-candidate.js','seal-candidate.js'].map(n=>readFile(path(n),'utf8')));
const pkg='tg_'+'a'.repeat(40),item='ti_'+'b'.repeat(40);
const run=(code,input,prior)=>new Function('$input','$',code)({first:()=>({json:input})},()=>({first:()=>({json:prior})}))[0]?.json;
const msg=(text,forwarded=false)=>({update:{update_id:121,message:{message_id:21,chat:{id:123,type:'private'},from:{id:123,is_bot:false},text,...(forwarded?{forward_date:100}:{})}},config:{allowedUserIds:['123'],allowedChatIds:['123']}});
test('direct selection is routed to the guard and is not saved as source material',()=>{
 const intent=run(prepare,run(normal,msg('/opciones literal OPOL,LIBERAL')));const out=run(resolve,{status:'OPEN',packageId:pkg,revision:11,recovery:true},intent);
 assert.equal(out.next_action,'corrections/select');assert.deepEqual(out.next_body,{owner:'123',chat:'123',packageId:pkg,revision:11,receiptId:'telegram-123-21-121',mode:'LITERAL',destination:'OPOL,LIBERAL'});
});
test('forwarded instructions and ordinary packages cannot select correction options',()=>{
 assert.equal(run(normal,msg('/opciones literal OPURO',true)).kind,'REJECTED');
 const intent=run(prepare,run(normal,msg('/opciones literal OPURO')));assert.equal(run(resolve,{status:'OPEN',packageId:pkg,revision:11,recovery:false},intent).requires_operation,false);
});
test('discard requires a direct command and a recovery session',()=>{
 const command=`/descartar ${item}`;
 assert.equal(run(normal,msg(command,true)).kind,'REJECTED');
 const intent=run(prepare,run(normal,msg(command)));
 assert.equal(run(resolve,{status:'OPEN',packageId:pkg,revision:11,recovery:false},intent).requires_operation,false);
 const accepted=run(resolve,{status:'OPEN',packageId:pkg,revision:11,recovery:true},intent);
 assert.equal(accepted.next_action,'discard');assert.equal(accepted.next_body.itemId,item);
 const forged={...intent,mode_attested:false};assert.equal(run(resolve,{status:'OPEN',packageId:pkg,revision:11,recovery:true},forged).requires_operation,false);
});
test('closing a recovered package requests a preview instead of sealing',()=>{
 const intent=run(prepare,run(normal,msg('/listo')));const next=run(resolve,{status:'OPEN',packageId:pkg,revision:11,recovery:true},intent);
 const out=run(seal,{status:'STORED',packageId:pkg,itemId:item,revision:12},next);assert.equal(out.seal_requested,false);assert.equal(out.preview_requested,true);assert.equal(out.preview_body.revision,12);
});
test('confirmation requires direct command, current revision and exact preview hash',()=>{
 const hash='c'.repeat(64),input=`/confirmar crear 12 ${hash}`;assert.equal(run(normal,msg(input,true)).kind,'REJECTED');
 const intent=run(prepare,run(normal,msg(input)));const out=run(resolve,{status:'OPEN',packageId:pkg,revision:12,recovery:true},intent);
 assert.equal(out.next_action,'corrections/confirm');assert.equal(out.next_body.previewHash,hash);assert.equal(out.next_body.action,'CREATE');
 assert.equal(run(resolve,{status:'OPEN',packageId:pkg,revision:13,recovery:true},intent).requires_operation,false);
});
