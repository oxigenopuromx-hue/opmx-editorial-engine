import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuard} from './deployed-guard/guard-server.mjs';

test('final observation requires Guard authentication and a distinct read-only hook',async()=>{
 let calls=0;
 const input={packageId:'tg_'+'a'.repeat(40),revision:8};
 const s=createGuard({pool:{getConnection:async()=>{throw Error('unexpected SQL')}},secret:'b'.repeat(64),telegramFinalPublication:async body=>{assert.deepEqual(body,input);calls++;return {status:'FINAL_PUBLICATION_UNCONFIRMED',writeAuthorized:false,retryPermitted:false}}});
 await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
 try{
  const post=(path,auth)=>fetch('http://127.0.0.1:'+s.address().port+path,{method:'POST',headers:{'content-type':'application/json',...(auth?{authorization:'Bearer '+'b'.repeat(64)}:{})},body:JSON.stringify(input)});
  assert.equal((await post('/v1/telegram/publications/observe-final',false)).status,401);assert.equal(calls,0);
  assert.equal((await post('/v1/telegram/reconciliation/observe',true)).status,404);
  const r=await post('/v1/telegram/publications/observe-final',true);assert.equal(r.status,200);assert.equal((await r.json()).writeAuthorized,false);assert.equal(calls,1);
 }finally{await new Promise(resolve=>s.close(resolve))}
});
