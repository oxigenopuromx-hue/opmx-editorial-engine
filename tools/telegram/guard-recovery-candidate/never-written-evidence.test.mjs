import test from 'node:test';
import assert from 'node:assert/strict';
import {createNeverWrittenEvidence} from './never-written-evidence.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
const id='tg_'+'a'.repeat(40),revision=7,eventId='evt_'+'b'.repeat(48),labels=['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'];
const ids=labels.map(destination=>expectedDraftRequestId({packageId:id,revision,destination}));
function fixture({attempt='BLOCKED',fence='RECONCILING',target=false,media=false,missing=false,coverage=true,terminal=true,active=false}={}){
 const state={fence};const c={async execute(sql){
  if(sql.startsWith('SELECT state,event_id'))return [[{state:attempt,event_id:eventId}]];
  if(sql.startsWith('SELECT state FROM opmx_tg_publication_fence'))return [[{state:state.fence}]];
  if(sql.startsWith('SELECT event_id FROM opmx_tg_events'))return [[{event_id:eventId}]];
  if(sql.startsWith('SELECT request_id FROM opmx_tg_request_binding'))return [ids.slice(missing?1:0).map(request_id=>({request_id}))];
  if(sql.startsWith('SELECT request_id,kind'))return [ids.map(request_id=>({request_id,kind:'TELEGRAM'}))];
  if(sql.includes('FROM opmx_mcp_target_progress'))return [target?[{request_id:ids[0]}]:[]];
  if(sql.includes('FROM opmx_mcp_media_progress'))return [media?[{request_id:ids[0]}]:[]];
  if(sql.startsWith('UPDATE opmx_tg_publication_fence')){state.fence='SAFE_TO_REOPEN';return [{affectedRows:1}]};throw Error(sql);
 }};
 const identity={packageId:id,revision,eventId};const evidence=createNeverWrittenEvidence({verifyTerminalRun:async()=>({...identity,terminated:terminal,noActiveAttempts:!active}),verifyWriterCoverage:async()=>({...identity,allWritersParticipate:coverage})});
 return {c,evidence,state};
}
test('verified completed revision with no publisher writes can be fenced for reopening',async()=>{
 const f=fixture();const barrier=await f.evidence.lockSafetyBarrier(f.c,id,revision);assert.equal(barrier.noPublicationSideEffects,true);assert.equal(f.state.fence,'SAFE_TO_REOPEN');
 const results=await f.evidence.lockVerifiedBlockedOutcomes(f.c,{packageId:id,revision,requestId:ids[6],destinations:['OPURO','LIBERAL']});assert.deepEqual(results.map(x=>x.destination),['OPURO','LIBERAL']);
});
test('incomplete evidence or any write fails closed',async()=>{
 for(const opts of [{attempt:'RUNNING'},{fence:'WRITING'},{target:true},{media:true},{missing:true},{coverage:false},{terminal:false},{active:true}]){
  const f=fixture(opts);assert.equal(await f.evidence.lockSafetyBarrier(f.c,id,revision),null);
 }
});
test('evidence verifiers are required and unregistered requests cannot receive outcomes',async()=>{
 assert.throws(()=>createNeverWrittenEvidence({}),/EVIDENCE_PROVIDER_INCOMPLETE/);
 const f=fixture({fence:'SAFE_TO_REOPEN'});assert.equal(await f.evidence.lockVerifiedBlockedOutcomes(f.c,{packageId:id,revision,requestId:'unregistered',destinations:['OPURO']}),null);
});
