import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRevisionReconciliation} from './revision-reconciliation.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {writerGraphFingerprint} from './writer-release-contract.mjs';
const packageId='tg_'+'1'.repeat(40),revision=4,eventId='evt_'+'2'.repeat(48);
const labels=['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'];
const ids=labels.map(destination=>expectedDraftRequestId({packageId,revision,destination}));
const graph={nodes:[{name:'guarded',type:'code',typeVersion:2,parameters:{}}],connections:{}};
const workflows=['a','b','c','d'].map(id=>({id,activeVersionId:id,graph}));
const manifest={schema:'opmx.fenced-writer-release.v1',workflows:Object.fromEntries(workflows.map(w=>[w.id,{versionId:w.id,graphHash:writerGraphFingerprint(graph)}]))};
const runtime={status:'RUNTIME_OBSERVED',versionsMatch:true,noActiveN8nWriters:true,authorizesRecovery:false,motorTerminationVerified:false,workflows,observedAt:'2026-11-11T01:00:00Z'};
function setup(o={}){
 let state=o.state??'HISTORICAL_UNRECONCILED',revoked=false,observedFrozen=false;
 const target={request_id:ids[0],destination:'OPURO',status:'reported',post_id:19,target_key:createHash('sha256').update('opmx:v1:OPURO:example-note').digest('hex'),...o.target};
 const c={async execute(sql){
  if(sql.startsWith('SELECT state,revision FROM opmx_tg_packages'))return [[{state:'READY',revision}]];
  if(sql.startsWith('SELECT state,event_id'))return [o.attempts??[]];
  if(sql.startsWith('SELECT state FROM opmx_tg_publication'))return [[{state}]];
  if(sql.startsWith('SELECT event_id FROM'))return [[{event_id:eventId}]];
  if(sql.includes("SET state='RECONCILING'")){state='RECONCILING';return [{affectedRows:1}]}
  if(sql.includes("SET state='SAFE_TO_REOPEN'")){state='SAFE_TO_REOPEN';return [{affectedRows:1}]}
  if(sql.includes("SET state='REVOKED'")){revoked=true;return [{affectedRows:1}]}
  if(sql.startsWith('SELECT request_id FROM opmx_tg_request_binding'))return [(o.bindings??ids).map(request_id=>({request_id}))];
  if(sql.startsWith('SELECT request_id,kind'))return [ids.map(request_id=>({request_id,kind:'TELEGRAM'}))];
  if(sql.includes('FROM opmx_mcp_target_progress'))return [o.hasTarget?[target]:[]];
  if(sql.includes('FROM opmx_mcp_media_progress'))return [o.media??[]];
  if(sql.includes('FROM opmx_tg_publication_claims'))return [o.claims??[]];
  throw Error(sql);
 }};
 const service=createRevisionReconciliation({manifest,observeRuntime:async()=>{observedFrozen=state==='RECONCILING';return {...runtime,...o.runtime}},readWordPress:async()=>({statusCode:200,post:{id:19,type:'post',slug:'example-note',status:'publish',...o.post}})});
 return {c,service,getState:()=>({state,revoked,observedFrozen})};
}
test('historical revision revokes under the shared lock before observing, without claiming process termination',async()=>{
 const x=setup();const b=await x.service.lockSafetyBarrier(x.c,packageId,revision);
 assert.equal(b.capabilityRevoked,true);assert.equal(b.processTerminationClaimed,false);assert.equal(b.noPublicationSideEffects,true);assert.equal(x.getState().observedFrozen,true);
 assert.deepEqual(await x.service.lockVerifiedOutcomes(x.c,{packageId,revision,requestId:ids[0],destinations:['OPURO']}),[{destination:'OPURO',status:'BLOCKED',publicationVerdict:'NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'}]);
 assert.equal(await x.service.lockVerifiedOutcomes(x.c,{packageId,revision,requestId:ids[0],destinations:['OPURO']}),null);
});
test('a running Motor capability is revoked only after no n8n writer is in flight',async()=>{
 const x=setup({attempts:[{state:'RUNNING',event_id:eventId}]});await x.service.lockSafetyBarrier(x.c,packageId,revision);assert.equal(x.getState().revoked,true);
});
for(const [name,options] of Object.entries({active:{runtime:{noActiveN8nWriters:false}},wrongGraph:{runtime:{workflows:workflows.map(w=>({...w,graph:{...graph,connections:{changed:[]}}}))}},missingBinding:{bindings:ids.slice(1)},uncertainTarget:{hasTarget:true,target:{status:'writing',post_id:null}},missingCms:{hasTarget:true,post:{id:20}},changedSlug:{hasTarget:true,post:{slug:'different'}},trashed:{hasTarget:true,post:{status:'trash'}},pendingMedia:{hasTarget:true,media:[{request_id:ids[0],status:'uploading',media_id:null}]}}))test('fails closed: '+name,async()=>{
 const x=setup(options);assert.equal(await x.service.lockSafetyBarrier(x.c,packageId,revision),null);assert.notEqual(x.getState().state,'SAFE_TO_REOPEN');assert.equal(x.getState().revoked,false);
});
test('published identity is reconciled and is never presented as absent',async()=>{
 const x=setup({hasTarget:true});const b=await x.service.lockSafetyBarrier(x.c,packageId,revision);assert.equal(b.noPublicationSideEffects,false);assert.equal(b.allPublicationOutcomesVerified,true);
 const r=await x.service.lockVerifiedOutcomes(x.c,{packageId,revision,requestId:ids[0],destinations:['OPURO']});assert.equal(r[0].status,'PUBLISHED');assert.equal(r[0].postId,19);
});
test('another request label cannot inherit reconciled outcomes',async()=>{
 const x=setup({hasTarget:true});await x.service.lockSafetyBarrier(x.c,packageId,revision);assert.equal(await x.service.lockVerifiedOutcomes(x.c,{packageId,revision,requestId:ids[1],destinations:['OPURO']}),null);
});
