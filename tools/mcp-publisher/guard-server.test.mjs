import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGuard} from './guard-server.mjs';

const secret='f'.repeat(64);
const payload={requestId:'request_1234567890',fingerprint:'a'.repeat(64),slug:'prueba-editorial',destinations:['OPURO']};
const pool={async getConnection(){return {async beginTransaction(){},async execute(){},async commit(){},async rollback(){},release(){}}}};
test('HTTP exige secreto y sólo acepta reservas limitadas',async()=>{
 const server=createGuard({pool,secret}); await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {
  const url=`http://127.0.0.1:${server.address().port}/v1/reservations`;
  const call=(body,token=secret)=>fetch(url,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await call(payload,'incorrect')).status,401);
  assert.equal((await call({...payload,slug:'../../test'})).status,400);
  assert.equal((await call({...payload,extra:'x'})).status,400);
  const ok=await call(payload);assert.equal(ok.status,201);assert.deepEqual(await ok.json(),{status:'claimed'});
 } finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('falla cerrado ante secreto inválido',()=>assert.throws(()=>createGuard({pool,secret:'corto'}),/Configuración/));
test('consulta de estado exige autenticación y no libera ni reintenta reservas',async()=>{
 let queries=0;const readPool={async getConnection(){return {async execute(sql){queries++;assert.match(sql,/^SELECT /);return [[{fingerprint:payload.fingerprint,status:'claimed'}]]},release(){}}}};
 const server=createGuard({pool:readPool,secret});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {const url=`http://127.0.0.1:${server.address().port}/v1/reservations/status`;
 const call=(token,body)=>fetch(url,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
 const input={requestId:payload.requestId,fingerprint:payload.fingerprint};
 assert.equal((await call('incorrect',input)).status,401);assert.equal(queries,0);
 assert.equal((await call(secret,{...input,extra:true})).status,400);
 const response=await call(secret,input);assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'claimed',action:'manual_reconciliation'});assert.equal(queries,1);
 } finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('limita la frecuencia incluso cuando falla la autenticación',async()=>{
 const server=createGuard({pool,secret}); await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {const url=`http://127.0.0.1:${server.address().port}/v1/reservations`;
  for(let i=0;i<120;i++) assert.equal((await fetch(url,{method:'POST'})).status,401);
  assert.equal((await fetch(url,{method:'POST'})).status,429);
 } finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
});
