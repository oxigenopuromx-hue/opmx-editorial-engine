import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotorAttemptStore,initializeMotorAttempt} from './motor-attempt-store.mjs';
const packageId='tg_'+'a'.repeat(40),revision=7,eventId='evt_'+'b'.repeat(48),token='c'.repeat(64);
function fixture({fence='READY_TO_WRITE',failBlock=false}={}){
 let state={attempt:'QUEUED',fence,tokenHash:null};let chain=Promise.resolve(),locked;
 const pool={async getConnection(){
  let release;const prior=chain;chain=new Promise(r=>release=r);
  return {async beginTransaction(){await prior;locked=structuredClone(state)},async commit(){release()},async rollback(){state=locked;release()},release(){},async execute(sql,args){
   if(sql.startsWith('SELECT state,revision'))return [[{state:'READY',revision}]];
   if(sql.startsWith('SELECT state,event_id'))return [[{state:state.attempt,event_id:eventId,token_hash:state.tokenHash}]];
   if(sql.startsWith('SELECT state FROM opmx_tg_publication_fence'))return [[{state:state.fence}]];
   if(sql.includes("SET state='RUNNING'")){state.attempt='RUNNING';state.tokenHash=args[0];return [{affectedRows:1}];}
   if(sql.includes("SET state='RECONCILING'")){state.fence='RECONCILING';return [{affectedRows:1}];}
   if(sql.includes("SET state='BLOCKED'")){if(failBlock)throw Error('FAULT');state.attempt='BLOCKED';return [{affectedRows:1}];}
   throw Error('unexpected SQL '+sql);
  }};
 }};
 return {store:createMotorAttemptStore({pool,tokenFactory:()=>token}),get state(){return state}};
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
