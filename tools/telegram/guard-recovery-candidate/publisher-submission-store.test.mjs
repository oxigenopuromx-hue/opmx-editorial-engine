import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalUpdateValue} from './canonical-json.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {createPublisherSubmissionStore,readPublisherSubmissionResultInTransaction,readSubmissionCompletedWriterReceipt} from './publisher-submission-store.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const owner='123456',other='987654',admin='555555';
const packageId='tg_'+'a'.repeat(40),revision=23,eventId='evt_'+'b'.repeat(48),destination='TODOS',slug='nota-de-prueba';
const requestId=expectedDraftRequestId({packageId,revision,destination});
const actorKey=sha(`opmx:telegram:v1:${owner}:${owner}`);
const original={owner,chat:owner,requestId,phase:'PUBLISH',destination,slug,executionId:'100',fingerprint:'c'.repeat(64)};
const fields=['requestId','packageId','revision','eventId','phase','destination','slug','fingerprint','executionId','actorKey'];
const columns=['request_id','package_id','revision','event_id','phase','destination','slug','fingerprint','execution_id','actor_key'];
const submission=(patch={})=>{
 const r={requestId,packageId,revision,eventId,phase:'PUBLISH',destination,slug,fingerprint:original.fingerprint,executionId:'100',actorKey,...patch};
 return {...Object.fromEntries(fields.map((k,i)=>[columns[i],r[k]])),submission_hash:sha(canonicalUpdateValue(r)),state:'SUBMITTED',telegram_notice:'NOT_RECORDED',receipt_hash:null};
};
const receipt=(phase='PUBLISH',patch={})=>{
 const value={requestId,packageId,revision,phase,slug,targets:[{destination:'OPURO',postId:101},{destination:'OPOL',postId:202},{destination:'LIBERAL',postId:303}],...patch};
 const text=canonicalUpdateValue(value);
 return {request_id:value.requestId,phase:value.phase,receipt_hash:sha(text),receipt_json:text};
};

// A transactional, deliberately strict SQL fake. Tests exercise authorization,
// exactly-once continuation and phase receipts without a network/CMS writer.
function database(options={}){
 const db={row:options.row??null,receipt:options.receipt??null,claim:options.claim??true,ownerKey:actorKey,packState:'READY',packRevision:revision,attemptState:'RUNNING',attemptEvent:eventId,fenceState:'READY_TO_WRITE',binding:{package_id:packageId,revision},kind:'TELEGRAM',queries:[],commits:0,rollbacks:0,releases:0,inserts:0,updates:0,scopeCalls:0,decisions:[],closures:[],quotaPresent:true,updateAffectedRows:1,...options};
 function connection(){
  let txRow=structuredClone(db.row),transaction=false;
  const c={
   async beginTransaction(){transaction=true;txRow=structuredClone(db.row);},
   async commit(){db.commits++;if(db.failCommit==='before')throw Error('COMMIT_LOST');db.row=structuredClone(txRow);transaction=false;if(db.failCommit==='after')throw Error('COMMIT_ACK_LOST');},
   async rollback(){db.rollbacks++;if(transaction)txRow=structuredClone(db.row);transaction=false;},
   release(){db.releases++;},
   async execute(sql,params=[]){
    db.queries.push({sql,params});
    if(db.failQuery?.(sql))throw Error('READ_UNAVAILABLE');
    if(sql.startsWith('SELECT id FROM opmx_tg_quota'))return [db.quotaPresent?[{id:1}]:[]];
    if(sql.startsWith('SELECT package_id,revision FROM opmx_tg_request_binding'))return [db.binding?[structuredClone(db.binding)]:[]];
    if(sql.startsWith('SELECT state,revision,owner_key FROM opmx_tg_packages'))return [[{state:db.packState,revision:db.packRevision,owner_key:db.ownerKey}]];
    if(sql.startsWith('SELECT state,revision FROM opmx_tg_packages'))return [[{state:db.packState,revision:db.packRevision}]];
    if(sql.startsWith('SELECT state,event_id FROM opmx_tg_motor_attempts'))return [db.noAttempts?[]:[{state:db.attemptState,event_id:db.attemptEvent}]];
    if(sql.startsWith('SELECT state FROM opmx_tg_publication_fence'))return [[{state:db.fenceState}]];
    if(sql.startsWith('SELECT * FROM opmx_tg_publisher_submissions'))return [txRow&&(!sql.includes('WHERE request_id=?')||txRow.request_id===params[0])?[structuredClone(txRow)]:[]];
    if(sql.startsWith('SELECT kind FROM opmx_tg_request_class'))return [db.kind?[{kind:db.kind}]:[]];
    if(sql.startsWith('INSERT INTO opmx_tg_publisher_submissions')){
     db.inserts++;if(txRow)throw Error('DUPLICATE');
     txRow={...Object.fromEntries(columns.map((k,i)=>[k,params[i]])),submission_hash:params[10],state:'SUBMITTED',telegram_notice:'NOT_RECORDED',receipt_hash:null};
     return [{affectedRows:db.insertAffectedRows??1}];
    }
    if(sql.startsWith('UPDATE opmx_tg_publisher_submissions')){
     db.updates++;if(db.updateAffectedRows===1)txRow={...txRow,state:params[0],telegram_notice:params[1],receipt_hash:params[2]};
     return [{affectedRows:db.updateAffectedRows}];
    }
    if(sql.startsWith('SELECT event_id FROM opmx_tg_events'))return [[{event_id:params[2]}]];
    if(sql.startsWith('SELECT decision_json FROM opmx_tg_confirmed_decisions'))return [structuredClone(db.decisions)];
    if(sql.startsWith('SELECT package_id FROM opmx_tg_recovery_closures'))return [structuredClone(db.closures)];
    if(sql.startsWith('SELECT request_id FROM opmx_tg_publication_claims'))return [db.claim?[{request_id:requestId}]:[]];
    if(sql.startsWith('SELECT request_id,phase,receipt_hash,receipt_json FROM opmx_tg_writer_receipts'))return [db.receipt&&db.receipt.phase===params[2]?[structuredClone(db.receipt)]:[]];
    throw Error('UNEXPECTED_SQL: '+sql);
   }
  };
  return c;
 }
 db.connection=connection;db.pool={getConnection:async()=>connection()};db.store=createPublisherSubmissionStore({pool:db.pool,adminUserIds:[admin],readOriginalScope:async(c,scope)=>{db.scopeCalls++;assert.deepEqual(scope,{packageId,revision});if(db.scopeError)throw Error('ORIGINAL_SCOPE_UNCONFIRMED');return db.originalScope??null;}});
 return db;
}
const report=(patch={})=>({requestId,executionId:'100',fingerprint:original.fingerprint,outcome:'SUCCESS',telegramNotice:'SENT',...patch});
const read=db=>readPublisherSubmissionResultInTransaction(db.connection(),{pack:{package_id:packageId,revision}});
const completed=db=>readSubmissionCompletedWriterReceipt(db.connection(),{packageId,revision,eventId});

test('acceptance is committed with immutable exact scope and no terminal success',async()=>{
 const db=database(),r=await db.store.begin(original);
 assert.equal(r.status,'SUBMISSION_RECORDED');assert.equal(r.retryPermitted,false);assert.equal(r.writeAuthorized,false);
 assert.equal(db.commits,1);assert.equal(db.inserts,1);assert.deepEqual(db.row,submission());
 assert.equal(db.row.state,'SUBMITTED');assert.equal(db.row.receipt_hash,null);
 assert.deepEqual(db.queries.slice(0,6).map(x=>x.sql.split(' FROM ')[1]?.split(' ')[0]),['opmx_tg_quota_v1','opmx_tg_request_binding_v1','opmx_tg_packages_v1','opmx_tg_motor_attempts_v1','opmx_tg_publication_fence_v1','opmx_tg_publisher_submissions_v1']);
});
test('a same-scope retry by another execution is only a replay, never another insertion',async()=>{
 const db=database({row:submission(),fenceState:'WRITING'}),r=await db.store.begin({...original,executionId:'999'});
 assert.equal(r.status,'SUBMISSION_REPLAY');assert.equal(db.inserts,0);assert.equal(db.row.execution_id,'100');
});
for(const [name,patch] of Object.entries({fingerprint:{fingerprint:'d'.repeat(64)},phase:{phase:'DRAFT'},slug:{slug:'otra-nota'}}))test('same stable identity with changed '+name+' is rejected',async()=>{
 const db=database({row:submission()}),r=await db.store.begin({...original,...patch});
 assert.equal(r.status,'SUBMISSION_UNCONFIRMED');assert.equal(db.inserts,0);assert.deepEqual(db.row,submission());
});
test('foreign owner cannot accept or learn an existing submission',async()=>{
 const db=database({row:submission()}),r=await db.store.begin({...original,owner:other,chat:other});
 assert.equal(r.status,'SUBMISSION_UNCONFIRMED');assert.equal(Object.hasOwn(r,'packageId'),false);assert.equal(db.inserts,0);
 assert.equal(db.queries.some(x=>x.sql.startsWith('SELECT * FROM opmx_tg_publisher_submissions')),false);
});
test('configured administrator can accept on the existing package with actor provenance',async()=>{
 const db=database(),r=await db.store.begin({...original,owner:admin,chat:admin});
 assert.equal(r.status,'SUBMISSION_RECORDED');assert.equal(db.row.actor_key,sha(`opmx:telegram:v1:${admin}:${admin}`));assert.equal(db.ownerKey,actorKey);
});
for(const [name,options] of Object.entries({staleRevision:{packRevision:24},closedPackage:{packState:'OPEN'},unclaimed:{attemptState:'QUEUED'},awaitingDecision:{fenceState:'AWAITING_DECISION'},alreadyWriting:{fenceState:'WRITING'},nonTelegramClass:{kind:'DIRECT'},missingBinding:{binding:null}}))test('acceptance refuses '+name+' before continuation',async()=>{
 const db=database(options),r=await db.store.begin(original);assert.equal(r.status,'SUBMISSION_UNCONFIRMED');assert.equal(db.inserts,0);
});
test('a mismatched canonical binding cannot select a different package',async()=>{
 const db=database({binding:{package_id:'tg_'+'e'.repeat(40),revision}}),r=await db.store.begin(original);
 assert.equal(r.status,'SUBMISSION_UNCONFIRMED');assert.equal(db.inserts,0);
});
for(const patch of [{owner,chat:other},{phase:'UPDATE'},{executionId:'../100'},{fingerprint:'bad'},{destination:'OPOL,OPURO'},{extra:true}])test('malformed scope fails before a transaction '+JSON.stringify(patch),async()=>{
 const db=database(),r=await db.store.begin({...original,...patch});assert.equal(r.status,'SUBMISSION_UNCONFIRMED');assert.equal(db.queries.length,0);
});
test('unconfirmed insertion cannot produce an acceptance',async()=>{
 const db=database({insertAffectedRows:0}),r=await db.store.begin(original);assert.equal(r.status,'SUBMISSION_UNCONFIRMED');assert.equal(db.row,null);assert.equal(db.rollbacks,1);
});
test('failed commit does not claim acceptance',async()=>{
 const db=database({failCommit:'before'}),r=await db.store.begin(original);assert.equal(r.status,'SUBMISSION_UNCONFIRMED');assert.equal(db.row,null);assert.equal(db.rollbacks,1);
});
test('lost commit acknowledgement keeps durable scope and only permits a replay response',async()=>{
 const db=database({failCommit:'after'}),first=await db.store.begin(original);assert.equal(first.status,'SUBMISSION_UNCONFIRMED');assert.deepEqual(db.row,submission());
 db.failCommit=null;const replay=await db.store.begin({...original,executionId:'101'});assert.equal(replay.status,'SUBMISSION_REPLAY');assert.equal(db.inserts,1);assert.equal(db.row.execution_id,'100');
});
test('submission alone remains pending with no post IDs or completion proof',async()=>{
 const db=database({row:submission(),claim:false}),r=await read(db);
 assert.equal(r.status,'SUBMISSION_PENDING');assert.equal(r.currentCmsState,'NOT_CHECKED');assert.equal(r.publicVisibility,'NOT_CHECKED');assert.equal(Object.hasOwn(r,'targets'),false);assert.equal(await completed(db),null);
});
test('an authentic intermediate DRAFT cannot complete an intended PUBLISH',async()=>{
 const db=database({row:submission(),claim:false,receipt:receipt('DRAFT')});assert.equal((await read(db)).status,'SUBMISSION_PENDING');assert.equal(await completed(db),null);
 const result=await db.store.report(report());assert.equal(result.result,'SUBMISSION_UNCERTAIN');assert.equal(db.row.state,'UNCERTAIN');assert.equal(db.row.receipt_hash,null);
});
test('an intended DRAFT can complete only its authentic DRAFT result',async()=>{
 const db=database({row:submission({phase:'DRAFT'}),claim:false,receipt:receipt('DRAFT')});
 assert.equal((await read(db)).status,'WRITER_RESULT_CONFIRMED');assert.equal((await completed(db)).phase,'DRAFT');
});
test('publication result is historical with exact IDs and hash, no CMS/web/Telegram assumptions',async()=>{
 const saved=receipt(),db=database({row:submission(),receipt:saved}),r=await read(db);
 assert.equal(r.status,'WRITER_RESULT_CONFIRMED');assert.equal(r.historical,true);assert.equal(r.receiptHash,saved.receipt_hash);assert.equal(r.phase,'PUBLISH');assert.equal(r.telegramNotice,'NOT_RECORDED');assert.equal(r.currentCmsState,'NOT_CHECKED');assert.equal(r.publicVisibility,'NOT_CHECKED');
 assert.deepEqual(r.targets.map(x=>x.postId),[101,202,303]);assert.equal(r.targets.some(x=>Object.hasOwn(x,'public_url')),false);assert.equal(db.updates,0);
});
test('final report persists result only for the accepted execution and fingerprint',async()=>{
 const saved=receipt(),db=database({row:submission(),receipt:saved}),r=await db.store.report(report());
 assert.equal(r.status,'SUBMISSION_RESULT_RECORDED');assert.equal(r.result,'WRITER_RESULT_CONFIRMED');assert.equal(db.row.state,'COMPLETE');assert.equal(db.row.receipt_hash,saved.receipt_hash);assert.equal(db.row.telegram_notice,'SENT');assert.equal(db.updates,1);
});
for(const [name,patch] of Object.entries({anotherExecution:{executionId:'999'},changedPayload:{fingerprint:'d'.repeat(64)},changedRequest:{requestId:'tg_'+'f'.repeat(64)}}))test('report refuses '+name,async()=>{
 const db=database({row:submission(),receipt:receipt()}),r=await db.store.report(report(patch));assert.equal(r.status,'SUBMISSION_UNCONFIRMED');assert.equal(db.updates,0);assert.equal(db.row.state,'SUBMITTED');
});
test('report refuses an attempt event that changed after acceptance',async()=>{
 const db=database({row:submission(),receipt:receipt(),attemptEvent:'evt_'+'f'.repeat(48)}),r=await db.store.report(report());assert.equal(r.status,'SUBMISSION_UNCONFIRMED');assert.equal(db.updates,0);
});
test('uncertain workflow output never overrides an authentic final writer receipt',async()=>{
 const db=database({row:submission(),receipt:receipt()}),r=await db.store.report(report({outcome:'UNCERTAIN',telegramNotice:'UNCERTAIN'}));assert.equal(r.result,'WRITER_RESULT_CONFIRMED');assert.equal(db.row.state,'COMPLETE');assert.equal(db.row.telegram_notice,'UNCERTAIN');
});
test('Telegram delivery uncertainty cannot erase an earlier confirmed delivery',async()=>{
 const row={...submission(),telegram_notice:'SENT'},db=database({row,receipt:receipt()});await db.store.report(report({telegramNotice:'UNCERTAIN'}));assert.equal(db.row.telegram_notice,'SENT');
});
test('report with no affected row cannot claim durable result persistence',async()=>{
 const db=database({row:submission(),receipt:receipt(),updateAffectedRows:0}),r=await db.store.report(report());assert.equal(r.status,'SUBMISSION_UNCONFIRMED');assert.equal(db.row.state,'SUBMITTED');
});
test('missing submission preserves the legacy completed-receipt provider',async()=>{
 const db=database({receipt:receipt()});assert.equal(await read(db),undefined);assert.equal((await completed(db)).phase,'PUBLISH');
});
for(const [name,patch] of Object.entries({phase:{phase:'DRAFT'},slug:{slug:'otra-nota'},targets:{targets:[{destination:'OPURO',postId:101}]},package:{packageId:'tg_'+'d'.repeat(40)},revision:{revision:24}}))test('historical result refuses receipt with different '+name,async()=>{
 const db=database({row:submission(),receipt:receipt('PUBLISH',patch)});assert.equal((await read(db)).status,'SUBMISSION_PENDING');assert.equal(await completed(db),null);
});
test('a corrupted canonical submission hash is not treated as pending or confirmed',async()=>{
 const db=database({row:{...submission(),submission_hash:'f'.repeat(64)},receipt:receipt()});assert.equal((await read(db)).status,'SUBMISSION_UNCONFIRMED');assert.equal(await completed(db),null);
});
test('completion requires the registered submission event, even with a well-formed saved row',async()=>{
 const db=database({row:submission({eventId:'evt_'+'d'.repeat(48)}),receipt:receipt()});assert.equal(await completed(db),null);
});
test('read rejects a registered attempt event different from accepted intent',async()=>{
 const db=database({row:submission(),receipt:receipt(),attemptEvent:'evt_'+'e'.repeat(48)});assert.equal((await read(db)).status,'SUBMISSION_UNCONFIRMED');
});
test('one accepted PUBLISH progresses through DRAFT to confirmed final result without a second acceptance',async()=>{
 const db=database({claim:false});
 assert.equal((await db.store.begin(original)).status,'SUBMISSION_RECORDED');
 assert.equal((await read(db)).status,'SUBMISSION_PENDING');
 db.fenceState='WRITING';db.receipt=receipt('DRAFT');
 assert.equal((await read(db)).status,'SUBMISSION_PENDING');assert.equal(await completed(db),null);
 db.claim=true;db.receipt=receipt('PUBLISH');
 const beforeNotice=await read(db);assert.equal(beforeNotice.status,'WRITER_RESULT_CONFIRMED');assert.equal(beforeNotice.telegramNotice,'NOT_RECORDED');
 assert.equal((await db.store.report(report())).result,'WRITER_RESULT_CONFIRMED');
 const afterNotice=await read(db);assert.equal(afterNotice.telegramNotice,'SENT');assert.equal(afterNotice.receiptHash,db.receipt.receipt_hash);
 db.attemptState='COMPLETED';db.fenceState='RECONCILING';
 assert.equal((await completed(db)).phase,'PUBLISH');assert.equal((await read(db)).status,'WRITER_RESULT_CONFIRMED');assert.equal(db.inserts,1);
});
test('a completed DRAFT delivery stays historically confirmed after a later same-request publication claim',async()=>{
 const saved=receipt('DRAFT'),row={...submission({phase:'DRAFT'}),state:'COMPLETE',telegram_notice:'SENT',receipt_hash:saved.receipt_hash};
 const db=database({row,claim:true,receipt:saved,attemptState:'COMPLETED',fenceState:'RECONCILING'}),r=await read(db);
 assert.equal(r.status,'WRITER_RESULT_CONFIRMED');assert.equal(r.phase,'DRAFT');assert.equal(r.historical,true);assert.equal(r.receiptHash,saved.receipt_hash);assert.equal(r.targets.every(t=>t.status==='draft'),true);assert.equal(r.currentCmsState,'NOT_CHECKED');
});
test('an intended PUBLISH without its real publication claim cannot be confirmed by even a valid-looking PUBLISH receipt',async()=>{
 const db=database({row:submission(),claim:false,receipt:receipt('PUBLISH')});
 assert.equal((await read(db)).status,'SUBMISSION_PENDING');assert.equal(await completed(db),null);
 assert.equal((await db.store.report(report())).result,'SUBMISSION_UNCERTAIN');assert.equal(db.row.receipt_hash,null);
});
test('a DRAFT attempt cannot close while a subsequent PUBLISH claim is active without a final PUBLISH receipt',async()=>{
 const db=database({row:submission({phase:'DRAFT'}),claim:true,receipt:receipt('DRAFT'),attemptState:'RUNNING',fenceState:'WRITING'});
 assert.equal((await read(db)).status,'WRITER_RESULT_CONFIRMED');
 assert.equal(await completed(db),null);
 assert.equal(db.updates,0);assert.equal(db.attemptState,'RUNNING');assert.equal(db.fenceState,'WRITING');
});

const originalEditorialScope={packageId,revision,ownerKey:actorKey,contentMode:'EDITORIAL',destination,previewHash:null};
test('a verified historical EDITORIAL package without any attempt preserves only the original synchronous path',async()=>{
 const db=database({noAttempts:true,originalScope:originalEditorialScope}),r=await db.store.begin(original);
 assert.equal(r.status,'SUBMISSION_SYNC_REQUIRED');assert.equal(r.legacyHistorical,true);assert.equal(r.phase,'PUBLISH');assert.equal(r.requestId,requestId);assert.equal(r.writeAuthorized,false);assert.equal(r.retryPermitted,false);
 assert.equal(Object.hasOwn(r,'submissionHash'),false);assert.equal(db.scopeCalls,1);assert.equal(db.inserts,0);assert.equal(db.updates,0);assert.equal(db.row,null);assert.equal(db.commits,1);
});
test('administrator provenance does not replace the historical package owner used by the authoritative reader',async()=>{
 const db=database({noAttempts:true,originalScope:originalEditorialScope}),r=await db.store.begin({...original,owner:admin,chat:admin});
 assert.equal(r.status,'SUBMISSION_SYNC_REQUIRED');assert.equal(db.ownerKey,actorKey);assert.equal(db.inserts,0);
});
for(const [name,patch] of Object.entries({literal:{contentMode:'LITERAL'},differentDestination:{destination:'OPURO'},confirmedPreview:{previewHash:'f'.repeat(64)},differentOwner:{ownerKey:'e'.repeat(64)},differentPackage:{packageId:'tg_'+'d'.repeat(40)},differentRevision:{revision:24}}))test('historical compatibility refuses authoritative scope '+name,async()=>{
 const db=database({noAttempts:true,originalScope:{...originalEditorialScope,...patch}}),r=await db.store.begin(original);assert.equal(r.status,'SUBMISSION_UNCONFIRMED');assert.equal(db.inserts,0);assert.equal(db.row,null);
});
for(const [name,options] of Object.entries({missingScope:{originalScope:null},unreadableScope:{scopeError:true},existingSubmission:{row:submission()},recoveredDecision:{decisions:[{decision_json:'{}'}]},recoveryClosure:{closures:[{package_id:packageId}]},writingFence:{fenceState:'WRITING'},missingQuota:{quotaPresent:false},missingBinding:{binding:null}}))test('historical compatibility is not an error fallback: '+name,async()=>{
 const db=database({noAttempts:true,originalScope:originalEditorialScope,...options}),r=await db.store.begin(original);assert.equal(r.status,'SUBMISSION_UNCONFIRMED');assert.equal(db.inserts,0);assert.equal(db.updates,0);
});
test('historical compatibility cannot bypass the original owner authorization',async()=>{
 const db=database({noAttempts:true,originalScope:originalEditorialScope}),r=await db.store.begin({...original,owner:other,chat:other});assert.equal(r.status,'SUBMISSION_UNCONFIRMED');assert.equal(db.scopeCalls,0);assert.equal(db.inserts,0);
});
test('a queued modern attempt never falls back to the historical synchronous writer',async()=>{
 const db=database({attemptState:'QUEUED',originalScope:originalEditorialScope}),r=await db.store.begin(original);assert.equal(r.status,'SUBMISSION_UNCONFIRMED');assert.equal(db.scopeCalls,0);assert.equal(db.inserts,0);
});
