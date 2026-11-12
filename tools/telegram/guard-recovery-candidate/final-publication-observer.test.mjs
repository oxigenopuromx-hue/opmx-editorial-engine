import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createFinalPublicationObserver} from './final-publication-observer.mjs';
import {canonicalUpdateValue} from './canonical-json.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {writerGraphFingerprint} from './writer-release-contract.mjs';
import {destinationRegistry} from './original-destinations.mjs';

const packageId='tg_'+'a'.repeat(40),revision=8,eventId='evt_'+'e'.repeat(48);
const destination='TODOS',slug='qa-already-published-note';
const requestId=expectedDraftRequestId({packageId,revision,destination});
const hash=s=>createHash('sha256').update(s).digest('hex');
const input={packageId,revision};
const destinations=['OPURO','OPOL','LIBERAL'];
function fixture(){
 const graph={nodes:[{name:'Guarded writer',type:'code',typeVersion:2,parameters:{}}],connections:{}};
 const workflows=['a','b','c','d'].map(id=>({id,activeVersionId:id,graph:structuredClone(graph)}));
 const manifest={schema:'opmx.fenced-writer-release.v1',workflows:Object.fromEntries(workflows.map(w=>[w.id,{versionId:w.id,graphHash:writerGraphFingerprint(w.graph)}]))};
 const value={requestId,phase:'PUBLISH',slug,targets:destinations.map((destination,i)=>({destination,postId:100+i})),packageId,revision};
 const f={
  state:{quota:[{id:1}],packages:[{state:'READY',revision}],attempts:[{state:'RUNNING',event_id:eventId}],fences:[{state:'WRITING'}],events:[{event_id:eventId}],decisions:[],claims:[{request_id:requestId,slug,destinations:destination}],
   receipts:[],bindings:[{package_id:packageId,revision}],classes:[{kind:'TELEGRAM'}],ledger:value.targets.map(t=>({request_id:requestId,destination:t.destination,target_key:hash(`opmx:v1:${t.destination}:${slug}`),status:'reported',post_id:String(t.postId)}))},
  runtime:{status:'RUNTIME_OBSERVED',versionsMatch:true,noActiveN8nWriters:true,authorizesRecovery:false,motorTerminationVerified:false,workflows,executionPages:['running','waiting','new'].map(status=>({status,complete:true,executions:[]})),observedAt:'2026-11-12T17:00:00.000Z'},
  cms:Object.fromEntries(value.targets.map(t=>[destinationRegistry()[t.destination].cms,{statusCode:200,post:{id:t.postId,type:'post',status:'publish',slug}}])),
  queries:[],cmsReads:[],runtimeReads:[],connections:0,rollbacks:0,releases:0,destroys:0,rollbackThrows:false,connectionThrows:false,sqlThrows:false,cmsThrows:false,runtimeThrows:false,
 };
 f.receipt=value;
 f.setReceipt=value=>{const encoded=canonicalUpdateValue(value);f.state.receipts=[{request_id:value.requestId,phase:value.phase,receipt_hash:hash(encoded),receipt_json:encoded}];};
 f.setReceipt(value);
 let active=false;
 const c={
  async beginTransaction(){assert.equal(active,false);active=true;},
  async commit(){throw Error('COMMIT must never be used by an observation');},
  async rollback(){f.rollbacks++;active=false;if(f.rollbackThrows)throw Error('rollback unavailable');},
  release(){f.releases++;},destroy(){f.destroys++;},
  async execute(sql,args=[]){
   assert.equal(active,true);assert.match(sql,/^SELECT /);assert.match(sql,/FOR UPDATE$/);assert.doesNotMatch(sql,/token_hash/);
   f.queries.push({sql,args:structuredClone(args)});if(f.sqlThrows)throw Error('read unavailable');
   const s=f.state,rows=x=>[structuredClone(x)];
   if(sql.startsWith('SELECT id FROM opmx_tg_quota_v1'))return rows(s.quota);
   if(sql.startsWith('SELECT state,revision FROM opmx_tg_packages_v1'))return rows(s.packages);
   if(sql.startsWith('SELECT state,event_id FROM opmx_tg_motor_attempts_v1'))return rows(s.attempts);
   if(sql.startsWith('SELECT state FROM opmx_tg_publication_fence_v1'))return rows(s.fences);
   if(sql.startsWith('SELECT event_id FROM opmx_tg_events_v1'))return rows(s.events.filter(e=>e.event_id===args[2]));
   if(sql.startsWith('SELECT decision_json FROM opmx_tg_confirmed_decisions_v1'))return rows(s.decisions);
   if(sql.startsWith('SELECT request_id FROM opmx_tg_publication_claims_v1'))return rows(s.claims.map(x=>({request_id:x.request_id})));
   if(sql.startsWith('SELECT request_id,phase,receipt_hash,receipt_json FROM opmx_tg_writer_receipts_v1'))return rows(s.receipts.filter(r=>r.phase===args[2]));
   if(sql.startsWith('SELECT package_id,revision FROM opmx_tg_request_binding_v1'))return rows(s.bindings);
   if(sql.startsWith('SELECT kind FROM opmx_tg_request_class_v1'))return rows(s.classes);
   if(sql.startsWith('SELECT request_id,slug,destinations FROM opmx_tg_publication_claims_v1'))return rows(s.claims);
   if(sql.startsWith('SELECT request_id,destination,target_key,status,post_id FROM opmx_mcp_target_progress'))return rows(s.ledger);
   throw Error('Unexpected SQL: '+sql);
  },
 };
 const pool={async getConnection(){f.connections++;if(f.connectionThrows)throw Error('connection unavailable');return c;}};
 const observeRuntime=async scope=>{assert.equal(active,true);assert.match(f.queries[0].sql,/quota/);assert.match(f.queries[1].sql,/packages/);assert.match(f.queries[2].sql,/attempts/);assert.match(f.queries[3].sql,/fence/);f.runtimeReads.push(scope);if(f.runtimeThrows)throw Error('runtime unavailable');return structuredClone(f.runtime);};
 const readWordPress=async scope=>{assert.equal(active,true);f.cmsReads.push(scope);if(f.cmsThrows)throw Error('CMS unavailable');return structuredClone(f.cms[scope.site]);};
 f.observe=createFinalPublicationObserver({pool,observeRuntime,readWordPress,manifest});
 return f;
}
function assertNoPermission(r){assert.equal(r.writeAuthorized,false);assert.equal(r.retryPermitted,false);}
function assertUnconfirmed(r){assertNoPermission(r);assert.equal(r.status,'FINAL_PUBLICATION_UNCONFIRMED');assert.deepEqual(Object.keys(r).sort(),['retryPermitted','schema','status','writeAuthorized']);}

test('observes final durable PUBLISH receipt and live CMS under locks, without changing any row',async()=>{
 const f=fixture(),before=structuredClone(f.state),r=await f.observe(input);
 assert.equal(r.status,'FINAL_PUBLICATION_CONFIRMED');assertNoPermission(r);
 assert.equal(r.schema,'opmx.telegram.final-publication-observation.v1');assert.equal(r.packageId,packageId);assert.equal(r.revision,revision);assert.equal(r.requestId,requestId);assert.equal(r.destination,'TODOS');assert.equal(r.phase,'PUBLISH');assert.equal(r.receiptState,'RECORDED');assert.equal(r.receiptHash,f.state.receipts[0].receipt_hash);assert.equal(r.consistentSnapshot,true);assert.equal(r.writersIdleVerified,true);assert.equal(r.observedAt,f.runtime.observedAt);
 assert.deepEqual(r.targets,f.receipt.targets.map(t=>({...t,slug,status:'publish',cmsVerified:true,ledgerVerified:true})));
 assert.deepEqual(f.state,before);assert.deepEqual(f.runtimeReads,[{packageId,revision,eventId}]);assert.equal(f.cmsReads.length,3);assert.equal(f.rollbacks,1);assert.equal(f.releases,1);
 assert.equal(JSON.stringify(r).includes('token'),false);
});
for(const state of ['COMPLETED','BLOCKED','REVOKED'])test('completed publication may supersede a stale alert after attempt '+state,async()=>{const f=fixture();f.state.attempts[0].state=state;f.state.fences[0].state='RECONCILING';assert.equal((await f.observe(input)).status,'FINAL_PUBLICATION_CONFIRMED');assert.equal(f.rollbacks,1);});
for(const state of ['HISTORICAL_WRITING','RECONCILING','SETTLED'])test('supports final receipt with fence '+state,async()=>{const f=fixture();f.state.fences[0].state=state;assert.equal((await f.observe(input)).status,'FINAL_PUBLICATION_CONFIRMED');});
for(const [name,change] of [
 ['no quota',f=>f.state.quota=[]],['stale package revision',f=>f.state.packages[0].revision++],['OPEN package',f=>f.state.packages[0].state='OPEN'],['missing package',f=>f.state.packages=[]],
 ['missing attempt',f=>f.state.attempts=[]],['unclaimed attempt',f=>f.state.attempts[0].state='QUEUED'],['invalid event',f=>f.state.attempts[0].event_id='untrusted'],['missing fence',f=>f.state.fences=[]],['not started fence',f=>f.state.fences[0].state='READY_TO_WRITE'],
 ['active writer',f=>{f.runtime.noActiveN8nWriters=false;f.runtime.executionPages[0].executions=[{id:'1'}];}],['incomplete pagination',f=>f.runtime.executionPages[1].complete=false],['missing execution page',f=>f.runtime.executionPages.pop()],['duplicate page',f=>f.runtime.executionPages[1].status='running'],['claimed idle but nonempty page',f=>f.runtime.executionPages[0].executions=[{id:'1'}]],['invalid observed timestamp',f=>f.runtime.observedAt='yesterday'],
 ['changed active version',f=>f.runtime.workflows[0].activeVersionId='new'],['changed writer graph',f=>f.runtime.workflows[0].graph.nodes[0].parameters={unguarded:true}],['missing writer graph',f=>f.runtime.workflows.pop()],['runtime network error',f=>f.runtimeThrows=true],
 ['missing event binding',f=>f.state.events=[]],['malformed saved decision',f=>f.state.decisions=[{decision_json:'{bad'}]],['UPDATE decision',f=>f.state.decisions=[{decision_json:'{"action":"UPDATE"}'}]],
 ['no durable receipt despite published CMS',f=>f.state.receipts=[]],['DRAFT receipt only',f=>f.setReceipt({...f.receipt,phase:'DRAFT'})],['corrupt receipt hash',f=>f.state.receipts[0].receipt_hash='0'.repeat(64)],
 ['wrong receipt package',f=>f.setReceipt({...f.receipt,packageId:'tg_'+'b'.repeat(40)})],['wrong receipt revision',f=>f.setReceipt({...f.receipt,revision:9})],['wrong receipt request',f=>f.setReceipt({...f.receipt,requestId:'tg_'+'b'.repeat(64)})],
 ['noncanonical receipt serialization',f=>{f.state.receipts[0].receipt_json+=' ';f.state.receipts[0].receipt_hash=hash(f.state.receipts[0].receipt_json);}],['duplicate receipt target',f=>f.setReceipt({...f.receipt,targets:[f.receipt.targets[0],f.receipt.targets[0]]})],['partial receipt',f=>f.setReceipt({...f.receipt,targets:f.receipt.targets.slice(0,2)})],
 ['missing request binding',f=>f.state.bindings=[]],['wrong request binding revision',f=>f.state.bindings[0].revision++],['wrong request class',f=>f.state.classes[0].kind='FORM'],['missing request class',f=>f.state.classes=[]],
 ['missing publication claim',f=>f.state.claims=[]],['wrong claim request',f=>f.state.claims[0].request_id='tg_'+'b'.repeat(64)],['wrong claim slug',f=>f.state.claims[0].slug='other-note'],['wrong claim destinations',f=>f.state.claims[0].destinations='AMBOS'],
 ['missing target',f=>f.state.ledger.pop()],['duplicate target',f=>f.state.ledger[1]=structuredClone(f.state.ledger[0])],['wrong ledger request',f=>f.state.ledger[0].request_id='tg_'+'b'.repeat(64)],['unreported target',f=>f.state.ledger[0].status='started'],['wrong ledger ID',f=>f.state.ledger[0].post_id='999'],['wrong target hash',f=>f.state.ledger[0].target_key='f'.repeat(64)],
 ['CMS network error',f=>f.cmsThrows=true],['CMS non-200',f=>f.cms['https://cms.oxigenopuro.com.mx'].statusCode=404],['CMS different ID',f=>f.cms['https://cms.oxigenopuro.com.mx'].post.id=999],['CMS different slug',f=>f.cms['https://cms.oxigenopuro.com.mx'].post.slug='other-note'],['CMS still draft',f=>f.cms['https://cms.elliberal.mx'].post.status='draft'],['CMS wrong type',f=>f.cms['https://cms.oxigenopolitico.com.mx'].post.type='page'],['SQL failure',f=>f.sqlThrows=true],
 ])test('preserves uncertainty: '+name,async()=>{const f=fixture();change(f);const before=structuredClone(f.state);assertUnconfirmed(await f.observe(input));assert.deepEqual(f.state,before);assert.equal(f.rollbacks,1);assert.equal(f.releases,1);});

test('failed rollback cannot return a confirmed observation',async()=>{const f=fixture();f.rollbackThrows=true;assertUnconfirmed(await f.observe(input));assert.equal(f.destroys,1);assert.equal(f.releases,1);});
test('connection failure returns no proof',async()=>{const f=fixture();f.connectionThrows=true;assertUnconfirmed(await f.observe(input));assert.equal(f.rollbacks,0);});
for(const bad of [null,[],{}, {...input,owner:'123'},{...input,requestId},{...input,targets:[]},{...input,revision:0},{...input,revision:4294967296},{...input,revision:8.1},{...input,revision:'8'},{...input,packageId:'tg_invalid'}])test('rejects client-supplied scope or authority '+JSON.stringify(bad),async()=>{const f=fixture();assertUnconfirmed(await f.observe(bad));assert.equal(f.connections,0);});
test('separate CMS may legitimately have equal numeric IDs',async()=>{const f=fixture();f.setReceipt({...f.receipt,targets:f.receipt.targets.map(t=>({...t,postId:100}))});f.state.ledger.forEach(t=>t.post_id='100');Object.values(f.cms).forEach(t=>t.post.id=100);assert.equal((await f.observe(input)).status,'FINAL_PUBLICATION_CONFIRMED');});
