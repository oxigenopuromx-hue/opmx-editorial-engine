import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';
import {createGuard} from './deployed-guard/guard-server.mjs';
const secret='a'.repeat(64);
async function run(options,operation){const server=createGuard({pool:{getConnection(){throw Error('Unexpected DB')}},secret,...options});server.listen(0,'127.0.0.1');await once(server,'listening');try{await operation(`http://127.0.0.1:${server.address().port}`)}finally{server.close();server.closeAllConnections();await once(server,'close')}}
const post=(url,authorized=true)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(authorized?{Authorization:`Bearer ${secret}`}:{})},body:'{}'});
test('writer acknowledgements are absent without the server-owned service',async()=>{await run({},async url=>assert.equal((await post(url+'/v1/telegram/writers/report')).status,404))});
test('writer receipts authenticate first and do not turn an unresolved phase into completion',async()=>{
 let calls=0;await run({telegramWriterReceipts:{async report(){calls++;return {status:'WRITER_RECEIPT_UNCONFIRMED',retryPermitted:false}}}},async url=>{assert.equal((await post(url+'/v1/telegram/writers/report',false)).status,401);assert.equal(calls,0);const r=await post(url+'/v1/telegram/writers/report');assert.equal(r.status,409);assert.equal((await r.json()).status,'WRITER_RECEIPT_UNCONFIRMED');assert.equal(calls,1)});
});
test('completion remains behind the existing Guard authentication',async()=>{
 let calls=0;await run({telegramAttempts:{begin(){},block(){},async complete(){calls++;return {status:'WRITER_COMPLETION_UNCONFIRMED'}}}},async url=>{assert.equal((await post(url+'/v1/telegram/attempts/complete',false)).status,401);assert.equal(calls,0);assert.equal((await (await post(url+'/v1/telegram/attempts/complete')).json()).status,'WRITER_COMPLETION_UNCONFIRMED');assert.equal(calls,1)});
});
test('reconciliation observations remain private and never report a write permission',async()=>{
 let calls=0;await run({telegramReconciliation:async()=>{calls++;return {status:'RECONCILIATION_REQUIRED',writeAuthorized:false,consistentSnapshot:false}}},async url=>{assert.equal((await post(url+'/v1/telegram/reconciliation/observe',false)).status,401);assert.equal(calls,0);const body=await (await post(url+'/v1/telegram/reconciliation/observe')).json();assert.equal(body.writeAuthorized,false);assert.equal(body.consistentSnapshot,false);assert.equal(calls,1)});
});
test('update jobs authenticate before their one-use payload can be resolved',async()=>{
 let calls=0;await run({telegramUpdateDeliveries:{async consume(){calls++;return {status:'UPDATE_DELIVERY_UNCONFIRMED',retryPermitted:false}}}},async url=>{const path='/v1/telegram/update-deliveries/consume';assert.equal((await post(url+path,false)).status,401);assert.equal(calls,0);assert.equal((await post(url+path)).status,409);assert.equal(calls,1)});
});
