import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuard} from './deployed-guard/guard-server.mjs';
test('administrative freeze authenticates before invoking the bounded service and keeps observe separate',async()=>{
 let calls=0;const secret='a'.repeat(64),scope={packageId:'tg_'+'b'.repeat(40),revision:8,owner:'123',chat:'123'};
 const server=createGuard({pool:{getConnection(){throw Error('unexpected database')}},secret,telegramReconciliationFreeze:async input=>{calls++;assert.deepEqual(input,scope);return {status:'UNWRITTEN_ATTEMPT_RECONCILED',writeAuthorized:false}}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const url='http://127.0.0.1:'+server.address().port,body=JSON.stringify(scope),post=(path,token)=>fetch(url+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body});
  assert.equal((await post('/v1/telegram/reconciliation/freeze-unwritten','b'.repeat(64))).status,401);assert.equal(calls,0);
  assert.equal((await post('/v1/telegram/reconciliation/observe',secret)).status,404);assert.equal(calls,0);
  const r=await post('/v1/telegram/reconciliation/freeze-unwritten',secret);assert.equal(r.status,200);assert.equal((await r.json()).writeAuthorized,false);assert.equal(calls,1);
 }finally{await new Promise(r=>server.close(r));}
});
