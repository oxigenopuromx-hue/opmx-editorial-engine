import assert from 'node:assert/strict';
import {createGuard} from './tools/mcp-publisher/guard-server.mjs';
const secret='a'.repeat(64);let calls=0;
const server=createGuard({pool:{getConnection:async()=>{throw Error('unexpected db')}},secret,telegramDuplicateCancellation:async input=>{calls++;return {status:input.revision===9?'CANCELLED':'STALE_REVISION'}}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try {
 const base=`http://127.0.0.1:${server.address().port}/v1/telegram/packages/cancel-duplicate`;
 const request=(authorization,body)=>fetch(base,{method:'POST',headers:{authorization,'content-type':'application/json'},body:JSON.stringify(body)});
 let r=await request('Bearer invalid',{revision:9});assert.equal(r.status,401);assert.equal(calls,0);
 r=await request('Bearer '+secret,{revision:8});assert.equal(r.status,200);assert.equal((await r.json()).status,'STALE_REVISION');
 r=await request('Bearer '+secret,{revision:9});assert.equal(r.status,200);assert.equal((await r.json()).status,'CANCELLED');assert.equal(calls,2);
 console.log('PASS: ruta autenticada y respuestas HTTP de cancelación');
}finally{await new Promise(resolve=>server.close(resolve))}
