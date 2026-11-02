import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectRecovery} from './reconcile.mjs';

const input={requestId:'opmx_request_example_123',slug:'prueba-editorial',destination:'OPURO',fingerprint:'a'.repeat(64)};
const secret='f'.repeat(64);
test('consulta únicamente estados autenticados y nunca autoriza reintento',async()=>{
 const calls=[];const payloads=[{status:'claimed',identity:'matched'},{status:'reported',postId:'123'},{status:'reported',mediaId:'456'},{status:'uploading',mediaId:null}];
 const result=await inspectRecovery(input,{secret,fetchImpl:async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>payloads[calls.length-1]}}});
 assert.equal(calls.length,4);assert.ok(calls.every(c=>c.url.startsWith('https://publisher.oxigenopuro.com.mx/v1/')&&c.url.endsWith('/status')&&c.opts.method==='POST'&&c.opts.redirect==='error'));
 assert.equal(result.observed.reservation.identity,'matched');assert.equal(result.observed.target.id,'123');assert.equal(result.observed.hero.id,'456');assert.equal(result.observed.featured.status,'uploading');
 assert.equal(result.retryPermitted,false);assert.equal(JSON.stringify(result).includes(secret),false);
});
test('identidad incorrecta detiene las demás consultas y nunca autoriza reenvío',async()=>{
 let calls=0;const result=await inspectRecovery(input,{secret,fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({status:'identity_mismatch'})}}});
 assert.equal(calls,1);assert.equal(result.observed.reservation.status,'identity_mismatch');assert.equal(result.observed.target.status,'not_queried');assert.equal(result.observed.hero.status,'not_queried');
 assert.equal(result.retryPermitted,false);assert.equal(JSON.stringify(result).includes(secret),false);
});
test('ausencia, respuestas desconocidas y errores mantienen el bloqueo y no exponen datos',async()=>{
 const payloads=[{status:'claimed',identity:'matched'},{status:'not_found'},{status:'surprising',message:secret},null];let i=0;
 const result=await inspectRecovery(input,{secret,fetchImpl:async()=>{const data=payloads[i++];if(data===null)throw new Error(secret);return {ok:true,json:async()=>data}}});
 assert.equal(result.observed.target.status,'not_found');assert.equal(result.observed.hero.status,'unavailable');assert.equal(result.observed.featured.status,'unavailable');assert.equal(result.retryPermitted,false);assert.equal(JSON.stringify(result).includes(secret),false);
});
test('OPOL sólo consulta destacada y rechaza identidades inválidas antes de red',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;return {ok:true,json:async()=>calls===1?{status:'claimed',identity:'matched'}:{status:'not_found'}}};
 const result=await inspectRecovery({...input,destination:'OPOL'},{secret,fetchImpl});assert.equal(calls,3);assert.equal(result.observed.hero,undefined);assert.equal(result.retryPermitted,false);
 await assert.rejects(inspectRecovery({...input,slug:'../../wp'},{secret,fetchImpl}),/inválida/);assert.equal(calls,3);
});
test('interpreta estados observados en guard real sin presumir que existe un adjunto',async()=>{
 const responses=[{status:'claimed',identity:'matched',action:'manual_reconciliation'},{status:'writing',postId:null,action:'manual_reconciliation'},{status:'uploading',mediaId:null,action:'manual_reconciliation'},{status:'uploading',mediaId:null,action:'manual_reconciliation'}];let i=0;
 const result=await inspectRecovery(input,{secret,fetchImpl:async()=>({ok:true,json:async()=>responses[i++]})});
 assert.deepEqual(result.observed,{reservation:{status:'claimed',identity:'matched'},target:{status:'writing'},hero:{status:'uploading'},featured:{status:'uploading'}});
 assert.equal(result.retryPermitted,false);
});
