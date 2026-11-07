import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const candidate=await readFile(new URL('./receiver/seal-candidate.js',import.meta.url),'utf8');
function run(context,reserved){
 const $=()=>({first:()=>({json:context})});
 const $input={first:()=>({json:reserved})};
 return new Function('$','$input',candidate)($,$input)[0].json;
}
const pkg='tg_'+'a'.repeat(40),item='ti_'+'b'.repeat(40);
const context={seal_after_close:true,packageId:pkg,user_id:'456',chat_id:'456',receipt_id:'telegram-456-10-11'};
test('receiver carries the exact closing receipt into the guard seal request',()=>{
 const out=run(context,{status:'STORED',packageId:pkg,itemId:item});
 assert.equal(out.seal_requested,true);assert.deepEqual(out.seal_body,{owner:'456',chat:'456',packageId:pkg,receiptId:'telegram-456-10-11'});
});
test('receiver never seals if saving the closing control failed',()=>{
 const out=run(context,{status:'STALE_SESSION_MESSAGE'});
 assert.equal(out.seal_requested,false);assert.equal(out.passthrough.status,'CLOSE_NOT_CONFIRMED');
});
