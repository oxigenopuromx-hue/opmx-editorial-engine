import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createMotorAttemptStore,initializeMotorAttempt} from './motor-attempt-store.mjs';
const packageId='tg_'+'a'.repeat(40),revision=7,eventId='evt_'+'b'.repeat(48),token='c'.repeat(64);
function fixture({fence='READY_TO_WRITE',failBlock=false,decision=null,literalVerified=false,updateVerified=false}={}){
 let state={attempt:'QUEUED',fence,tokenHash:null};let chain=Promise.resolve(),locked;
 const pool={async getConnection(){
  let release;const prior=chain;chain=new Promise(r=>release=r);
  return {async beginTransaction(){await prior;locked=structuredClone(state)},async commit(){release()},async rollback(){state=locked;release()},release(){},async execute(sql,args){
   if(sql.startsWith('SELECT id FROM opmx_tg_quota'))return [[{id:1}]];
   if(sql.startsWith('SELECT state,revision'))return [[{state:'READY',revision}]];
   if(sql.startsWith('SELECT state,event_id'))return [[{state:state.attempt,event_id:eventId,token_hash:state.tokenHash}]];
   if(sql.startsWith('SELECT state FROM opmx_tg_publication_fence'))return [[{state:state.fence}]];
   if(sql.includes("SET state='RUNNING'")){state.attempt='RUNNING';state.tokenHash=args[0];return [{affectedRows:1}];}
   if(sql.includes("SET state='READY_TO_WRITE'")){state.fence='READY_TO_WRITE';return [{affectedRows:1}];}
   if(sql.includes("SET state='RECONCILING'")){state.fence='RECONCILING';return [{affectedRows:1}];}
   if(sql.includes("SET state='BLOCKED'")){if(failBlock)throw Error('FAULT');state.attempt='BLOCKED';return [{affectedRows:1}];}
   throw Error('unexpected SQL '+sql);
  }};
 }};
 return {store:createMotorAttemptStore({pool,tokenFactory:()=>token,readDecision:async()=>decision,readUpdateDecision:async()=>decision,verifyLiteralEnforcement:async()=>literalVerified,verifyUpdateEnforcement:async()=>updateVerified}),get state(){return state}};
}
test('one claim wins, and a blocked attempt freezes its revision atomically',async()=>{
 const f=fixture(),input={packageId,revision,eventId};
 const result=await Promise.all([f.store.begin(input),f.store.begin(input)]);
 assert.deepEqual(result.map(x=>x.status).sort(),['ATTEMPT_ALREADY_CLAIMED','ATTEMPT_STARTED']);
 assert.deepEqual(await f.store.block({...input,token}),{status:'ATTEMPT_BLOCKED',reopenPermitted:false});
 assert.equal(f.state.attempt,'BLOCKED');assert.equal(f.state.fence,'RECONCILING');
 assert.equal((await f.store.block({...input,token})).status,'BLOCKED_REPLAY');
});
test('wrong capability and a publisher already writing never establish a block',async()=>{
 const f=fixture({fence:'WRITING'}),input={packageId,revision,eventId};
 assert.equal((await f.store.begin(input)).status,'ATTEMPT_NOT_PERMITTED');
 const g=fixture();await g.store.begin(input);assert.equal((await g.store.block({...input,token:'d'.repeat(64)})).status,'ATTEMPT_NOT_AUTHORIZED');
});
test('failed block rolls back the attempted fence transition',async()=>{
 const f=fixture({failBlock:true}),input={packageId,revision,eventId};await f.store.begin(input);
 await assert.rejects(()=>f.store.block({...input,token}),/FAULT/);assert.equal(f.state.fence,'READY_TO_WRITE');assert.equal(f.state.attempt,'RUNNING');
});
test('initial registration rejects event IDs not generated as event identifiers',async()=>{
 const calls=[];const c={async execute(sql,args){calls.push({sql,args})}};
 await initializeMotorAttempt(c,{packageId,revision,eventId});assert.deepEqual(calls[0].args,[packageId,revision,eventId]);
 await assert.rejects(()=>initializeMotorAttempt(c,{packageId,revision,eventId:'bad'}),/INVALID_ATTEMPT/);
});
test('a writer that starts after claim prevents a safe blocked transition',async()=>{
 const f=fixture(),input={packageId,revision,eventId};await f.store.begin(input);f.state.fence='WRITING';
 assert.equal((await f.store.block({...input,token})).status,'RECONCILIATION_REQUIRED');assert.equal(f.state.attempt,'RUNNING');assert.equal(f.state.fence,'WRITING');
});
test('existing webhook identity resolves the registered event before claiming the attempt',async()=>{
 const owner_key=createHash('sha256').update('opmx:telegram:v1:123:123').digest('hex');let calls=0;const pool={async getConnection(){calls++;if(calls===1)return {release(){},async execute(sql,args){assert.match(sql,/SELECT a.event_id,p.owner_key/);assert.deepEqual(args,[packageId,revision]);return [[{event_id:eventId,owner_key}]]}};
  return {release(){},async beginTransaction(){},async commit(){},async rollback(){},async execute(sql){if(sql.startsWith('SELECT state,revision'))return [[{state:'READY',revision,owner_key}]];if(sql.startsWith('SELECT state,event_id'))return [[{state:'QUEUED',event_id:eventId}]];if(sql.startsWith('SELECT state FROM opmx_tg_publication_fence'))return [[{state:'READY_TO_WRITE'}]];if(sql.includes("SET state='RUNNING'"))return [{affectedRows:1}];throw Error('unexpected SQL')}};
 }};
 const store=createMotorAttemptStore({pool,tokenFactory:()=>token});assert.deepEqual(await store.start({owner:'123',chat:'123',packageId,revision}),{status:'ATTEMPT_STARTED',token,eventId});assert.equal(calls,2);
 await assert.rejects(()=>store.start({owner:'123',chat:'123',packageId,revision,eventId}),/INVALID_ATTEMPT/);
});
test('missing or ambiguous attempt registration never claims an event',async()=>{
 for(const rows of [[],[{event_id:eventId},{event_id:eventId}],[{event_id:'bad'}],[{event_id:eventId,owner_key:'d'.repeat(64)}]]){let calls=0;const pool={async getConnection(){calls++;return {release(){},async execute(){return [rows]}}}};const store=createMotorAttemptStore({pool});assert.deepEqual(await store.start({owner:'123',chat:'123',packageId,revision}),{status:'ATTEMPT_NOT_REGISTERED'});assert.equal(calls,1)}
});
test('a changed owner between lookup and lock cannot obtain a capability',async()=>{
 const owner_key=createHash('sha256').update('opmx:telegram:v1:123:123').digest('hex');let calls=0,writes=0;
 const pool={async getConnection(){calls++;if(calls===1)return {release(){},async execute(){return [[{event_id:eventId,owner_key}]]}};return {release(){},async beginTransaction(){},async commit(){},async rollback(){},async execute(sql){if(sql.startsWith('SELECT state,revision'))return [[{state:'READY',revision,owner_key:'d'.repeat(64)}]];writes++;throw Error('unexpected write')}}}};
 assert.deepEqual(await createMotorAttemptStore({pool}).start({owner:'123',chat:'123',packageId,revision}),{status:'ATTEMPT_NOT_REGISTERED'});assert.equal(writes,0);
});
test('a recovered revision stays fenced until its exact decision is acknowledged by its claimed attempt',async()=>{
 const previewHash='d'.repeat(64),decision={package_id:packageId,revision,preview_hash:previewHash,destination:'OPURO',content_mode:'LITERAL',action:'CREATE'};
 const f=fixture({fence:'AWAITING_DECISION',decision,literalVerified:true}),key={packageId,revision,eventId};assert.equal((await f.store.begin(key)).status,'ATTEMPT_STARTED');
 const ack={...key,token,previewHash,destination:'OPURO',contentMode:'LITERAL',action:'CREATE'};
 assert.equal((await f.store.acknowledgeDecision({...ack,destination:'OPOL'})).status,'DECISION_MISMATCH');assert.equal(f.state.fence,'AWAITING_DECISION');
 assert.equal((await f.store.acknowledgeDecision({...ack,token:'f'.repeat(64)})).status,'ATTEMPT_NOT_AUTHORIZED');assert.equal(f.state.fence,'AWAITING_DECISION');
 assert.equal((await f.store.acknowledgeDecision(ack)).status,'DECISION_ACKNOWLEDGED');assert.equal(f.state.fence,'READY_TO_WRITE');
 assert.equal((await f.store.acknowledgeDecision(ack)).status,'DECISION_ACK_NOT_PERMITTED');
});
test('literal choice remains fenced when writer enforcement is unverified',async()=>{
 const previewHash='d'.repeat(64),decision={package_id:packageId,revision,preview_hash:previewHash,destination:'OPURO',content_mode:'LITERAL',action:'CREATE'},f=fixture({fence:'AWAITING_DECISION',decision});
 const key={packageId,revision,eventId};await f.store.begin(key);const out=await f.store.acknowledgeDecision({...key,token,previewHash,destination:'OPURO',contentMode:'LITERAL',action:'CREATE'});
 assert.equal(out.status,'LITERAL_ENFORCEMENT_UNCONFIRMED');assert.equal(f.state.fence,'AWAITING_DECISION');
});
test('a recovered attempt may freeze before acknowledgement but cannot write',async()=>{
 const f=fixture({fence:'AWAITING_DECISION'}),key={packageId,revision,eventId};assert.equal((await f.store.begin(key)).status,'ATTEMPT_STARTED');
 assert.equal((await f.store.block({...key,token})).status,'ATTEMPT_BLOCKED');assert.equal(f.state.fence,'RECONCILING');
});
test('update acknowledgement stays fenced unless exact target IDs and writer enforcement are proven',async()=>{
 const previewHash='d'.repeat(64),key={packageId,revision,eventId},decision={packageId,revision,previewHash,destination:'AMBOS',contentMode:'EDITORIAL',action:'UPDATE',posts:[{destination:'OPURO',postId:12},{destination:'OPOL',postId:34}]};
 const ack={...key,token,previewHash,destination:'AMBOS',contentMode:'EDITORIAL',action:'UPDATE'};
 const blocked=fixture({fence:'AWAITING_DECISION',decision});await blocked.store.begin(key);
 assert.equal((await blocked.store.acknowledgeDecision(ack)).status,'UPDATE_ENFORCEMENT_UNCONFIRMED');assert.equal(blocked.state.fence,'AWAITING_DECISION');
 const mismatch=fixture({fence:'AWAITING_DECISION',decision:{...decision,posts:[{destination:'OPURO',postId:0},{destination:'OPOL',postId:34}]},updateVerified:true});await mismatch.store.begin(key);
 assert.equal((await mismatch.store.acknowledgeDecision(ack)).status,'UPDATE_ENFORCEMENT_UNCONFIRMED');assert.equal(mismatch.state.fence,'AWAITING_DECISION');
 const good=fixture({fence:'AWAITING_DECISION',decision,updateVerified:true});await good.store.begin(key);
 assert.equal((await good.store.acknowledgeDecision({...ack,previewHash:'f'.repeat(64)})).status,'DECISION_MISMATCH');
 assert.equal((await good.store.acknowledgeDecision(ack)).status,'DECISION_ACKNOWLEDGED');assert.equal(good.state.fence,'READY_TO_WRITE');
});
