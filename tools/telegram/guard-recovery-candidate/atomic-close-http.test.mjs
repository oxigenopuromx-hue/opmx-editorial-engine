import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';
import {createGuard} from './deployed-guard/guard-server.mjs';
const secret='a'.repeat(64);
test('atomic close authenticates first, preserves the exact input and fails closed without a confirmed transaction',async()=>{
 let calls=0,fail=false;
 const body={owner:'123',chat:'123',packageId:'tg_'+'b'.repeat(40),receiptId:'telegram-123-2-2',kind:'TEXT',text:'synthetic authenticated control',attachment:null};
 const server=createGuard({pool:{getConnection(){throw Error('NO_DATABASE_EXPECTED')}},secret,telegramStore:{async run(action,input){calls++;assert.equal(action,'close');assert.deepEqual(input,body);if(fail)throw Error('UNAVAILABLE');return {status:'CLOSE_COMPLETED'}}}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const url='http://127.0.0.1:'+server.address().port+'/v1/telegram/packages/close';
 try{const post=auth=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+secret}:{})},body:JSON.stringify(body)});
  let r=await post(false);assert.equal(r.status,401);assert.equal(calls,0);
  r=await post(true);assert.equal(r.status,200);assert.equal((await r.json()).status,'CLOSE_COMPLETED');assert.equal(calls,1);
  fail=true;r=await post(true);assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'not_confirmed'});assert.equal(calls,2);
 }finally{server.close();server.closeAllConnections();await once(server,'close')}
});
test('capacity diagnostics require authentication and an empty body and never accept a package or mutation',async()=>{
 let reads=0;const summary={status:'CAPACITY_OBSERVED',readOnly:true,authorizesDeletion:false,authorizesLimitChange:false};
 const server=createGuard({pool:{getConnection(){throw Error('NO_DATABASE_EXPECTED')}},secret,telegramStore:{async capacity(){reads++;return summary}}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const url='http://127.0.0.1:'+server.address().port+'/v1/telegram/packages/capacity';
 try{const post=(body,auth=true)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+secret}:{})},body:JSON.stringify(body)});
  let r=await post({},false);assert.equal(r.status,401);assert.equal(reads,0);r=await post({packageId:'x'});assert.equal(r.status,400);assert.equal(reads,0);r=await post({});assert.equal(r.status,200);assert.deepEqual(await r.json(),summary);assert.equal(reads,1);
 }finally{server.close();server.closeAllConnections();await once(server,'close')}
});
