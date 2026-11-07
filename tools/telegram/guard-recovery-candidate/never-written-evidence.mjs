import {expectedDraftRequestId} from './correlation-candidate.mjs';
const labels=['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'];
const valid=(id,r)=>/^tg_[a-f0-9]{40}$/.test(id??'')&&Number.isSafeInteger(r)&&r>0&&r<=4294967295;
const exactProof=(x,id,revision,eventId,key)=>x&&x.packageId===id&&x.revision===revision&&x.eventId===eventId&&x[key]===true;

// Only for revisions whose bindings were installed before event delivery.
// Both verifiers are server-owned and MUST consult authoritative independent
// records; this module does not implement them. Never enable in production
// merely by returning true from a callback.
export function createNeverWrittenEvidence({verifyTerminalRun,verifyWriterCoverage}){
 if(typeof verifyTerminalRun!=='function'||typeof verifyWriterCoverage!=='function')throw Error('EVIDENCE_PROVIDER_INCOMPLETE');
 async function lockSafetyBarrier(c,id,revision){
  if(!c?.execute||!valid(id,revision))throw Error('INVALID_EVIDENCE_REQUEST');
  const [attempt]=await c.execute('SELECT state,event_id FROM opmx_tg_motor_attempts_v1 WHERE package_id=? AND revision=? FOR UPDATE',[id,revision]);
  if(attempt.length!==1||attempt[0].state!=='BLOCKED')return null;
  const eventId=attempt[0].event_id;
  if(!/^evt_[a-f0-9]{48}$/.test(eventId??''))return null;
  const [fence]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[id,revision]);
  if(fence.length!==1||fence[0].state!=='RECONCILING')return null;
  const [event]=await c.execute('SELECT event_id FROM opmx_tg_events_v1 WHERE event_id=? AND package_id=? AND revision=? FOR UPDATE',[eventId,id,revision]);
  if(event.length!==1)return null;
  const terminal=await verifyTerminalRun(c,{packageId:id,revision,eventId});
  const coverage=await verifyWriterCoverage(c,{packageId:id,revision,eventId});
  if(!exactProof(terminal,id,revision,eventId,'terminated')||terminal.noActiveAttempts!==true||!exactProof(coverage,id,revision,eventId,'allWritersParticipate'))return null;
  const expected=labels.map(destination=>expectedDraftRequestId({packageId:id,revision,destination}));
  const [bindings]=await c.execute('SELECT request_id FROM opmx_tg_request_binding_v1 WHERE package_id=? AND revision=? FOR UPDATE',[id,revision]);
  if(bindings.length!==expected.length||new Set(bindings.map(x=>x.request_id)).size!==expected.length||expected.some(x=>!bindings.some(y=>y.request_id===x)))return null;
  const marks=expected.map(()=>'?').join(',');
  const [classes]=await c.execute(`SELECT request_id,kind FROM opmx_tg_request_class_v1 WHERE request_id IN (${marks}) FOR UPDATE`,expected);
  if(classes.length!==expected.length||classes.some(x=>x.kind!=='TELEGRAM')||new Set(classes.map(x=>x.request_id)).size!==expected.length||expected.some(x=>!classes.some(y=>y.request_id===x)))return null;
  for(const table of ['opmx_mcp_target_progress','opmx_mcp_media_progress']){
   const [rows]=await c.execute(`SELECT request_id FROM ${table} WHERE request_id IN (${marks}) LIMIT 1 FOR UPDATE`,expected);
   if(rows.length)return null;
  }
  const [changed]=await c.execute("UPDATE opmx_tg_publication_fence_v1 SET state='SAFE_TO_REOPEN',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state='RECONCILING'",[id,revision]);
  if(changed.affectedRows!==1)throw Error('RECONCILIATION_CONFLICT');
  return {packageId:id,revision,terminalBlocked:true,noActiveAttempts:true,noPublicationSideEffects:true,writesFenced:true};
 }
 async function lockVerifiedBlockedOutcomes(c,decision){
  if(!c?.execute||!valid(decision?.packageId,decision?.revision)||!Array.isArray(decision.destinations)||!decision.destinations.length||decision.destinations.some(x=>!['OPURO','OPOL','LIBERAL'].includes(x)))return null;
  const [f]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[decision.packageId,decision.revision]);
  if(f.length!==1||f[0].state!=='SAFE_TO_REOPEN')return null;
  const expected=labels.map(destination=>expectedDraftRequestId({packageId:decision.packageId,revision:decision.revision,destination}));
  if(!expected.includes(decision.requestId))return null;
  return decision.destinations.map(destination=>({destination,status:'BLOCKED',publicationVerdict:'NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'}));
 }
 return {lockSafetyBarrier,lockVerifiedBlockedOutcomes};
}
