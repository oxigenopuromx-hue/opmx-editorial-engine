import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPendingDestinationCancellation,destinationSelectionAllowedInTransaction,incident29CancellationScope,destinationCancellationSchema} from './destination-cancellation.mjs';
import {attestedControl} from './original-destination-policy.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {writerGraphFingerprint} from './writer-release-contract.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex'),actor=id=>hash(`opmx:telegram:v1:${id}:${id}`);
const scope=incident29CancellationScope,{packageId,revision}=scope,admin='12345',otherAdmin='67890',ownerKey=actor('99999'),eventId='evt_'+'e'.repeat(48);
const requestId=expectedDraftRequestId({packageId,revision,destination:'TODOS'});
const input={owner:admin,chat:admin,packageId,revision,requestId,destination:'LIBERAL',postId:393,operationId:'github-issue29-simey-liberal-cancel-20261113'};
const choices=['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'];
const requestIds=choices.map(destination=>expectedDraftRequestId({packageId,revision,destination}));
const item=(text,i)=>({item_id:'ti_'+String(i).repeat(40),owner_key:ownerKey,kind:'TEXT',state:'STORED',text_content:text,content_bytes:Buffer.byteLength(text),sha256:hash(text),actor_key:null});
function fixture(){
 const graph={nodes:[{name:'Guarded',type:'code',typeVersion:2,parameters:{}}],connections:{}};
 const workflows=['a','b','c','d'].map(id=>({id,activeVersionId:id,graph:structuredClone(graph)}));
 const manifest={schema:'opmx.fenced-writer-release.v1',workflows:Object.fromEntries(workflows.map(w=>[w.id,{versionId:w.id,graphHash:writerGraphFingerprint(w.graph)}]))};
 const f={state:{package:{state:'READY',revision,owner_key:ownerKey},attempt:{state:'RUNNING',event_id:eventId,token_hash:hash('test-only-token')},fence:{state:'HISTORICAL_WRITING'},events:[{event_id:eventId}],audit:[],cancellations:[],
  items:[item(attestedControl('/nuevo',packageId,1,2),1),item('Substantive source text used only by the integration fixture.',2),item(attestedControl('/publicar todos',packageId,3),3),item(attestedControl('/listo',packageId,4),4)],
  bindings:requestIds.map(request_id=>({request_id})),classes:requestIds.map(request_id=>({request_id,kind:'TELEGRAM'})),
  targets:['OPURO','OPOL','LIBERAL'].map(destination=>({request_id:requestId,destination,target_key:hash(`opmx:v1:${destination}:${scope.slug}`),status:'reported',post_id:scope.posts[destination]})),media:[],claims:[{request_id:requestId,slug:scope.slug,destinations:'TODOS'}],decisions:[],closures:[],updates:[],jobs:[],receipts:[]},
  posts:Object.fromEntries(['OPURO','OPOL','LIBERAL'].map(destination=>[scope.posts[destination],{id:scope.posts[destination],type:'post',status:destination==='LIBERAL'?'trash':'publish',slug:scope.slug+(destination==='LIBERAL'?'__trashed':'')}])),
  runtime:{status:'RUNTIME_OBSERVED',versionsMatch:true,noActiveN8nWriters:true,authorizesRecovery:false,motorTerminationVerified:false,workflows,observedAt:new Date().toISOString()},
  queries:[],cmsReads:[],runtimeCalls:[],commits:0,rollbacks:0,releases:0,connections:0,commitThrows:false,rollbackThrows:false,releaseThrows:false,destroys:0,insertFailure:false,auditFailure:false};
 let active=false,snapshot;
 const rows=x=>[structuredClone(x)],changed=n=>[{affectedRows:n}];
 const c={async beginTransaction(){assert.equal(active,false);active=true;snapshot=structuredClone(f.state)},async commit(){assert.equal(active,true);active=false;snapshot=null;f.commits++;if(f.commitThrows)throw Error('lost commit ACK')},async rollback(){f.rollbacks++;if(f.rollbackThrows)throw Error('rollback ACK lost');if(active){f.state=snapshot;active=false;snapshot=null}},release(){f.releases++;if(f.releaseThrows)throw Error('release failed')},destroy(){f.destroys++},
  async execute(sql,args=[]){
   assert.equal(active,true,'storage access belongs to the caller transaction');f.queries.push({sql,args:structuredClone(args)});const s=f.state;
   if(sql.startsWith('SELECT id FROM opmx_tg_quota_v1'))return rows([{id:1}]);
   if(sql.startsWith('SELECT state,revision,owner_key FROM opmx_tg_packages_v1'))return rows(s.package?[s.package]:[]);
   if(sql.startsWith('SELECT state,event_id FROM opmx_tg_motor_attempts_v1'))return rows(s.attempt?[s.attempt]:[]);
   if(sql.startsWith('SELECT state FROM opmx_tg_publication_fence_v1'))return rows(s.fence?[s.fence]:[]);
   if(sql.startsWith('SELECT package_id,revision,request_id,destination,post_id,operation_id,event_id,actor_key,owner_key,evidence_json,evidence_hash FROM opmx_tg_destination_cancellations_v1'))return rows(s.cancellations.filter(x=>x.package_id===args[0]||sql.includes('OR operation_id=')&&x.operation_id===args[1]));
   if(sql.startsWith('SELECT actor_key,owner_key FROM opmx_tg_recovery_audit_v1'))return rows(s.audit.filter(x=>x.package_id===args[0]&&x.action==='CANCEL_PENDING_DESTINATION'&&x.previous_revision===args[1]&&x.revision===args[2]));
   if(sql.startsWith('SELECT destination FROM opmx_tg_update_claims_v1'))return rows(s.updates);
   if(sql.startsWith('SELECT operation_id FROM opmx_tg_update_deliveries_v1'))return rows(s.jobs);
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
   if(sql.startsWith('UPDATE opmx_tg_publication_fence_v1')){if(!s.fence||s.fence.state!==args[2])return changed(0);s.fence.state='RECONCILING';return changed(1)}
   if(sql.startsWith('UPDATE opmx_tg_motor_attempts_v1')){if(s.attempt?.event_id!==args[2])return changed(0);s.attempt.state='REVOKED';s.attempt.token_hash=null;return changed(1)}
   if(sql.startsWith('INSERT INTO opmx_tg_destination_cancellations_v1')){if(f.insertFailure)return changed(0);const [package_id,revision,request_id,destination,post_id,operation_id,event_id,actor_key,owner_key,evidence_json,evidence_hash]=args;s.cancellations.push({package_id,revision,request_id,destination,post_id,operation_id,event_id,actor_key,owner_key,evidence_json,evidence_hash});return changed(1)}
   if(sql.startsWith('INSERT INTO opmx_tg_recovery_audit_v1')){if(f.auditFailure)return changed(0);const [package_id,action,previous_revision,revision,actor_key,owner_key]=args;s.audit.push({package_id,action,previous_revision,revision,actor_key,owner_key});return changed(1)}
   throw Error(`Unexpected SQL: ${sql}`);
  }};
 f.connection=c;
 const observeRuntime=async x=>{assert.equal(active,true);assert.equal(f.state.fence.state,'RECONCILING');f.runtimeCalls.push(x);return structuredClone(f.runtime)};
 const readWordPress=async x=>{assert.equal(active,true);f.cmsReads.push(x);return f.cmsError?{statusCode:404}:{statusCode:200,post:structuredClone(f.posts[x.postId])}};
 f.services=createPendingDestinationCancellation({pool:{getConnection:async()=>{f.connections++;return c}},adminUserIds:[admin,otherAdmin],observeRuntime,readWordPress,manifest});
 return f;
}
function noAuthority(r){for(const name of ['writeAuthorized','reopenAuthorized','resumeAuthorized','retryPermitted','processTerminationClaimed'])assert.equal(r[name],false,name);assert.equal(Object.hasOwn(r,'receiptHash'),false)}
async function denies(change){const f=fixture();change(f);const before=structuredClone(f.state),r=await f.services.cancel(input);assert.equal(r.status,'DELIVERY_CANCELLATION_UNCONFIRMED');noAuthority(r);assert.deepEqual(f.state,before);assert.equal(f.commits,0);assert.equal(f.rollbacks,1);return f}

test('cancels only the pending LIBERAL delivery already in trash and preserves both original published posts',async()=>{
 const f=fixture(),before=structuredClone(f.state),posts=structuredClone(f.posts),r=await f.services.cancel(input);
 assert.equal(r.status,'DELIVERY_CANCELLATION_CONFIRMED');noAuthority(r);assert.equal(r.publicationComplete,false);assert.equal(r.mixedOutcome,true);
 assert.deepEqual(r.results.map(x=>[x.destination,x.status,x.postId,x.wordpressStatus]),[['OPURO','PUBLISHED',10493,'publish'],['OPOL','PUBLISHED',3515,'publish'],['LIBERAL','CANCELLED',393,'trash']]);
 assert.equal(r.results[2].slug,scope.slug+'__trashed');assert.equal(r.results[2].originalSlug,scope.slug);assert.equal(r.writesFenced,true);assert.equal(r.noActiveN8nWriters,true);assert.equal(r.attemptState,'REVOKED');assert.match(r.tombstoneHash,/^[a-f0-9]{64}$/);
 assert.deepEqual(f.posts,posts);for(const key of ['package','items','targets','claims','bindings','classes','events','media','decisions','closures','updates','jobs','receipts'])assert.deepEqual(f.state[key],before[key],key);
 assert.equal(f.state.attempt.state,'REVOKED');assert.equal(f.state.attempt.token_hash,null);assert.equal(f.state.fence.state,'RECONCILING');assert.equal(f.state.cancellations.length,1);assert.equal(f.state.audit.length,1);assert.equal(f.commits,1);
 assert.deepEqual(f.cmsReads.map(x=>x.postId),[10493,3515,393]);assert.deepEqual(f.runtimeCalls,[{packageId,revision,eventId}]);
 assert.ok(f.queries.filter(x=>/^(INSERT|UPDATE|DELETE)/.test(x.sql)).every(x=>/opmx_tg_(?:publication_fence|motor_attempts|recovery_audit|destination_cancellations)_v1/.test(x.sql)));
 assert.doesNotMatch(JSON.stringify(r),/test-only-token|ownerKey|actorKey|Substantive/);
});

test('draft remains draft; no registered historical attempt is fabricated',async()=>{
 const f=fixture();f.state.attempt=null;f.posts[393].status='draft';f.posts[393].slug=scope.slug;const r=await f.services.cancel(input);
 assert.equal(r.status,'DELIVERY_CANCELLATION_CONFIRMED');assert.equal(r.attemptState,'NOT_REGISTERED');assert.equal(r.results[2].wordpressStatus,'draft');assert.equal(f.state.attempt,null);assert.equal(f.queries.some(x=>x.sql.startsWith('UPDATE opmx_tg_motor_attempts_v1')),false);
});

test('exact incident, admin, operation and request identity are mandatory before storage',async t=>{
 for(const [name,patch]of Object.entries({foreignAdmin:{owner:'333',chat:'333'},crossChat:{chat:otherAdmin},otherPackage:{packageId:'tg_'+'a'.repeat(40)},otherRevision:{revision:11},wrongRequest:{requestId:'tg_'+'f'.repeat(64)},wrongDestination:{destination:'OPURO'},otherPost:{postId:394},stringPost:{postId:'393'},operation:{operationId:'short'},freeEvidence:{cmsStatus:'draft'}}))await t.test(name,async()=>{const f=fixture(),r=await f.services.cancel({...input,...patch});assert.equal(r.status,'DELIVERY_CANCELLATION_NOT_AUTHORIZED');noAuthority(r);assert.equal(f.connections,0)});
});

test('stale revision, altered graph, active writer, missing bindings and original control corruption all roll back',async t=>{
 const cases={stale:f=>f.state.package.revision++,open:f=>f.state.package.state='OPEN',badOwner:f=>f.state.package.owner_key='bad',badEvent:f=>f.state.events[0].event_id='evt_'+'f'.repeat(48),missingFence:f=>f.state.fence=null,awaitingDecision:f=>f.state.fence.state='AWAITING_DECISION',active:f=>f.runtime.noActiveN8nWriters=false,graph:f=>f.runtime.workflows[0].graph.nodes[0].parameters.changed=true,staleRuntime:f=>f.runtime.observedAt='2026-01-01T00:00:00Z',bindings:f=>f.state.bindings.pop(),wrongClass:f=>f.state.classes[0].kind='API',pending:f=>f.state.items[1].state='PENDING',changedBytes:f=>f.state.items[1].text_content+='changed',foreignActor:f=>f.state.items[1].actor_key=actor(admin),noClose:f=>f.state.items.pop()};
 for(const [name,change]of Object.entries(cases))await t.test(name,()=>denies(change));
});

test('unverified identities, incomplete targets, orphan jobs and publication receipts fail closed',async t=>{
 const cases={missingTarget:f=>f.state.targets.pop(),wrongPost:f=>f.state.targets[2].post_id=394,unreported:f=>f.state.targets[2].status='writing',wrongSlugKey:f=>f.state.targets[2].target_key=hash('wrong'),duplicateTarget:f=>f.state.targets[2]=structuredClone(f.state.targets[0]),orphanMedia:f=>f.state.media.push({request_id:requestId,target_key:hash('orphan'),status:'reported',media_id:12}),wrongClaim:f=>f.state.claims[0].request_id=requestIds[0],wrongClaimScope:f=>f.state.claims[0].destinations='AMBOS',update:f=>f.state.updates.push({destination:'LIBERAL'}),job:f=>f.state.jobs.push({operation_id:'upd_test'}),publishReceipt:f=>f.state.receipts.push({request_id:requestId,phase:'PUBLISH'}),decision:f=>f.state.decisions.push({decision_json:'{}'}),closure:f=>f.state.closures.push({package_id:packageId})};
 for(const [name,change]of Object.entries(cases))await t.test(name,()=>denies(change));
});

test('published, missing, private or wrong-slug LIBERAL post cannot be called cancelled',async t=>{
 const cases={published:f=>{f.posts[393].status='publish';f.posts[393].slug=scope.slug},private:f=>f.posts[393].status='private',wrongTrashSlug:f=>f.posts[393].slug='another-note__trashed',wrongId:f=>f.posts[393].id=394,missing:f=>f.cmsError=true,otherPublishedMissing:f=>f.posts[10493].status='draft'};
 for(const [name,change]of Object.entries(cases))await t.test(name,()=>denies(change));
});

test('idempotent exact operation rechecks live safety, preserves one tombstone and one audit',async()=>{
 const f=fixture(),first=await f.services.cancel(input),after=structuredClone(f.state),second=await f.services.cancel(input);
 assert.equal(second.status,'DELIVERY_CANCELLATION_CONFIRMED');assert.equal(second.replay,true);assert.equal(second.tombstoneHash,first.tombstoneHash);assert.deepEqual(f.state,after);assert.equal(f.commits,2);assert.equal(f.runtimeCalls.length,2);
 const conflict=await f.services.cancel({...input,operationId:input.operationId+'-other'});assert.equal(conflict.status,'DELIVERY_CANCELLATION_UNCONFIRMED');assert.deepEqual(f.state,after);
 f.runtime.noActiveN8nWriters=false;const unsafe=await f.services.cancel(input);assert.equal(unsafe.status,'DELIVERY_CANCELLATION_UNCONFIRMED');assert.deepEqual(f.state,after);
});

test('failed insert or audit rolls back fence and token, without a partial cancellation',async t=>{
 for(const field of ['insertFailure','auditFailure'])await t.test(field,()=>denies(f=>f[field]=true));
});

test('lost COMMIT is uncertain and a separate read-only observer confirms durable state without retrying mutation',async()=>{
 const f=fixture();f.commitThrows=true;const r=await f.services.cancel(input);assert.equal(r.status,'DELIVERY_CANCELLATION_UNCONFIRMED');assert.equal(r.commitUncertain,true);assert.equal(r.nextAction,'OBSERVE_ONLY');noAuthority(r);assert.equal(f.state.cancellations.length,1);assert.equal(f.commits,1);
 const after=structuredClone(f.state),queries=f.queries.length,observed=await f.services.observe(input);
 assert.equal(observed.status,'DELIVERY_CANCELLATION_CONFIRMED');noAuthority(observed);assert.deepEqual(f.state,after);assert.equal(f.commits,1);assert.ok(f.queries.slice(queries).every(x=>x.sql.startsWith('SELECT')));assert.equal(observed.results[2].wordpressStatus,'trash');assert.ok(Date.parse(observed.observedAt)>=Date.parse(observed.cancellationObservedAt));
});

test('observer refuses stale CMS, reopened revisions, changed proof, missing audit and active writers',async t=>{
 const cases={cms:f=>f.posts[393].status='publish',revision:f=>f.state.package.revision++,fence:f=>f.state.fence.state='READY_TO_WRITE',token:f=>f.state.attempt.state='RUNNING',audit:f=>f.state.audit=[],hash:f=>f.state.cancellations[0].evidence_hash='f'.repeat(64),bytes:f=>f.state.cancellations[0].evidence_json+=' ',active:f=>f.runtime.noActiveN8nWriters=false};
 for(const [name,change]of Object.entries(cases))await t.test(name,async()=>{const f=fixture();await f.services.cancel(input);change(f);const before=structuredClone(f.state),r=await f.services.observe(input);assert.equal(r.status,'DELIVERY_CANCELLATION_UNCONFIRMED');noAuthority(r);assert.deepEqual(f.state,before);assert.equal(f.commits,1)});
});

test('observer never confirms reconciliation when read-transaction rollback or connection release fails',async t=>{
 for(const field of ['rollbackThrows','releaseThrows'])await t.test(field,async()=>{
  const f=fixture();await f.services.cancel(input);const before=structuredClone(f.state);f[field]=true;
  const r=await f.services.observe(input);assert.equal(r.status,'DELIVERY_CANCELLATION_UNCONFIRMED');noAuthority(r);assert.equal(r.nextAction,'OBSERVE_ONLY');assert.equal(Object.hasOwn(r,'tombstoneHash'),false);assert.deepEqual(f.state,before);assert.equal(f.commits,1);assert.equal(f.destroys,1);
 });
});

test('selection gate blocks the cancelled destination on every future revision, preserving other destinations',async()=>{
 const f=fixture();await f.services.cancel(input);await f.connection.beginTransaction();
 for(const destination of ['LIBERAL','TODOS','OPURO,LIBERAL','OPOL,LIBERAL'])assert.equal(await destinationSelectionAllowedInTransaction(f.connection,{packageId,destination}),false,destination);
 for(const destination of ['OPURO','OPOL','AMBOS'])assert.equal(await destinationSelectionAllowedInTransaction(f.connection,{packageId,destination}),true,destination);
 assert.equal(await destinationSelectionAllowedInTransaction(f.connection,{packageId:'tg_'+'a'.repeat(40),destination:'TODOS'}),true);
 assert.equal(await destinationSelectionAllowedInTransaction(f.connection,{packageId,destination:'todos'}),false);
 f.state.cancellations[0].evidence_hash='f'.repeat(64);assert.equal(await destinationSelectionAllowedInTransaction(f.connection,{packageId,destination:'OPURO'}),false);
 await f.connection.rollback();assert.equal(await destinationSelectionAllowedInTransaction({execute:async()=>{throw Error('offline')}},{packageId,destination:'OPURO'}),false);
});

test('schema is append-only authority separate from publication receipts and never erases CMS/history',()=>{
 assert.match(destinationCancellationSchema,/PRIMARY KEY\(package_id,destination\)/);assert.match(destinationCancellationSchema,/UNIQUE KEY\(operation_id\)/);assert.doesNotMatch(destinationCancellationSchema,/DELETE|TRUNCATE|opmx_tg_writer_receipts_v1/);
});
