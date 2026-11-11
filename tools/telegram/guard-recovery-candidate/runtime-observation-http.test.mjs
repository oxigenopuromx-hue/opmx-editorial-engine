import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createGuard} from './deployed-guard/guard-server.mjs';
const secret='a'.repeat(64);
async function withServer(observer,operation){
 const server=createGuard({pool:{getConnection(){throw Error('Unexpected database access')}},secret,runtimeObserver:observer});server.listen(0,'127.0.0.1');await once(server,'listening');
 try{await operation(`http://127.0.0.1:${server.address().port}/v1/telegram/runtime/observe`)}finally{server.close();server.closeAllConnections();await once(server,'close')}
}
test('runtime route authenticates before observation and does not touch the database',async()=>{
 let calls=0;await withServer(async()=>{calls++;return {status:'RUNTIME_OBSERVATION_UNAVAILABLE',authorizesRecovery:false}},async url=>{
  let r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,401);assert.equal(calls,0);
  r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,503);assert.equal(calls,1);
 });
});
test('runtime HTTP diagnostics omit workflow graphs and retain explicit no-permission result',async()=>{
 await withServer(async()=>({status:'RUNTIME_OBSERVED',authorizesRecovery:false,motorTerminationVerified:false,workflows:[{id:'fixed',activeVersionId:'published',graph:{nodes:[{parameters:{private:'not returned'}}],connections:{}}}]}),async url=>{
  const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,200);const body=await r.json();assert.equal(body.authorizesRecovery,false);assert.equal(body.motorTerminationVerified,false);assert.deepEqual(body.workflows,[{id:'fixed',activeVersionId:'published',nodeCount:1}]);assert.ok(!JSON.stringify(body).includes('private'));
 });
});
