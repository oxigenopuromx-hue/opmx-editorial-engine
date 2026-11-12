import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuard} from './deployed-guard/guard-server.mjs';

test('literal validation is separately authenticated, bounded and never a write permit',async()=>{
 let calls=0;
 const s=createGuard({pool:{getConnection:async()=>{throw Error('unexpected SQL')}},secret:'a'.repeat(64),telegramLiteralValidation:async input=>{calls++;assert.equal(typeof input.title,'string');return {status:'LITERAL_TEXT_UNCONFIRMED',writesStarted:false,retryPermitted:false}}});
 await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
 const post=(body,auth=true)=>fetch('http://127.0.0.1:'+s.address().port+'/v1/telegram/literal/validate',{method:'POST',headers:{'content-type':'application/json',...(auth?{authorization:'Bearer '+'a'.repeat(64)}:{})},body:JSON.stringify(body)});
 try{
  assert.equal((await post({title:'Synthetic'},false)).status,401);assert.equal(calls,0);
  const r=await post({title:'Synthetic',gutenberg:'x'.repeat(80000)});assert.equal(r.status,200);assert.equal((await r.json()).writesStarted,false);assert.equal(calls,1);
  assert.equal((await post({title:'Synthetic',gutenberg:'x'.repeat(8*1024*1024)})).status,413);assert.equal(calls,1);
 }finally{await new Promise(resolve=>s.close(resolve))}
});
