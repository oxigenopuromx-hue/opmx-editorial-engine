import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createBlockedUnwrittenAttemptRecovery} from './blocked-unwritten-attempt-recovery.mjs';
import {createMotorAttemptStore} from './motor-attempt-store.mjs';
import {buildCorrectionPreview} from './correction-preview.mjs';
import {attestedControl} from './original-destination-policy.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {writerGraphFingerprint} from './writer-release-contract.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const packageId='tg_'+'a'.repeat(40),revision=12,eventId='evt_'+'b'.repeat(48),admin='12345',owner='99999';
const key=id=>hash(`opmx:telegram:v1:${id}:${id}`),ownerKey=key(owner),actor=key(admin);
const oldToken='c'.repeat(64),newToken='d'.repeat(64),time='2026-11-13T18:00:00.000Z';
const ids=['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'].map(destination=>expectedDraftRequestId({packageId,revision,destination}));
const itemId=n=>'ti_'+String(n).repeat(40);
function item(n,text,actorKey=null,receipt='old-'+n){return {itemId:itemId(n),ownerKey,receiptKey:hash(receipt),fingerprint:hash('fingerprint-'+n),kind:'TEXT',state:'STORED',text,attachment:null,reservedBytes:Buffer.byteLength(text),contentBytes:Buffer.byteLength(text),sha256:hash(text),actorKey};}

// Real readers, confirmed-preview verification, immutable recovered policy,
// capture and pinned writer gate run against this transactional SQL double.
function fixture(){
 const graph={nodes:[{name:'Audited writer',type:'code',typeVersion:2,parameters:{}}],connections:{}};
 const workflows=['bnzVMNkZuGO1GQCZ','Mt7ts2EGPbyaTC2o','4o7K5TmKc7joScqB','C4hk6fQQomueYC8f','qBmLf0DmcMSfuWvm'].map(id=>({id,activeVersionId:id,graph:structuredClone(graph)}));
 const manifest={schema:'opmx.fenced-writer-release.v1',workflows:Object.fromEntries(workflows.map(w=>[w.id,{versionId:w.id,graphHash:writerGraphFingerprint(w.graph)}]))};
 const old=[item(1,attestedControl('/nuevo',packageId,100,101)),item(2,'Synthetic editorial material about data centres.'),item(3,attestedControl('/publicar OPURO',packageId,102)),item(4,attestedControl('/listo',packageId,103))];
 const bytes=Buffer.from('original synthetic image bytes');
 old.push({...item(5,''),kind:'FILE',text:'',fileName:'image.jpg',caption:'',attachment:{file_name:'image.jpg',mime_type:'image/jpeg',declared_bytes:bytes.length},reservedBytes:bytes.length,contentBytes:bytes.length,sha256:hash(bytes)});
 const prior={packageId,revision:9,ownerKey,destinations:['OPURO'],authorization:{mode:'PUBLISH',authorized:true,explicit:true,authorization:'DIRECT_MODE_COMMAND'},controls:[itemId(1),itemId(3),itemId(4)],contentMode:'EDITORIAL',contentControlItemIds:[]};
 const closeReceipt=`telegram-${admin}-55-105`,close=item(6,attestedControl('/listo',packageId,55),actor,closeReceipt);
 const f={state:{package:{state:'READY',revision,owner_key:ownerKey},attempt:{state:'BLOCKED',event_id:eventId,token_hash:hash(oldToken)},fence:{state:'RECONCILING'},extraAttempts:[],quota:true,audits:[],sessions:[],leases:[],items:[...structuredClone(old),close],blobs:{[itemId(5)]:new Uint8Array(bytes)},snapshot:{prior,items:structuredClone(old)},closure:{package_id:packageId,revision,snapshot_revision:9,actor_key:actor,close_item_id:close.itemId,close_receipt_key:hash(closeReceipt)},events:[{event_id:eventId}],bindings:ids.map(request_id=>({request_id})),classes:ids.map(request_id=>({request_id,kind:'TELEGRAM'})),directRequests:[],directTargets:[],targets:[],media:[],claims:[],submissions:[],receipts:[],updates:[],jobs:[],cancellations:[]},
  queries:[],runtimeCalls:[],runtimeOptions:[],cmsReads:[],connections:0,commits:0,rollbacks:0,releases:0,destroys:0,tokens:0,unexpected:[],runtime:{status:'RUNTIME_OBSERVED',versionsMatch:true,noActiveN8nWriters:true,authorizesRecovery:false,motorTerminationVerified:false,workflows,observedAt:time}};
 f.confirm=(mode='EDITORIAL',action='CREATE')=>{
  const decision=buildCorrectionPreview({packageId,revision:revision-1,ownerKey,actorKey:actor,authorizedEditorKey:actor,baseRevision:9,before:f.state.snapshot.items,after:f.state.items,action,mode,destination:'OPURO',verifiedPosts:action==='CREATE'?{}:{OPURO:123}});
  f.state.decision={preview_hash:decision.previewHash,decision_json:JSON.stringify(decision)};
  f.state.preview={owner_key:actor,preview_receipt:closeReceipt,confirmation_receipt:`telegram-${admin}-56-106`,state:'CONFIRMED',event_id:eventId,preview_json:f.state.decision.decision_json};
  f.input={owner:admin,chat:admin,packageId,revision,eventId,previewHash:decision.previewHash};
 };
 f.confirm();
 const rawItems=()=>f.state.items.map(i=>({item_id:i.itemId,owner_key:i.ownerKey,receipt_key:i.receiptKey,fingerprint:i.fingerprint,kind:i.kind,state:i.state,text_content:i.text,attachment_json:i.attachment?JSON.stringify(i.attachment):null,reserved_bytes:i.reservedBytes,content_bytes:i.contentBytes,sha256:i.sha256,actor_key:i.actorKey,blob_bytes:f.state.blobs[i.itemId]?.length??null,blob_sha256:f.state.blobs[i.itemId]?hash(Buffer.from(f.state.blobs[i.itemId])):null}));
 const rows=x=>[structuredClone(x)],changed=n=>[{affectedRows:n}];let queue=Promise.resolve();
 const tableRows={opmx_mcp_requests:'directRequests',opmx_mcp_targets:'directTargets',opmx_mcp_target_progress:'targets',opmx_mcp_media_progress:'media',opmx_tg_publication_claims_v1:'claims',opmx_tg_publisher_submissions_v1:'submissions',opmx_tg_writer_receipts_v1:'receipts'};
 const pool={async getConnection(){
  f.connections++;let active=false,snapshot,unlock;
  return {
   async beginTransaction(){const before=queue;queue=new Promise(r=>unlock=r);await before;snapshot=structuredClone(f.state);active=true;if(f.beginThrows)throw Error('lost BEGIN acknowledgement')},
   async commit(){assert.equal(active,true);if(f.commitThrowsBefore)throw Error('commit failed before persistence');f.commits++;active=false;unlock();if(f.commitThrowsAfter)throw Error('lost COMMIT acknowledgement')},
   async rollback(){f.rollbacks++;if(active){f.state=snapshot;active=false;unlock()}if(f.rollbackThrows)throw Error('lost rollback acknowledgement')},
   release(){f.releases++;if(f.releaseThrows)throw Error('release failure')},destroy(){f.destroys++},
   async execute(sql,args=[]){
    f.queries.push({sql,args:structuredClone(args)});
    if(!active&&sql==='SELECT state FROM opmx_tg_motor_attempts_v1 WHERE package_id=? AND revision=?')return rows(f.state.attempt?[{state:f.state.attempt.state}]:[]);
    assert.equal(active,true,'every recovery read/change must be inside the transaction');
    const s=f.state;
    if(sql==='SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE')return rows(s.quota?[{id:1}]:[]);
    if(sql.startsWith('SELECT state,revision')||sql.startsWith('SELECT owner_key,state,revision'))return rows(s.package?[s.package]:[]);
    if(sql.startsWith('SELECT state,event_id'))return rows([...(s.attempt?[s.attempt]:[]),...s.extraAttempts]);
    if(sql.startsWith('SELECT state FROM opmx_tg_publication_fence'))return rows(s.fence?[s.fence]:[]);
    if(sql.startsWith('SELECT actor_key,owner_key FROM opmx_tg_recovery_audit'))return rows(s.audits);
    if(sql.startsWith('SELECT owner_key FROM opmx_tg_sessions'))return rows(s.sessions);
    if(sql.startsWith('SELECT actor_key,owner_key FROM opmx_tg_recovery_leases'))return rows(s.leases);
    if(sql.includes(' FROM opmx_tg_destination_cancellations_v1 '))return rows(s.cancellations);
    const zero=/^SELECT request_id FROM ([a-z0-9_]+) WHERE /.exec(sql);
    if(zero&&tableRows[zero[1]]){
     const data=s[tableRows[zero[1]]];
     const selected=sql.includes('OR request_id IN')?data.filter(r=>r.package_id===args[0]&&r.revision===args[1]||args.slice(2).includes(r.request_id)):data.filter(r=>args.includes(r.request_id));
     return rows(selected.slice(0,1));
    }
    if(sql.startsWith('SELECT destination FROM opmx_tg_update_claims'))return rows(s.updates);
    if(sql.startsWith('SELECT operation_id FROM opmx_tg_update_deliveries'))return rows(s.jobs);
    if(sql.startsWith('SELECT i.item_id'))return rows(rawItems());
    if(sql.startsWith('SELECT event_id FROM opmx_tg_events'))return rows(s.events.filter(r=>r.event_id===(sql.includes('WHERE event_id=')?args[0]:r.event_id)));
    if(sql.startsWith('SELECT request_id FROM opmx_tg_request_binding'))return rows(s.bindings);
    if(sql.startsWith('SELECT request_id,kind FROM opmx_tg_request_class'))return rows(s.classes);
    if(sql.startsWith('SELECT request_id,destination,target_key,status,post_id FROM opmx_mcp_target_progress'))return rows(s.targets);
    if(sql.startsWith('SELECT request_id,target_key,role,status,media_id FROM opmx_mcp_media_progress'))return rows(s.media);
    if(sql.startsWith('SELECT request_id,slug,destinations FROM opmx_tg_publication_claims'))return rows(s.claims);
    if(sql.startsWith('SELECT preview_hash,decision_json')||sql.startsWith('SELECT decision_json'))return rows(s.decision?[s.decision]:[]);
    if(sql.startsWith('SELECT owner_key,preview_receipt'))return rows(s.preview?[s.preview]:[]);
    if(sql.startsWith('SELECT snapshot_revision,actor_key')||sql.startsWith('SELECT package_id FROM opmx_tg_recovery_closures'))return rows(s.closure?[s.closure]:[]);
    if(sql.startsWith('SELECT owner_key,snapshot_json'))return rows([{owner_key:ownerKey,snapshot_json:JSON.stringify(s.snapshot)}]);
    if(sql.startsWith('UPDATE opmx_tg_publication_fence_v1')){
     const next=/SET state='([^']+)'/.exec(sql)[1],expected=sql.endsWith('state=?')?args[2]:/AND state='([^']+)'$/.exec(sql)[1];
     if(f.fenceConflict||s.fence?.state!==expected)return changed(0);s.fence.state=next;return changed(1);
    }
    if(sql.startsWith('UPDATE opmx_tg_motor_attempts_v1')){
     if(sql.includes('SET token_hash=?')){if(s.attempt?.state!=='RUNNING'||s.attempt.token_hash!==args[3])return changed(0);s.attempt.token_hash=args[0];return changed(1)}
     if(sql.includes("state='REVOKED',token_hash=NULL")){if(s.attempt?.event_id!==args[2])return changed(0);s.attempt.state='REVOKED';s.attempt.token_hash=null;return changed(1)}
     if(sql.includes("SET state='RUNNING',token_hash=?")){if(f.attemptConflict||s.attempt?.state!=='REVOKED'||s.attempt.token_hash!==null||s.attempt.event_id!==args[3])return changed(0);s.attempt.state='RUNNING';s.attempt.token_hash=args[0];return changed(1)}
    }
    if(sql.startsWith('INSERT INTO opmx_tg_recovery_audit')){
     if(f.auditConflict)return changed(0);const [package_id,action,previous_revision,revision,actor_key,owner_key]=args;s.audits.push({package_id,action,previous_revision,revision,actor_key,owner_key});return changed(1);
    }
    f.unexpected.push(sql);throw Error('Unexpected SQL: '+sql);
   }
  };
 }};
 const options={pool,adminUserIds:[admin],manifest,now:()=>Date.parse(time),tokenFactory:()=>{f.tokens++;return f.badToken??newToken},observeRuntime:async(scope,options={})=>{f.runtimeCalls.push(scope);f.runtimeOptions.push(structuredClone(options));assert.equal(f.state.fence.state,'RECONCILING');return structuredClone(f.runtime)},readWordPress:async scope=>{f.cmsReads.push(scope);throw Error('No CMS reads required for zero effects')}};
 f.pool=pool;f.recover=createBlockedUnwrittenAttemptRecovery(options);
 f.store=createMotorAttemptStore({pool,adminUserIds:[admin],recoverBlockedUnwritten:f.recover,tokenFactory:()=>newToken});
 return f;
}
function noCapability(r){assert.equal(Object.hasOwn(r,'token'),false);assert.equal(r.writeAuthorized,false);assert.equal(r.retryPermitted,false)}
function unchanged(f,before){assert.deepEqual(f.state,before);assert.equal(f.commits,0);assert.equal(f.rollbacks,1);assert.deepEqual(f.unexpected,[])}

test('full real gate/capture recovers the same confirmed editorial attempt and keeps write permission closed',async()=>{
 const f=fixture(),before=structuredClone(f.state),r=await f.recover(f.input);
 assert.deepEqual(f.unexpected,[]);assert.equal(r.status,'BLOCKED_UNWRITTEN_ATTEMPT_RECOVERED');assert.equal(r.token,newToken);assert.equal(r.eventId,eventId);assert.equal(r.packageId,packageId);assert.equal(r.revision,revision);assert.equal(r.requestId,ids[0]);assert.equal(r.destination,'OPURO');assert.equal(r.decisionAcknowledgementRequired,true);assert.equal(r.writeAuthorized,false);assert.equal(r.retryPermitted,false);
 assert.deepEqual(f.state.package,before.package);assert.deepEqual(f.state.items,before.items);assert.deepEqual(f.state.events,before.events);assert.deepEqual(f.state.closure,before.closure);assert.deepEqual(f.state.snapshot,before.snapshot);assert.deepEqual(f.state.bindings,before.bindings);
 assert.equal(f.state.attempt.state,'RUNNING');assert.equal(f.state.attempt.token_hash,hash(newToken));assert.notEqual(f.state.attempt.token_hash,before.attempt.token_hash);assert.equal(f.state.fence.state,'AWAITING_DECISION');assert.deepEqual(f.state.audits,[{package_id:packageId,action:'RESUME_UNWRITTEN',previous_revision:revision,revision,actor_key:actor,owner_key:ownerKey}]);
 assert.equal(f.commits,1);assert.equal(f.rollbacks,0);assert.equal(f.tokens,1);assert.equal(f.releases,1);assert.deepEqual(f.runtimeCalls,[{packageId,revision,eventId}]);assert.deepEqual(f.cmsReads,[]);
 assert.match(f.queries[0].sql,/quota_v1/);assert.match(f.queries[1].sql,/packages_v1/);assert.ok(f.queries.some(q=>q.sql.includes('SHA2(i.content_blob,256)')));
});
test('the routed existing recovery tool uses the full gate without nested transactions',async()=>{
 const f=fixture(),r=await f.store.recoverUnacknowledged(f.input);assert.equal(r.status,'BLOCKED_UNWRITTEN_ATTEMPT_RECOVERED');assert.equal(f.connections,2);assert.equal(f.commits,1);assert.deepEqual(f.unexpected,[]);
 assert.equal(f.queries[0].sql,'SELECT state FROM opmx_tg_motor_attempts_v1 WHERE package_id=? AND revision=?');
});
test('configured routing preserves the original RUNNING unacknowledged recovery and rejects completed attempts',async()=>{
 const f=fixture();f.state.attempt.state='RUNNING';f.state.fence.state='AWAITING_DECISION';
 const r=await f.store.recoverUnacknowledged(f.input);assert.equal(r.status,'UNACKNOWLEDGED_ATTEMPT_RECOVERED');assert.equal(r.token,newToken);assert.equal(f.runtimeCalls.length,0);assert.equal(f.state.audits.length,0);assert.equal(f.state.fence.state,'AWAITING_DECISION');assert.deepEqual(f.unexpected,[]);
 const done=fixture();done.state.attempt.state='COMPLETED';const before=structuredClone(done.state),out=await done.store.recoverUnacknowledged(done.input);assert.equal(out.status,'RECOVERY_NOT_PERMITTED');assert.equal(Object.hasOwn(out,'token'),false);assert.deepEqual(done.state,before);assert.equal(done.runtimeCalls.length,0);
});
test('only the internally scoped blocked recovery can accept its single pinned administrative call',async t=>{
 const origin={workflowId:'bnzVMNkZuGO1GQCZ',executionId:'42'},startedAt='2026-11-13T17:59:59.000Z';
 const prepare=()=>{const f=fixture();Object.assign(f.runtime,{noActiveN8nWriters:false,noActivePublicationWriters:true,nonWritingAdministrativeExecution:{...origin,status:'running',provenance:'PINNED_INTERNAL_RECOVERY_ROUTE'},administrativeExecutionProof:{id:'42',workflowId:origin.workflowId,workflowVersionId:origin.workflowId,mode:'webhook',status:'running',startedAt,stoppedAt:null},executionPages:['running','waiting','new'].map(status=>({status,complete:true,executions:status==='running'?[{id:'42',workflowId:origin.workflowId,status,startedAt,stoppedAt:null}]:[]}))});return f};
 const f=prepare(),r=await f.store.recoverUnacknowledged({...f.input,origin});assert.equal(r.status,'BLOCKED_UNWRITTEN_ATTEMPT_RECOVERED');assert.deepEqual(f.runtimeOptions,[{nonWritingRecoveryExecution:origin}]);assert.equal(f.runtime.noActiveN8nWriters,false);assert.equal(f.runtime.executionPages[0].executions.length,1);
 for(const name of ['noOrigin','wrongId','missingProof','oldExecutionVersion','anotherJob'])await t.test(name,async()=>{const x=prepare();let given=origin;if(name==='noOrigin')given=undefined;if(name==='wrongId')given={...origin,executionId:'43'};if(name==='missingProof')delete x.runtime.administrativeExecutionProof;if(name==='oldExecutionVersion')x.runtime.administrativeExecutionProof.workflowVersionId='old';if(name==='anotherJob')x.runtime.executionPages[0].executions.push({...x.runtime.executionPages[0].executions[0],id:'43'});const before=structuredClone(x.state),out=await x.recover({...x.input,...(given?{origin:given}:{})});noCapability(out);unchanged(x,before)});
 const invalid=fixture(),out=await invalid.store.recoverUnacknowledged({...invalid.input,origin:{...origin,workflowId:'other'}});assert.equal(out.status,'RECOVERY_NOT_AUTHORIZED');assert.equal(invalid.connections,0);
});
test('the old capability stays invalid and ordinary acknowledgement is still required',async()=>{
 const f=fixture(),r=await f.recover(f.input);assert.equal(r.status,'BLOCKED_UNWRITTEN_ATTEMPT_RECOVERED');
 const ack={packageId,revision,eventId,token:oldToken,previewHash:f.input.previewHash,destination:'OPURO',contentMode:'EDITORIAL',action:'CREATE'};
 assert.equal((await f.store.acknowledgeDecision(ack)).status,'ATTEMPT_NOT_AUTHORIZED');assert.equal(f.state.fence.state,'AWAITING_DECISION');
 assert.equal((await f.store.acknowledgeDecision({...ack,token:newToken})).status,'DECISION_ACKNOWLEDGED');assert.equal(f.state.fence.state,'READY_TO_WRITE');assert.deepEqual(f.state.directRequests,[]);assert.deepEqual(f.cmsReads,[]);
});
test('exact administrative input is required before storage is opened',async t=>{
 for(const [name,change]of Object.entries({nonAdmin:{owner:'456',chat:'456'},crossChat:{chat:'456'},actorClaim:{isAdmin:true},zero:{revision:0},ordinary:{revision:1},overflow:{revision:4294967296},string:{revision:'12'},badPackage:{packageId:'tg_bad'},badEvent:{eventId:'evt_bad'},badPreview:{previewHash:'bad'}}))await t.test(name,async()=>{const f=fixture(),r=await f.recover({...f.input,...change});assert.equal(r.status,'RECOVERY_NOT_AUTHORIZED');noCapability(r);assert.equal(f.connections,0)});
});
test('missing or incompatible package, attempt, fence, audit and editor locks are denied unchanged',async t=>{
 const cases={noQuota:f=>f.state.quota=false,stale:f=>f.state.package.revision++,open:f=>f.state.package.state='OPEN',noAttempt:f=>f.state.attempt=null,running:f=>f.state.attempt.state='RUNNING',revoked:f=>f.state.attempt.state='REVOKED',completed:f=>f.state.attempt.state='COMPLETED',duplicate:f=>f.state.extraAttempts.push({...f.state.attempt}),wrongEvent:f=>f.state.attempt.event_id='evt_'+'f'.repeat(48),missingToken:f=>f.state.attempt.token_hash=null,writing:f=>f.state.fence.state='WRITING',awaiting:f=>f.state.fence.state='AWAITING_DECISION',session:f=>f.state.sessions.push({owner_key:actor}),lease:f=>f.state.leases.push({actor_key:actor,owner_key:ownerKey}),oldResume:f=>f.state.audits.push({actor_key:actor,owner_key:ownerKey})};
 for(const [name,change]of Object.entries(cases))await t.test(name,async()=>{const f=fixture();change(f);const before=structuredClone(f.state),r=await f.recover(f.input);noCapability(r);unchanged(f,before);assert.equal(f.runtimeCalls.length,0)});
});
test('any reservation, acceptance, target, media, claim, writer receipt or update prevents recovery',async t=>{
 for(const name of ['directRequests','directTargets','targets','media','claims','submissions','receipts','updates','jobs'])await t.test(name,async()=>{const f=fixture();f.state[name].push({request_id:ids[0],package_id:packageId,revision,destination:'OPURO',operation_id:'update'});const before=structuredClone(f.state),r=await f.recover(f.input);noCapability(r);unchanged(f,before);assert.equal(f.runtimeCalls.length,0)});
 for(const name of ['claims','submissions','receipts'])await t.test('orphan '+name,async()=>{const f=fixture();f.state[name].push({request_id:ids[3],package_id:'tg_'+'f'.repeat(40),revision:88});const before=structuredClone(f.state),r=await f.recover(f.input);noCapability(r);unchanged(f,before)});
});
test('source bytes, retained snapshot, current confirmed material list and decision are all checked',async t=>{
 const cases={textHash:f=>f.state.items[1].text+=' tampered',blobHash:f=>f.state.blobs[itemId(5)]=Buffer.from('different original'),missingBlob:f=>delete f.state.blobs[itemId(5)],pending:f=>f.state.items[1].state='PENDING',duplicate:f=>f.state.items[1].itemId=f.state.items[0].itemId,wrongOwner:f=>f.state.items[1].ownerKey=actor,attachment:f=>f.state.items[4].attachment='not-an-object',missingDecision:f=>f.state.decision=null,previewMismatch:f=>f.input.previewHash='f'.repeat(64),unconfirmed:f=>f.state.preview.state='PREVIEWED',receiptMismatch:f=>f.state.preview.confirmation_receipt='telegram-12345-54-104',closureMismatch:f=>f.state.closure.close_receipt_key=hash('wrong'),snapshotTamper:f=>f.state.snapshot.items[1].text='other',removedAfterConfirmation:f=>f.state.items[4].state='DISCARDED',addedAfterConfirmation:f=>f.state.items.splice(-1,0,item(7,'Unconfirmed additional source.',actor)),materialTamper:f=>{const d=JSON.parse(f.state.decision.decision_json);d.materials.pop();f.state.decision.decision_json=JSON.stringify(d)}};
 for(const [name,change]of Object.entries(cases))await t.test(name,async()=>{const f=fixture();change(f);const before=structuredClone(f.state),r=await f.recover(f.input);noCapability(r);unchanged(f,before)});
 for(const name of ['LITERAL','UPDATE'])await t.test(name,async()=>{const f=fixture();f.confirm(name==='LITERAL'?'LITERAL':'EDITORIAL',name==='UPDATE'?'UPDATE':'CREATE');const before=structuredClone(f.state),r=await f.recover(f.input);noCapability(r);unchanged(f,before)});
});
test('a confirmed discarded original is retained without reading its inactive bytes',async()=>{
 const f=fixture();f.state.items[4].state='DISCARDED';f.confirm();delete f.state.blobs[itemId(5)];
 const r=await f.recover(f.input);assert.equal(r.status,'BLOCKED_UNWRITTEN_ATTEMPT_RECOVERED');assert.equal(f.state.items[4].state,'DISCARDED');
});
test('all seven bindings/classes and the pinned idle runtime must remain complete and fresh',async t=>{
 const cases={noEvent:f=>f.state.events=[],wrongEvent:f=>f.state.events[0].event_id='evt_'+'f'.repeat(48),multipleEvents:f=>f.state.events.push({...f.state.events[0]}),missingBinding:f=>f.state.bindings.pop(),duplicateBinding:f=>f.state.bindings[1]=f.state.bindings[0],wrongClass:f=>f.state.classes[0].kind='DIRECT',missingClass:f=>f.state.classes.pop(),duplicateClass:f=>f.state.classes[1]=f.state.classes[0],changedVersion:f=>f.runtime.workflows[0].activeVersionId='other',changedGraph:f=>f.runtime.workflows[0].graph.nodes[0].parameters.code='other',busy:f=>f.runtime.noActiveN8nWriters=false,incompleteRuntime:f=>f.runtime.workflows.pop(),oldRuntime:f=>f.runtime.observedAt='2026-11-13T17:00:00Z',futureRuntime:f=>f.runtime.observedAt='2026-11-13T19:00:00Z',cancellation:f=>f.state.cancellations.push({unconfirmed:true})};
 for(const [name,change]of Object.entries(cases))await t.test(name,async()=>{const f=fixture();change(f);const before=structuredClone(f.state),r=await f.recover(f.input);noCapability(r);unchanged(f,before);assert.equal(f.tokens,0)});
});
test('CAS, token and audit failures roll back provisional gate changes',async t=>{
 for(const name of ['fenceConflict','attemptConflict','auditConflict','badToken','malformedToken'])await t.test(name,async()=>{const f=fixture();if(name==='malformedToken')f.badToken='not-hex';else f[name]=name==='badToken'?oldToken:true;const before=structuredClone(f.state),r=await f.recover(f.input);noCapability(r);unchanged(f,before)});
});
test('one racing recovery wins and neither response permits replay',async()=>{
 const f=fixture(),results=await Promise.all([f.recover(f.input),f.recover(f.input)]);
 assert.equal(results.filter(r=>r.status==='BLOCKED_UNWRITTEN_ATTEMPT_RECOVERED').length,1);assert.equal(results.filter(r=>Object.hasOwn(r,'token')).length,1);assert.equal(f.commits,1);assert.equal(f.tokens,1);assert.equal(f.state.audits.length,1);
 f.state.attempt.state='BLOCKED';f.state.fence.state='RECONCILING';const before=structuredClone(f.state),again=await f.recover(f.input);noCapability(again);assert.deepEqual(f.state,before);assert.equal(f.state.audits.length,1);
});
test('uncertain commit, BEGIN, rollback or release never returns a capability',async t=>{
 for(const name of ['commitThrowsAfter','commitThrowsBefore','beginThrows','rollbackThrows','releaseThrows'])await t.test(name,async()=>{
  const f=fixture();f[name]=true;if(name==='rollbackThrows')f.auditConflict=true;const before=structuredClone(f.state),r=await f.recover(f.input);
  noCapability(r);assert.equal(f.releases,1);if(name==='beginThrows')assert.equal(f.rollbacks,1);if(name==='rollbackThrows')assert.equal(f.destroys,1);
  if(name==='commitThrowsAfter'||name==='releaseThrows'){assert.equal(r.status,'BLOCKED_RECOVERY_UNCONFIRMED');assert.equal(f.state.attempt.state,'RUNNING');assert.equal(f.state.fence.state,'AWAITING_DECISION');assert.equal(f.state.audits.length,1)}else assert.deepEqual(f.state,before);
 });
});
