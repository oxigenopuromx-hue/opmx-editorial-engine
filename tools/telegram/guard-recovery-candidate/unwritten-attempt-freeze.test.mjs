import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createUnwrittenAttemptFreeze,createUnwrittenRecoveryReadiness} from './unwritten-attempt-freeze.mjs';
import {attestedControl} from './original-destination-policy.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {writerGraphFingerprint} from './writer-release-contract.mjs';

const hash=s=>createHash('sha256').update(s).digest('hex');
const packageId='tg_'+'a'.repeat(40),revision=8,admin='12345',otherAdmin='67890';
const actorKey=id=>hash(`opmx:telegram:v1:${id}:${id}`);
const ownerKey=actorKey('99999'),eventId='evt_'+'e'.repeat(48);
const input={owner:admin,chat:admin,packageId,revision};
const labels=['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'];
const requestIds=labels.map(destination=>expectedDraftRequestId({packageId,revision,destination}));
const blocked=['OPURO','OPOL','LIBERAL'].map(destination=>({destination,status:'BLOCKED'}));

// These are test-only receiver attestations. Production capture receives only
// immutable, locked records and validates their bytes and provenance itself.
function item(text,index){return {item_id:'ti_'+String(index).repeat(40),owner_key:ownerKey,kind:'TEXT',state:'STORED',text_content:text,content_bytes:Buffer.byteLength(text),sha256:hash(text),actor_key:null};}
function fixture(){
 const graph={nodes:[{name:'Guarded',type:'code',typeVersion:2,parameters:{}}],connections:{}};
 const workflows=['a','b','c','d'].map(id=>({id,activeVersionId:id,graph:structuredClone(graph)}));
 const manifest={schema:'opmx.fenced-writer-release.v1',workflows:Object.fromEntries(workflows.map(w=>[w.id,{versionId:w.id,graphHash:writerGraphFingerprint(w.graph)}]))};
 const f={
  state:{package:{state:'READY',revision,owner_key:ownerKey},attempt:{state:'RUNNING',event_id:eventId,token_hash:hash('test-only-capability')},extraAttempts:[],fence:{state:'READY_TO_WRITE'},audit:[],session:null,lease:null,
   items:[item(attestedControl('/nuevo',packageId,1,2),1),item('Synthetic test source with substantive text.',2),item(attestedControl('/publicar todos',packageId,3),3),item(attestedControl('/listo',packageId,4),4)],
   events:[{event_id:eventId}],bindings:requestIds.map(request_id=>({request_id})),classes:requestIds.map(request_id=>({request_id,kind:'TELEGRAM'})),targets:[],media:[],claims:[],decisions:[],closures:[],updates:[],deliveries:[],receipts:[]},
  runtime:{status:'RUNTIME_OBSERVED',versionsMatch:true,noActiveN8nWriters:true,authorizesRecovery:false,motorTerminationVerified:false,workflows,observedAt:'2026-11-11T01:00:00Z'},
  queries:[],runtimeCalls:[],cmsReads:[],connections:0,commits:0,rollbacks:0,releases:0,destroys:0,auditConflict:false,commitThrows:false,commitThrowsBefore:false,rollbackThrows:false,releaseThrows:false,
 };
 let snapshot=null,active=false;
 const rows=x=>[structuredClone(x)];
 const changed=n=>[{affectedRows:n}];
 const connection={
  async beginTransaction(){assert.equal(active,false);snapshot=structuredClone(f.state);active=true},
  async commit(){assert.equal(active,true);if(f.commitThrowsBefore)throw Error('commit unconfirmed');f.commits++;active=false;snapshot=null;if(f.commitThrows)throw Error('acknowledgement lost')},
  async rollback(){f.rollbacks++;if(active){f.state=snapshot;active=false;snapshot=null}if(f.rollbackThrows)throw Error('rollback unconfirmed')},
  release(){f.releases++;if(f.releaseThrows)throw Error('release unconfirmed')},destroy(){f.destroys++},
  async execute(sql,args=[]){
   assert.equal(active,true,'all persistence reads and changes must hold the transaction');
   f.queries.push({sql,args:structuredClone(args)});
   const s=f.state;
   if(sql==='SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE')return rows([{id:1}]);
   if(sql.startsWith('SELECT state,revision')&&sql.includes('FROM opmx_tg_packages_v1'))return rows(s.package?[s.package]:[]);
   if(sql.startsWith('SELECT state,event_id FROM opmx_tg_motor_attempts_v1'))return rows([...(s.attempt?[s.attempt]:[]),...s.extraAttempts]);
   if(sql.startsWith('SELECT state FROM opmx_tg_publication_fence_v1'))return rows(s.fence?[s.fence]:[]);
   if(sql.startsWith('SELECT package_id FROM opmx_tg_sessions_v1')){assert.match(args[0],/^[a-f0-9]{64}$/);return rows(s.session?.owner_key===args[0]?[s.session]:[])}
   if(sql.startsWith('SELECT actor_key,owner_key FROM opmx_tg_recovery_leases_v1')){assert.deepEqual(args,[packageId]);return rows(s.lease?[s.lease]:[])}
   if(sql.startsWith('SELECT actor_key,owner_key FROM opmx_tg_recovery_audit_v1'))return rows(s.audit.filter(a=>a.package_id===args[0]&&a.action==='RECONCILE_UNWRITTEN'&&a.previous_revision===args[1]&&a.revision===args[2]));
   if(sql.startsWith('SELECT destination FROM opmx_tg_update_claims_v1'))return rows(s.updates);
   if(sql.startsWith('SELECT operation_id FROM opmx_tg_update_deliveries_v1'))return rows(s.deliveries);
   if(sql.startsWith('SELECT request_id,phase FROM opmx_tg_writer_receipts_v1'))return rows(s.receipts);
   if(sql.startsWith('SELECT i.item_id'))return rows(s.items);
   if(sql.startsWith('SELECT event_id FROM opmx_tg_events_v1'))return rows(s.events);
   if(sql.startsWith('SELECT request_id FROM opmx_tg_request_binding_v1'))return rows(s.bindings);
   if(sql.startsWith('SELECT request_id,kind FROM opmx_tg_request_class_v1'))return rows(s.classes);
   if(sql.startsWith('SELECT request_id,destination,target_key,status,post_id FROM opmx_mcp_target_progress'))return rows(s.targets);
   if(sql.startsWith('SELECT request_id,target_key,role,status,media_id FROM opmx_mcp_media_progress'))return rows(s.media);
   if(sql.startsWith('SELECT request_id,slug,destinations FROM opmx_tg_publication_claims_v1'))return rows(s.claims);
   if(sql.startsWith('SELECT decision_json FROM opmx_tg_confirmed_decisions_v1'))return rows(s.decisions);
   if(sql.startsWith('SELECT package_id FROM opmx_tg_recovery_closures_v1'))return rows(s.closures);
   if(sql.startsWith('UPDATE opmx_tg_publication_fence_v1')){
    const next=/SET state='([^']+)'/.exec(sql)?.[1];
    const expected=sql.endsWith('state=?')?args[2]:/AND state='([^']+)'$/.exec(sql)?.[1];
    if(!s.fence||s.fence.state!==expected)return changed(0);
    s.fence.state=next;return changed(1);
   }
   if(sql.startsWith('UPDATE opmx_tg_motor_attempts_v1')){
    assert.match(sql,/state='REVOKED',token_hash=NULL/);
    if(s.attempt?.event_id!==args[2])return changed(0);
    s.attempt.state='REVOKED';s.attempt.token_hash=null;return changed(1);
   }
   if(sql.startsWith('INSERT INTO opmx_tg_recovery_audit_v1')){
    if(f.auditConflict)return changed(0);
    const [package_id,action,previous_revision,revision,actor_key,owner_key]=args;
    s.audit.push({package_id,action,previous_revision,revision,actor_key,owner_key});return changed(1);
   }
   // No session, source, snapshot, outbox, Telegram receipt or write-ledger
   // mutation is permitted by this fixture or by the operation's contract.
   throw Error(`Unexpected SQL: ${sql}`);
  },
 };
 const observeRuntime=async scope=>{
  assert.equal(active,true);assert.equal(f.state.fence.state,'RECONCILING');
  f.runtimeCalls.push(scope);return structuredClone(f.runtime);
 };
 const readWordPress=async scope=>{f.cmsReads.push(scope);return {statusCode:200,post:{id:19,type:'post',slug:'example-note',status:'publish'}}};
 const options={pool:{getConnection:async()=>{f.connections++;return connection}},adminUserIds:[admin,otherAdmin],observeRuntime,readWordPress,manifest};
 f.freeze=createUnwrittenAttemptFreeze(options);
 f.readiness=createUnwrittenRecoveryReadiness(options);
 return f;
}
function noAuthority(result){for(const key of ['writeAuthorized','reopenAuthorized','retryPermitted','processTerminationClaimed'])assert.equal(result[key],false,key);}
function assertUnchanged(f,before){assert.deepEqual(f.state,before);assert.equal(f.commits,0);assert.equal(f.rollbacks,1);assert.equal(f.releases,1);}

test('freezes a proven unwritten historical attempt, preserving package and revision',async()=>{
 const f=fixture(),before=structuredClone(f.state),r=await f.freeze(input);
 assert.equal(r.status,'UNWRITTEN_ATTEMPT_FROZEN');noAuthority(r);
 assert.deepEqual(r.results,blocked);assert.equal(r.attemptState,'REVOKED');assert.equal(r.fenceState,'RECONCILING');
 assert.deepEqual(f.state.package,before.package);assert.deepEqual(f.state.items,before.items);
 assert.equal(f.state.attempt.state,'REVOKED');assert.equal(f.state.attempt.token_hash,null);assert.equal(f.state.fence.state,'RECONCILING');
 assert.deepEqual(f.state.audit,[{package_id:packageId,action:'RECONCILE_UNWRITTEN',previous_revision:revision,revision,actor_key:actorKey(admin),owner_key:ownerKey}]);
 assert.deepEqual(f.runtimeCalls,[{packageId,revision,eventId}]);assert.deepEqual(f.cmsReads,[]);assert.equal(f.commits,1);assert.equal(f.rollbacks,0);assert.equal(f.releases,1);
 assert.match(f.queries[0].sql,/quota_v1/);assert.match(f.queries[1].sql,/packages_v1/);assert.match(f.queries[2].sql,/motor_attempts_v1/);assert.match(f.queries[3].sql,/publication_fence_v1/);
 const mutations=f.queries.filter(q=>/^(UPDATE|INSERT|DELETE)/.test(q.sql));
 assert.equal(mutations.filter(q=>q.sql.startsWith('INSERT')).length,1);
 assert.ok(mutations.every(q=>/opmx_tg_(?:publication_fence|motor_attempts|recovery_audit)_v1/.test(q.sql)));
 assert.ok(!JSON.stringify(r).includes('test-only-capability'));assert.ok(!JSON.stringify(f.state.audit).includes('Synthetic test source'));
});

test('replay rechecks live graphs and ledgers under locks and does not append another audit',async()=>{
 const f=fixture();await f.freeze(input);const after=structuredClone(f.state),r=await f.freeze(input);
 assert.equal(r.status,'UNWRITTEN_ATTEMPT_FREEZE_REPLAY');noAuthority(r);assert.deepEqual(f.state,after);assert.equal(f.runtimeCalls.length,2);assert.equal(f.commits,2);assert.equal(f.state.audit.length,1);
 f.runtime.noActiveN8nWriters=false;const failed=await f.freeze(input);
 assert.equal(failed.status,'RECONCILIATION_REQUIRED');noAuthority(failed);assert.deepEqual(f.state,after);assert.equal(f.runtimeCalls.length,3);assert.equal(f.commits,2);
});

test('only exact private-chat administrator requests reach storage',async t=>{
 for(const [name,change]of Object.entries({nonAdmin:{owner:'333',chat:'333'},crossChat:{chat:otherAdmin},extra:{token:'never accepted'},stringRevision:{revision:'8'},zeroRevision:{revision:0},badPackage:{packageId:'tg_bad'}}))await t.test(name,async()=>{
  const f=fixture(),r=await f.freeze({...input,...change});assert.equal(r.status,'UNWRITTEN_FREEZE_NOT_AUTHORIZED');noAuthority(r);assert.equal(f.connections,0);
 });
});

test('state, event, inventory and fence preconditions fail without observing runtime',async t=>{
 const cases={stale:f=>f.state.package.revision++,open:f=>f.state.package.state='OPEN',multipleAttempts:f=>f.state.extraAttempts.push({...f.state.attempt}),completed:f=>f.state.attempt.state='COMPLETED',queued:f=>f.state.attempt.state='QUEUED',badEvent:f=>f.state.attempt.event_id='evt_bad',noFence:f=>f.state.fence=null,openFence:f=>f.state.fence.state='AWAITING_DECISION',pending:f=>f.state.items[1].state='PENDING'};
 for(const [name,change]of Object.entries(cases))await t.test(name,async()=>{const f=fixture();change(f);const before=structuredClone(f.state),r=await f.freeze(input);assert.equal(r.status,'RECONCILIATION_REQUIRED');noAuthority(r);assertUnchanged(f,before);assert.equal(f.runtimeCalls.length,0)});
});

test('all allowed historical attempt and closed fence states require a successful full gate',async t=>{
 for(const state of ['RUNNING','BLOCKED','REVOKED'])await t.test(state,async()=>{const f=fixture();f.state.attempt.state=state;f.state.fence.state='HISTORICAL_UNRECONCILED';const r=await f.freeze(input);assert.equal(r.status,'UNWRITTEN_ATTEMPT_FROZEN');assert.equal(f.state.attempt.token_hash,null);assert.equal(f.state.fence.state,'RECONCILING')});
});

test('changed graphs, active executions, missing bindings, wrong classes and event mismatch roll back revocation',async t=>{
 const cases={busy:f=>f.runtime.noActiveN8nWriters=false,changedGraph:f=>f.runtime.workflows[0].graph.nodes[0].parameters.code='different',missingBinding:f=>f.state.bindings.pop(),duplicateBinding:f=>f.state.bindings[1]=f.state.bindings[0],wrongClass:f=>f.state.classes[0].kind='API',wrongEvent:f=>f.state.events[0].event_id='evt_'+'f'.repeat(48)};
 for(const [name,change]of Object.entries(cases))await t.test(name,async()=>{const f=fixture();change(f);const before=structuredClone(f.state),r=await f.freeze(input);assert.equal(r.status,'RECONCILIATION_REQUIRED');noAuthority(r);assertUnchanged(f,before)});
});

test('any target, media or claim prevents committing an unwritten outcome',async t=>{
 const target={request_id:requestIds[6],destination:'OPURO',target_key:hash('opmx:v1:OPURO:example-note'),status:'reported',post_id:19};
 const cases={unreportedTarget:f=>f.state.targets.push({...target,status:'writing'}),confirmedPublishedTarget:f=>f.state.targets.push(target),orphanMedia:f=>f.state.media.push({request_id:requestIds[6],target_key:target.target_key,role:'featured',status:'reported',media_id:13}),claim:f=>f.state.claims.push({request_id:requestIds[6],slug:'example-note',destinations:'OPURO'})};
 for(const [name,change]of Object.entries(cases))await t.test(name,async()=>{const f=fixture();change(f);const before=structuredClone(f.state),r=await f.freeze(input);assert.equal(r.status,'RECONCILIATION_REQUIRED');noAuthority(r);assertUnchanged(f,before);assert.equal(f.cmsReads.length,name==='confirmedPublishedTarget'?1:0)});
});

test('capture verifies original controls and source integrity after the safety gate',async t=>{
 const cases={changedBytes:f=>f.state.items[1].text_content+='tampered',noClose:f=>f.state.items.pop(),foreignSource:f=>f.state.items[1].owner_key=actorKey(admin),contributedControl:f=>f.state.items[0].actor_key=actorKey(admin)};
 for(const [name,change]of Object.entries(cases))await t.test(name,async()=>{const f=fixture();change(f);const before=structuredClone(f.state),r=await f.freeze(input);assert.equal(r.status,'RECONCILIATION_REQUIRED');noAuthority(r);assert.equal(f.runtimeCalls.length,1);assertUnchanged(f,before);assert.ok(f.queries.some(q=>q.sql.startsWith('UPDATE opmx_tg_motor_attempts_v1')))});
});

test('orphan update claims, delivery jobs and writer receipts cannot be labeled unwritten',async t=>{
 const cases={updateClaim:f=>f.state.updates.push({destination:'OPURO'}),delivery:f=>f.state.deliveries.push({operation_id:'upd_'+hash('test operation')}),receipt:f=>f.state.receipts.push({request_id:requestIds[6],phase:'DRAFT'})};
 for(const [name,change]of Object.entries(cases))await t.test(name,async()=>{const f=fixture();change(f);const before=structuredClone(f.state),r=await f.freeze(input);assert.equal(r.status,'RECONCILIATION_REQUIRED');noAuthority(r);assertUnchanged(f,before);assert.equal(f.runtimeCalls.length,0)});
});

test('a replay requires the exact audit actor, owner and durable closed state',async t=>{
 const cases={actor:f=>f.state.audit[0].actor_key=actorKey(otherAdmin),owner:f=>f.state.audit[0].owner_key=actorKey(admin),attempt:f=>f.state.attempt.state='RUNNING',fence:f=>f.state.fence.state='READY_TO_WRITE',duplicate:f=>f.state.audit.push({...f.state.audit[0]})};
 for(const [name,change]of Object.entries(cases))await t.test(name,async()=>{const f=fixture();await f.freeze(input);change(f);const before=structuredClone(f.state),r=await f.freeze(input);assert.equal(r.status,'RECONCILIATION_REQUIRED');noAuthority(r);assert.deepEqual(f.state,before);assert.equal(f.runtimeCalls.length,1);assert.equal(f.commits,1)});
 const f=fixture();await f.freeze(input);const r=await f.freeze({...input,owner:otherAdmin,chat:otherAdmin});assert.equal(r.status,'RECONCILIATION_REQUIRED');assert.equal(f.runtimeCalls.length,1);
});

test('audit failure rolls back the successful gate and capability revocation',async()=>{
 const f=fixture();f.auditConflict=true;const before=structuredClone(f.state),r=await f.freeze(input);
 assert.equal(r.status,'RECONCILIATION_REQUIRED');noAuthority(r);assertUnchanged(f,before);assert.equal(f.runtimeCalls.length,1);
});

test('a lost COMMIT acknowledgement is uncertain and never grants a retry or claims success',async()=>{
 const f=fixture();f.commitThrows=true;const r=await f.freeze(input);
 assert.equal(r.status,'UNWRITTEN_FREEZE_UNCONFIRMED');noAuthority(r);assert.equal(f.state.fence.state,'RECONCILING');assert.equal(f.state.attempt.state,'REVOKED');assert.equal(f.state.attempt.token_hash,null);assert.equal(f.state.audit.length,1);
 f.commitThrows=false;const replay=await f.freeze(input);assert.equal(replay.status,'UNWRITTEN_ATTEMPT_FREEZE_REPLAY');assert.equal(f.runtimeCalls.length,2);assert.equal(f.state.audit.length,1);
});

test('a historical revision without an attempt freezes under the full gate without inventing a capability',async()=>{
 const f=fixture();f.state.attempt=null;const before=structuredClone(f.state),r=await f.freeze(input);
 assert.equal(r.status,'UNWRITTEN_ATTEMPT_FROZEN');assert.equal(r.attemptState,'ABSENT');noAuthority(r);
 assert.equal(f.state.attempt,null);assert.deepEqual(f.state.extraAttempts,[]);assert.equal(f.state.fence.state,'RECONCILING');
 assert.deepEqual(f.state.items,before.items);assert.deepEqual(f.state.package,before.package);assert.deepEqual(r.results,blocked);
 assert.equal(f.state.audit.length,1);assert.deepEqual(f.state.audit[0],{package_id:packageId,action:'RECONCILE_UNWRITTEN',previous_revision:revision,revision,actor_key:actorKey(admin),owner_key:ownerKey});
 assert.deepEqual(f.runtimeCalls,[{packageId,revision,eventId}]);assert.deepEqual(f.cmsReads,[]);
 assert.ok(!f.queries.some(q=>/^(INSERT INTO|UPDATE|DELETE FROM) opmx_tg_motor_attempts_v1/.test(q.sql)));
 const after=structuredClone(f.state),replay=await f.freeze(input);
 assert.equal(replay.status,'UNWRITTEN_ATTEMPT_FREEZE_REPLAY');assert.equal(replay.attemptState,'ABSENT');assert.deepEqual(f.state,after);assert.equal(f.state.audit.length,1);assert.equal(f.runtimeCalls.length,2);noAuthority(replay);
});

test('missing attempt never replaces unique event, complete bindings, pinned idle writers or zero effects',async t=>{
 const target={request_id:requestIds[6],destination:'OPURO',target_key:hash('opmx:v1:OPURO:example-note'),status:'reported',post_id:19};
 const cases={
  missingEvent:f=>f.state.events=[],duplicateEvent:f=>f.state.events.push({...f.state.events[0]}),malformedEvent:f=>f.state.events[0].event_id='evt_bad',
  missingBinding:f=>f.state.bindings.pop(),duplicateBinding:f=>f.state.bindings[1]=f.state.bindings[0],wrongBinding:f=>f.state.bindings[0].request_id='tg_'+'f'.repeat(64),
  missingClass:f=>f.state.classes.pop(),duplicateClass:f=>f.state.classes[1]=f.state.classes[0],wrongClass:f=>f.state.classes[0].kind='MANUAL',
  busy:f=>f.runtime.noActiveN8nWriters=false,changedVersion:f=>f.runtime.workflows[0].activeVersionId='different',changedGraph:f=>f.runtime.workflows[0].graph.nodes[0].parameters.code='different',
  target:f=>f.state.targets.push(target),media:f=>f.state.media.push({request_id:requestIds[6],target_key:target.target_key,role:'featured',status:'reported',media_id:13}),claim:f=>f.state.claims.push({request_id:requestIds[6],slug:'example-note',destinations:'OPURO'}),
  update:f=>f.state.updates.push({destination:'OPURO'}),delivery:f=>f.state.deliveries.push({operation_id:'upd_'+hash('orphan')}),receipt:f=>f.state.receipts.push({request_id:requestIds[6],phase:'DRAFT'}),
  pending:f=>f.state.items[1].state='PENDING',tamperedSource:f=>f.state.items[1].text_content+='changed',
 };
 for(const [name,change]of Object.entries(cases))await t.test(name,async()=>{
  const f=fixture();f.state.attempt=null;change(f);const before=structuredClone(f.state),r=await f.freeze(input);
  assert.equal(r.status,'RECONCILIATION_REQUIRED');noAuthority(r);assertUnchanged(f,before);
  assert.equal(f.state.attempt,null);assert.ok(!f.queries.some(q=>/^(INSERT INTO|UPDATE|DELETE FROM) opmx_tg_motor_attempts_v1/.test(q.sql)));
 });
});

test('a present attempt must match the unique stored event even after freeze',async()=>{
 const f=fixture();await f.freeze(input);f.state.events[0].event_id='evt_'+'f'.repeat(48);const before=structuredClone(f.state),r=await f.freeze(input);
 assert.equal(r.status,'RECONCILIATION_REQUIRED');noAuthority(r);assert.deepEqual(f.state,before);assert.equal(f.commits,1);assert.equal(f.runtimeCalls.length,1);
});

test('absent-attempt replay requires the same audit identity and a still closed fence',async t=>{
 const cases={actor:f=>f.state.audit[0].actor_key=actorKey(otherAdmin),owner:f=>f.state.audit[0].owner_key=actorKey(admin),duplicate:f=>f.state.audit.push({...f.state.audit[0]}),fence:f=>f.state.fence.state='READY_TO_WRITE',newRunningCapability:f=>f.state.attempt={state:'RUNNING',event_id:eventId,token_hash:hash('new token')}};
 for(const [name,change]of Object.entries(cases))await t.test(name,async()=>{
  const f=fixture();f.state.attempt=null;await f.freeze(input);change(f);const before=structuredClone(f.state),r=await f.freeze(input);
  assert.equal(r.status,'RECONCILIATION_REQUIRED');assert.deepEqual(f.state,before);assert.equal(f.commits,1);
  noAuthority(r);
 });
});

test('lost COMMIT acknowledgements for an absent attempt stay uncertain and replay without new attempts',async t=>{
 for(const beforeCommit of [false,true])await t.test(beforeCommit?'failure before persistence':'persisted but acknowledgement lost',async()=>{
  const f=fixture();f.state.attempt=null;const before=structuredClone(f.state);f.commitThrows=!beforeCommit;f.commitThrowsBefore=beforeCommit;
  const r=await f.freeze(input);assert.equal(r.status,'UNWRITTEN_FREEZE_UNCONFIRMED');noAuthority(r);assert.equal(f.state.attempt,null);assert.equal(f.cmsReads.length,0);
  if(beforeCommit)assert.deepEqual(f.state,before);else assert.equal(f.state.audit.length,1);
  f.commitThrows=false;f.commitThrowsBefore=false;const replay=await f.freeze(input);
  assert.equal(replay.status,beforeCommit?'UNWRITTEN_ATTEMPT_FROZEN':'UNWRITTEN_ATTEMPT_FREEZE_REPLAY');assert.equal(f.state.audit.length,1);assert.equal(f.state.attempt,null);noAuthority(replay);
 });
});

test('readiness observes the frozen revision and next real bot action, always rolling back without receipts or events',async t=>{
 for(const registered of [true,false])await t.test(registered?'revoked attempt':'no historical attempt',async()=>{
  const f=fixture();if(!registered)f.state.attempt=null;await f.freeze(input);
  const before=structuredClone(f.state),queryStart=f.queries.length,r=await f.readiness(input);
  assert.equal(r.status,'RECOVERY_READY_REQUIRES_BOT_OPEN');assert.equal(r.packageId,packageId);assert.equal(r.revision,revision);assert.equal(r.nextOpeningRevision,revision+1);
  assert.equal(r.command,`/abrir ${packageId}`);assert.equal(r.attemptState,registered?'REVOKED':'ABSENT');assert.equal(r.fenceState,'RECONCILING');assert.equal(r.auditState,'RECORDED');
  assert.deepEqual(r.inventory,{total:4,stored:4,pending:0});assert.equal(r.consistentSnapshot,true);assert.equal(r.writesRolledBack,true);noAuthority(r);
  assert.deepEqual(f.state,before);assert.equal(f.commits,1);assert.equal(f.rollbacks,1);assert.equal(f.runtimeCalls.length,2);assert.deepEqual(f.cmsReads,[]);
  const queries=f.queries.slice(queryStart);assert.match(queries[0].sql,/quota_v1/);assert.match(queries[1].sql,/packages_v1/);assert.match(queries[2].sql,/sessions_v1/);assert.deepEqual(queries[2].args,[actorKey(admin)]);assert.match(queries[3].sql,/recovery_leases_v1/);
  const changes=queries.filter(q=>/^(UPDATE|INSERT|DELETE)/.test(q.sql));
  assert.ok(changes.every(q=>q.sql.startsWith('UPDATE opmx_tg_publication_fence_v1')||registered&&q.sql.startsWith('UPDATE opmx_tg_motor_attempts_v1')));
  assert.ok(!JSON.stringify(r).includes('Synthetic test source'));assert.ok(!JSON.stringify(r).includes('telegram-'));
  const again=await f.readiness(input);assert.equal(again.status,r.status);assert.deepEqual(f.state,before);assert.equal(f.commits,1);assert.equal(f.rollbacks,2);assert.equal(f.state.audit.length,1);
 });
});

test('readiness requires a durable matching freeze and live unchanged evidence',async t=>{
 const target={request_id:requestIds[6],destination:'OPURO',target_key:hash('opmx:v1:OPURO:example-note'),status:'reported',post_id:19};
 const cases={
  missingAudit:f=>f.state.audit=[],wrongActor:f=>f.state.audit[0].actor_key=actorKey(otherAdmin),wrongOwner:f=>f.state.audit[0].owner_key=actorKey(admin),wrongAuditRevision:f=>f.state.audit[0].revision++,
  reopened:f=>f.state.package.state='OPEN',stale:f=>f.state.package.revision++,running:f=>f.state.attempt={state:'RUNNING',event_id:eventId},multipleAttempts:f=>f.state.extraAttempts.push({state:'REVOKED',event_id:eventId}),openFence:f=>f.state.fence.state='READY_TO_WRITE',
  noEvent:f=>f.state.events=[],duplicateEvent:f=>f.state.events.push({...f.state.events[0]}),wrongEvent:f=>{f.state.attempt={state:'REVOKED',event_id:eventId};f.state.events[0].event_id='evt_'+'f'.repeat(48)},
  missingBinding:f=>f.state.bindings.pop(),wrongClass:f=>f.state.classes[0].kind='API',changedGraph:f=>f.runtime.workflows[0].graph.nodes[0].parameters.code='different',busyWriter:f=>f.runtime.noActiveN8nWriters=false,
  pending:f=>f.state.items[1].state='PENDING',tampered:f=>f.state.items[1].text_content+='changed',receipt:f=>f.state.receipts.push({phase:'PUBLISH'}),update:f=>f.state.updates.push({destination:'OPURO'}),delivery:f=>f.state.deliveries.push({operation_id:'upd_'+hash('orphan')}),
  target:f=>f.state.targets.push(target),media:f=>f.state.media.push({request_id:requestIds[6],target_key:target.target_key,role:'featured',status:'reported',media_id:13}),claim:f=>f.state.claims.push({request_id:requestIds[6],slug:'example-note',destinations:'OPURO'}),
 };
 for(const [name,change]of Object.entries(cases))await t.test(name,async()=>{
  const f=fixture();f.state.attempt=null;await f.freeze(input);change(f);const before=structuredClone(f.state),r=await f.readiness(input);
  assert.equal(r.status,'RECONCILIATION_REQUIRED');noAuthority(r);assert.deepEqual(f.state,before);assert.equal(f.commits,1);assert.equal(f.rollbacks,1);assert.ok(!Object.hasOwn(r,'command'));
 });
 const f=fixture(),before=structuredClone(f.state),r=await f.readiness(input);assert.equal(r.status,'RECONCILIATION_REQUIRED');noAuthority(r);assertUnchanged(f,before);assert.equal(f.runtimeCalls.length,0);
});

test('readiness cannot suggest an opening revision outside the stored unsigned revision range',async()=>{
 const f=fixture();f.state.attempt=null;await f.freeze(input);f.state.package.revision=4294967295;
 f.state.audit[0].previous_revision=4294967295;f.state.audit[0].revision=4294967295;
 const before=structuredClone(f.state),r=await f.readiness({...input,revision:4294967295});
 assert.equal(r.status,'RECONCILIATION_REQUIRED');noAuthority(r);assert.deepEqual(f.state,before);assert.equal(f.commits,1);assert.equal(f.rollbacks,1);assert.equal(f.runtimeCalls.length,1);
});

test('readiness loads and parses retained file metadata exactly as real reopen before declaring eligibility',async t=>{
 for(const [name,attachment]of Object.entries({valid:JSON.stringify({file_name:'test.jpg',mime_type:'image/jpeg',declared_bytes:17}),malformed:'{',null:null}))await t.test(name,async()=>{
  const f=fixture();f.state.attempt=null;
  f.state.items.splice(2,0,{...item('file bytes are not source text',5),kind:'FILE',text_content:null,content_bytes:17,attachment_json:attachment,receipt_key:hash('file receipt'),fingerprint:hash('file fingerprint'),reserved_bytes:17});
  const frozen=await f.freeze(input);assert.equal(frozen.status,'UNWRITTEN_ATTEMPT_FROZEN');
  const before=structuredClone(f.state),queries=f.queries.length,r=await f.readiness(input);
  assert.equal(r.status,name==='malformed'?'RECONCILIATION_REQUIRED':'RECOVERY_READY_REQUIRES_BOT_OPEN');noAuthority(r);
  assert.deepEqual(f.state,before);assert.equal(f.commits,1);assert.equal(f.rollbacks,1);assert.equal(f.cmsReads.length,0);
  const inventory=f.queries.slice(queries).find(q=>q.sql.startsWith('SELECT i.item_id'));
  assert.match(inventory.sql,/i.receipt_key,i.fingerprint/);assert.match(inventory.sql,/i.attachment_json,i.reserved_bytes/);
  if(name==='malformed')assert.equal(f.runtimeCalls.length,1);else assert.deepEqual(r.inventory,{total:5,stored:5,pending:0});
 });
});

test('readiness respects the actual administrator session and package lease without taking either over',async t=>{
 for(const name of ['samePackageSession','otherPackageSession','lease','foreignActorSession'])await t.test(name,async()=>{
  const f=fixture();f.state.attempt=null;await f.freeze(input);
  if(name==='lease')f.state.lease={actor_key:actorKey(otherAdmin),owner_key:ownerKey};
  else f.state.session={owner_key:actorKey(name==='foreignActorSession'?otherAdmin:admin),package_id:name==='samePackageSession'?packageId:'tg_'+'b'.repeat(40)};
  const before=structuredClone(f.state),r=await f.readiness(input);
  assert.equal(r.status,name==='lease'?'NOT_REOPENABLE':name==='foreignActorSession'?'RECOVERY_READY_REQUIRES_BOT_OPEN':'SESSION_BUSY');
  noAuthority(r);assert.deepEqual(f.state,before);assert.equal(f.commits,1);assert.equal(f.rollbacks,1);
 });
});

test('readiness accepts only the exact private-chat admin scope before opening storage',async t=>{
 for(const [name,change]of Object.entries({nonAdmin:{owner:'333',chat:'333'},crossChat:{chat:otherAdmin},receipt:{receiptId:'telegram-12345-1-2'},assertion:{noPublicationSideEffects:true},stringRevision:{revision:'8'},zeroRevision:{revision:0},overflow:{revision:4294967296},badPackage:{packageId:'tg_bad'}}))await t.test(name,async()=>{
  const f=fixture(),r=await f.readiness({...input,...change});assert.equal(r.status,'UNWRITTEN_READINESS_NOT_AUTHORIZED');noAuthority(r);assert.equal(f.connections,0);
 });
});

test('failed rollback or release cannot report readonly readiness as confirmed',async t=>{
 for(const key of ['rollbackThrows','releaseThrows'])await t.test(key,async()=>{
  const f=fixture();f.state.attempt=null;await f.freeze(input);const before=structuredClone(f.state);f[key]=true;
  const r=await f.readiness(input);assert.equal(r.status,'RECONCILIATION_REQUIRED');noAuthority(r);assert.deepEqual(f.state,before);assert.equal(f.commits,1);assert.equal(f.rollbacks,1);assert.equal(f.destroys,key==='rollbackThrows'?1:0);
 });
});
