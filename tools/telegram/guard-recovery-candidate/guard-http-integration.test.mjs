import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuard} from './deployed-guard/guard-server.mjs';
import {request} from 'node:http';
import {createReopenService} from './reopen-service.mjs';

const secret='a'.repeat(64),pool={async getConnection(){throw Error('unexpected database access')}};
async function withServer(options,fn){
 const server=createGuard({pool,secret,...options});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await fn(server.address().port)}finally{await new Promise(resolve=>server.close(resolve))}
}
function post(port,path,body,token=secret){return new Promise((resolve,reject)=>{
 const r=request({hostname:'127.0.0.1',port,path,method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'}},res=>{
   let b='';res.on('data',x=>b+=x);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(b)}));
 });r.on('error',reject);r.end(JSON.stringify(body));
});}
test('reopen endpoint remains absent without configured provider',async()=>withServer({},async port=>{
 assert.equal((await post(port,'/v1/telegram/packages/reopen',{})).status,404);
}));
test('reopen endpoint enforces bearer authentication and delegates once',async()=>{
 let seen=[];const input={owner:'123',chat:'123',packageId:'tg_'+'a'.repeat(40),receiptId:'telegram-123-1-2'};
 await withServer({telegramRecovery:async x=>{seen.push(x);return {status:'RECONCILIATION_REQUIRED'}}},async port=>{
  assert.equal((await post(port,'/v1/telegram/packages/reopen',input,'b'.repeat(64))).status,401);assert.equal(seen.length,0);
  let r=await post(port,'/v1/telegram/packages/reopen',input);assert.equal(r.status,200);assert.equal(r.body.status,'RECONCILIATION_REQUIRED');assert.deepEqual(seen,[input]);
 });
});
test('target begin delegates only through the configured writer hook',async()=>{
 const input={requestId:'tg_'+'a'.repeat(64),slug:'nota-prueba',destination:'OPURO'};let calls=0;
 await withServer({targetBegin:async(p,x)=>{calls++;assert.equal(p,pool);assert.deepEqual(x,input);return {status:'already_started'}}},async port=>{
  const r=await post(port,'/v1/targets/begin',input);assert.equal(r.status,409);assert.equal(calls,1);
 });
});
test('real reopen handler rejects spoofed identity and fails closed without a safety provider',async()=>{
 let transactions=0;
 const db={async transaction(fn){transactions++;return fn({
  async lockQuota(){},async lockPackage(id){return {id,ownerKey:'other',state:'READY',revision:7}},
 });}};
 const recovery=createReopenService({db,adminUserIds:[]});
 const input={owner:'123',chat:'999',packageId:'tg_'+'a'.repeat(40),receiptId:'telegram-123-1-2'};
 await withServer({telegramRecovery:recovery},async port=>{
  let r=await post(port,'/v1/telegram/packages/reopen',input);assert.equal(r.body.status,'INVALID_REQUEST');assert.equal(transactions,0);
  r=await post(port,'/v1/telegram/packages/reopen',{...input,chat:'123'});assert.equal(r.body.status,'NOT_FOUND');assert.equal(transactions,1);
 });
});
