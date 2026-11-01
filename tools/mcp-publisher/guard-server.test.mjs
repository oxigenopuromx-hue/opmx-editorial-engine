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
 const response=await call(secret,input);assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'claimed',identity:'matched',action:'manual_reconciliation'});
 const timeout=await call(secret,{requestId:input.requestId});assert.equal(timeout.status,200);assert.deepEqual(await timeout.json(),{status:'claimed',identity:'unverified',action:'manual_reconciliation'});assert.equal(queries,2);
 } finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('rutas de avance exigen autenticación y rechazan un segundo inicio',async()=>{
 let row=null;const db={async getConnection(){return {async execute(sql,args){
  if(sql.startsWith('INSERT')){if(row)throw Object.assign(new Error(),{code:'ER_DUP_ENTRY'});row={status:'writing',post_id:null};return [{affectedRows:1}]}
  if(sql.startsWith('UPDATE')){if(!row||row.status!=='writing')return [{affectedRows:0}];row={status:'reported',post_id:args[0]};return [{affectedRows:1}]}
  if(sql.startsWith('SELECT'))return [[...(row?[row]:[])]];throw new Error('SQL inesperado');
 },release(){}}}};
 const server=createGuard({pool:db,secret});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {const base=`http://127.0.0.1:${server.address().port}/v1/targets/`;
 const input={requestId:payload.requestId,slug:payload.slug,destination:'OPURO'};
 const call=(path,body,token=secret)=>fetch(base+path,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await call('begin',input,'bad')).status,401);assert.equal(row,null);
 assert.equal((await call('begin',input)).status,200);assert.equal((await call('begin',input)).status,409);
 assert.equal((await call('report',{...input,postId:123})).status,200);
 const status=await call('status',input);assert.deepEqual(await status.json(),{status:'reported',postId:'123',action:'manual_reconciliation'});
 assert.equal((await call('report',{...input,postId:123})).status,409);
 } finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('limita la frecuencia incluso cuando falla la autenticación',async()=>{
 const server=createGuard({pool,secret}); await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {const url=`http://127.0.0.1:${server.address().port}/v1/reservations`;
  for(let i=0;i<120;i++) assert.equal((await fetch(url,{method:'POST'})).status,401);
  assert.equal((await fetch(url,{method:'POST'})).status,429);
 } finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('rutas media requieren autenticación y nunca repiten una carga',async()=>{
 let row=null;const db={async getConnection(){return {async execute(sql,args){
  if(sql.startsWith('INSERT')){if(row)throw Object.assign(new Error(),{code:'ER_DUP_ENTRY'});row={status:'uploading',media_id:null};return [{affectedRows:1}]}
  if(sql.startsWith('UPDATE')){if(!row||row.status!=='uploading')return [{affectedRows:0}];row={status:'reported',media_id:args[0]};return [{affectedRows:1}]}
  if(sql.startsWith('SELECT'))return [[...(row?[row]:[])]];throw new Error('SQL inesperado');
 },release(){}}}};
 const server=createGuard({pool:db,secret});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {const base=`http://127.0.0.1:${server.address().port}/v1/media/`;
 const input={requestId:payload.requestId,slug:payload.slug,destination:'OPURO',role:'hero'};
 const call=(path,body,token=secret)=>fetch(base+path,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await call('begin',input,'bad')).status,401);assert.equal(row,null);
 assert.equal((await call('begin',{...input,extra:true})).status,400);
 assert.equal((await call('begin',input)).status,200);assert.equal((await call('begin',input)).status,409);
 assert.equal((await call('report',{...input,mediaId:123})).status,200);
 const status=await call('status',input);assert.deepEqual(await status.json(),{status:'reported',mediaId:'123',action:'manual_reconciliation'});
 assert.equal((await call('report',{...input,mediaId:123})).status,409);
 } finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('diagnóstico de contención no filtra datos y conserva respuesta incierta',async()=>{
 const messages=[];let code='ER_LOCK_DEADLOCK';
 const db={async getConnection(){return {async execute(){throw Object.assign(new Error('SQL y secreto privado'),{code})},release(){}}}};
 const server=createGuard({pool:db,secret,diagnosticLogger:msg=>messages.push(msg)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {
  const url=`http://127.0.0.1:${server.address().port}/v1/media/begin`;
  const input={requestId:payload.requestId,slug:payload.slug,destination:'OPURO',role:'hero'};
  const call=()=>fetch(url,{method:'POST',headers:{authorization:'Bearer '+secret,'content-type':'application/json'},body:JSON.stringify(input)});
  for(const candidate of ['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT','SQL y secreto privado']) {
   code=candidate;const result=await call();assert.equal(result.status,503);assert.deepEqual(await result.json(),{error:'not_confirmed'});
  }
  assert.deepEqual(messages,['guard.media.begin: ER_LOCK_DEADLOCK','guard.media.begin: ER_LOCK_WAIT_TIMEOUT','guard.media.begin: OTHER']);
 } finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
});
