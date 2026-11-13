import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {copyFile, mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {canonicalUpdateValue} from './canonical-json.mjs';
import {createDestinationCancellationEnforcement} from './destination-cancellation-enforcement.mjs';

// Exercise the current HTTP body byte for byte, rather than the older checked
// in deployed-guard snapshot. Its three publisher dependencies are unchanged
// runtime files retained in that audited snapshot; no source file is replaced.
const temporary=await mkdtemp(join(tmpdir(),'opmx-issue29-http-'));
await copyFile(new URL('../../mcp-publisher/guard-server.mjs',import.meta.url),join(temporary,'guard-server.mjs'));
for(const name of ['direct-claim.mjs','target-progress.mjs','media-progress.mjs'])await copyFile(new URL('./deployed-guard/'+name,import.meta.url),join(temporary,name));
assert.deepEqual(await readFile(join(temporary,'guard-server.mjs')),await readFile(new URL('../../mcp-publisher/guard-server.mjs',import.meta.url)));
const {createGuard}=await import(pathToFileURL(join(temporary,'guard-server.mjs')).href);
after(()=>rm(temporary,{recursive:true,force:true}));

const secret='a'.repeat(64),packageId='tg_00991fbbd87a751fb8513f4d4f6fcebca8469bee',requestId='tg_e6400942bcd85878aaa03f722f03b7644261071d6339593c2dede692f582edbf';
const scope={owner:'123',chat:'123',packageId,revision:10,requestId,destination:'LIBERAL',postId:393,operationId:'github-issue29-test-cancel'};
function cancellationRow({corruptHash=false}={}){
 const slug='simey-olvera-innovacion-tecnologica-reducir-desigualdades',eventId='evt_'+'a'.repeat(48),actorKey='b'.repeat(64),ownerKey='c'.repeat(64),operationId='requested-20261113-issue29-simey-liberal';
 const evidence={schema:'opmx.destination-cancellation.v1',packageId,revision:10,requestId,destination:'LIBERAL',postId:393,operationId,eventId,actorKey,ownerKey,results:[['OPURO',10493],['OPOL',3515],['LIBERAL',393]].map(([destination,postId],i)=>({destination,postId,originalSlug:slug,slug:i<2?slug:slug+'__trashed',status:i<2?'PUBLISHED':'TRASH',wordpressStatus:i<2?'publish':'trash',cmsVerified:true,publicationVerdict:'CMS_RECORD_CONFIRMED'})),observedAt:'2026-11-13T15:00:00.000Z',writerRelease:'opmx.fenced-writer-release.v1',processTerminationClaimed:false};
 const evidence_json=canonicalUpdateValue(evidence),evidence_hash=corruptHash?'0'.repeat(64):createHash('sha256').update(evidence_json).digest('hex');
 return {package_id:packageId,revision:10,request_id:requestId,destination:'LIBERAL',post_id:393,operation_id:operationId,event_id:eventId,actor_key:actorKey,owner_key:ownerKey,evidence_json,evidence_hash};
}
const noDatabase={getConnection(){throw Error('UNEXPECTED_DATABASE_ACCESS')}};
async function running(options,fn){
 const server=createGuard({pool:noDatabase,secret,...options});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const post=(path,body=scope,authorization=secret)=>fetch('http://127.0.0.1:'+server.address().port+path,{method:'POST',headers:{'content-type':'application/json',...(authorization===null?{}:{authorization:'Bearer '+authorization})},body:JSON.stringify(body)});
  await fn(post);
 }finally{await new Promise(resolve=>server.close(resolve))}
}
const denied={status:'DESTINATION_PERMISSION_NOT_CONFIRMED',writeAuthorized:false,retryPermitted:false};

test('issue29 administrative endpoints authenticate before every service or gate call',async()=>{
 const calls=[];
 await running({telegramDestinationCancellation:{allowed:async()=>{calls.push('gate');return true},cancel:async()=>{calls.push('cancel');return {}},observe:async()=>{calls.push('observe');return {}}},telegramRecoveryReadiness:async()=>{calls.push('readiness');return {}}},async post=>{
  for(const path of ['/v1/telegram/destination-cancellations/cancel','/v1/telegram/destination-cancellations/observe','/v1/telegram/reconciliation/recovery-readiness']){
   assert.equal((await post(path,scope,null)).status,401);
   assert.equal((await post(path,scope,'f'.repeat(64))).status,401);
  }
  assert.deepEqual(calls,[]);
 });
});

test('cancel, cancellation observation and recovery readiness remain distinct bounded hooks',async()=>{
 const calls=[];
 const service=name=>async input=>{calls.push([name,input]);return {status:name,writeAuthorized:false,retryPermitted:false}};
 await running({telegramDestinationCancellation:{allowed:async()=>true,cancel:service('DESTINATION_CANCELLED'),observe:service('DELIVERY_CANCELLATION_CONFIRMED')},telegramRecoveryReadiness:service('RECOVERY_READY_REQUIRES_BOT_OPEN')},async post=>{
  for(const [path,status] of [['/v1/telegram/destination-cancellations/cancel','DESTINATION_CANCELLED'],['/v1/telegram/destination-cancellations/observe','DELIVERY_CANCELLATION_CONFIRMED'],['/v1/telegram/reconciliation/recovery-readiness','RECOVERY_READY_REQUIRES_BOT_OPEN']]){
   const response=await post(path);assert.equal(response.status,200);assert.deepEqual(await response.json(),{status,writeAuthorized:false,retryPermitted:false});
  }
  assert.deepEqual(calls.map(x=>x[0]),['DESTINATION_CANCELLED','DELIVERY_CANCELLATION_CONFIRMED','RECOVERY_READY_REQUIRES_BOT_OPEN']);
  assert.ok(calls.every(x=>JSON.stringify(x[1])===JSON.stringify(scope)));
 });
});

test('absent hooks do not expose a maintenance API and incomplete configuration fails before listening',async()=>{
 await running({},async post=>{
  for(const path of ['/v1/telegram/destination-cancellations/cancel','/v1/telegram/destination-cancellations/observe','/v1/telegram/reconciliation/recovery-readiness'])assert.equal((await post(path)).status,404);
 });
 for(const missing of ['allowed','cancel','observe']){
  const provider={allowed:async()=>true,cancel:async()=>({}),observe:async()=>({})};delete provider[missing];
  assert.throws(()=>createGuard({pool:noDatabase,secret,telegramDestinationCancellation:provider}),/Configuración incompleta/);
 }
 assert.throws(()=>createGuard({pool:noDatabase,secret,telegramRecoveryReadiness:{}}),/Configuración incompleta/);
});

test('real cancellation enforcement blocks late writers, preview inheritance and legacy reservation claims before providers',async()=>{
 const sql=[],providers=[];
 const pool={async getConnection(){return {async execute(statement){sql.push(statement);if(statement.includes('request_binding'))return [[{package_id:packageId}]];if(statement.includes('destination_cancellations'))return [[cancellationRow()]];if(statement.includes('correction_selections'))return [[]];throw Error('UNEXPECTED_SQL')},release(){}}}};
 const call=name=>async()=>{providers.push(name);throw Error('WRITER_MUST_NOT_RUN')};
 const allow=createDestinationCancellationEnforcement({pool});
 await running({pool,telegramDestinationCancellation:{allowed:allow,cancel:call('cancel'),observe:call('observe')},targetBegin:call('target'),mediaBegin:call('media'),telegramPublicationBegin:call('publication'),telegramSubmissions:{begin:call('submission'),report:call('submission-report')},telegramAttempts:{begin:call('attempt-begin'),block:call('attempt-block'),acknowledgeDecision:call('decision')},telegramCorrections:{preview:call('preview'),confirm:call('confirm')},telegramSelections:{select:call('select')},telegramPreviewPayloads:{stage:call('preview-payload'),context:call('preview-context')},telegramPreviewMaterializer:call('materialize'),telegramUpdateDeliveries:{consume:call('consume')},telegramUpdateClaims:{begin:call('update-begin')},telegramUpdateExecutor:{execute:call('update-execute')},telegramUpdatePayloads:{stage:call('update-payload')}},async post=>{
  const body={packageId,revision:50,requestId,destination:'LIBERAL',slug:'simey-test',role:'featured',targets:[{destination:'LIBERAL',postId:393}]};
  const paths=['/v1/targets/begin','/v1/media/begin','/v1/telegram/publications/begin','/v1/telegram/submissions/begin','/v1/telegram/attempts/decision','/v1/telegram/corrections/select','/v1/telegram/corrections/preview','/v1/telegram/corrections/confirm','/v1/telegram/previews/payload','/v1/telegram/previews/context','/v1/telegram/previews/materialize','/v1/telegram/update-deliveries/consume','/v1/telegram/updates/begin','/v1/telegram/updates/execute','/v1/telegram/updates/payload'];
  for(const path of paths){const response=await post(path,body);assert.equal(response.status,409,path);assert.deepEqual(await response.json(),denied,path)}
  const reservation=await post('/v1/reservations',{requestId,slug:'simey-test',destinations:['OPURO','OPOL','LIBERAL'],fingerprint:'d'.repeat(64)});assert.equal(reservation.status,409);assert.deepEqual(await reservation.json(),denied);
  const inherited=await post('/v1/telegram/corrections/preview',{packageId,revision:50,owner:'123',chat:'123'});assert.equal(inherited.status,409);assert.deepEqual(await inherited.json(),denied);
  assert.deepEqual(providers,[]);assert.ok(sql.length>0);assert.ok(sql.every(x=>x.startsWith('SELECT ')));
 });
});

test('noncancelled destinations still need their existing writer gate; cancellation check grants no publication itself',async()=>{
 let called=0;
 const pool={async getConnection(){return {async execute(sql){if(sql.includes('request_binding'))return [[{package_id:packageId}]];return [[cancellationRow()]]},release(){}}}};
 await running({pool,telegramDestinationCancellation:{allowed:createDestinationCancellationEnforcement({pool}),cancel:async()=>({}),observe:async()=>({})},targetBegin:async()=>{called++;return {status:'WRITE_NOT_PERMITTED',action:'manual_reconciliation'}}},async post=>{
  const response=await post('/v1/targets/begin',{requestId,destination:'OPURO',slug:'simey-test'});assert.equal(response.status,409);assert.deepEqual(await response.json(),{status:'WRITE_NOT_PERMITTED',action:'manual_reconciliation'});assert.equal(called,1);
 });
 const tampered={async getConnection(){return {async execute(sql){if(sql.includes('request_binding'))return [[{package_id:packageId}]];return [[cancellationRow({corruptHash:true})]]},release(){}}}};
 await running({pool:tampered,telegramDestinationCancellation:{allowed:createDestinationCancellationEnforcement({pool:tampered}),cancel:async()=>({}),observe:async()=>({})},targetBegin:async()=>{called++;throw Error('TAMPERED_EVIDENCE_MUST_NOT_REACH_WRITER')}},async post=>{
  const response=await post('/v1/targets/begin',{requestId,destination:'OPURO',slug:'simey-test'});assert.equal(response.status,409);assert.deepEqual(await response.json(),denied);assert.equal(called,1);
 });
});

test('existing manifest reads and durable completion reports remain available for cancelled package history',async()=>{
 const calls=[];
 const allow=createDestinationCancellationEnforcement({pool:noDatabase});
 await running({telegramDestinationCancellation:{allowed:allow,cancel:async()=>({}),observe:async()=>({})},telegramStore:{run:async(action,input)=>{calls.push(['store',action,input]);return {status:'PACKAGE_FOUND',readOnly:true}}},telegramWriterReceipts:{report:async input=>{calls.push(['receipt',input]);return {status:'WRITER_RECEIPT_REPLAY'}}},telegramSubmissions:{begin:async()=>({}),report:async input=>{calls.push(['submission-report',input]);return {status:'SUBMISSION_SYNC_REQUIRED'}}}},async post=>{
  const manifest=await post('/v1/telegram/packages/manifest',{packageId});assert.equal(manifest.status,200);assert.equal((await manifest.json()).status,'PACKAGE_FOUND');
  const receipt=await post('/v1/telegram/writers/report',{packageId,requestId});assert.equal(receipt.status,200);assert.equal((await receipt.json()).status,'WRITER_RECEIPT_REPLAY');
  const report=await post('/v1/telegram/submissions/report',{packageId,requestId});assert.equal(report.status,200);assert.equal((await report.json()).status,'SUBMISSION_SYNC_REQUIRED');
  assert.deepEqual(calls.map(x=>x[0]),['store','receipt','submission-report']);
 });
});

test('current HTTP body preserves the prior freeze and final-publication observers independently of new cancellation routes',async()=>{
 const calls=[];
 await running({telegramReconciliationFreeze:async input=>{calls.push(['freeze',input]);return {status:'UNWRITTEN_ATTEMPT_FROZEN',writeAuthorized:false}},telegramFinalPublication:async input=>{calls.push(['final',input]);return {status:'FINAL_PUBLICATION_UNCONFIRMED',writeAuthorized:false}}},async post=>{
  const frozen=await post('/v1/telegram/reconciliation/freeze-unwritten',{packageId,revision:9,owner:'123',chat:'123'});assert.equal(frozen.status,200);assert.equal((await frozen.json()).status,'UNWRITTEN_ATTEMPT_FROZEN');
  const final=await post('/v1/telegram/publications/observe-final',{packageId,revision:9});assert.equal(final.status,200);assert.equal((await final.json()).status,'FINAL_PUBLICATION_UNCONFIRMED');
  assert.deepEqual(calls.map(x=>x[0]),['freeze','final']);
  assert.equal((await post('/v1/telegram/destination-cancellations/observe')).status,404);
 });
});

test('service or gate failures return 503 without a cancellation, recovery or write acknowledgement',async()=>{
 for(const target of ['cancel','observe','readiness','allowed']){
  const crash=async()=>{throw Error('PRIVATE_DIAGNOSTIC_MUST_NOT_LEAK')};
  const cancellation={allowed:async()=>true,cancel:async()=>({status:'UNEXPECTED_ACK'}),observe:async()=>({status:'UNEXPECTED_ACK'})};
  if(target!=='readiness')cancellation[target]=crash;
  await running({telegramDestinationCancellation:cancellation,telegramRecoveryReadiness:target==='readiness'?crash:async()=>({})},async post=>{
   const path=target==='readiness'?'/v1/telegram/reconciliation/recovery-readiness':target==='allowed'?'/v1/telegram/destination-cancellations/cancel':'/v1/telegram/destination-cancellations/'+target;
   const response=await post(path);assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'not_confirmed'});
  });
 }
});
