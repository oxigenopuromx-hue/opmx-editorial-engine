import {createHash} from 'node:crypto';
import {createRevisionReconciliation} from './revision-reconciliation.mjs';
import {createRevisionCapture} from './revision-capture.mjs';
import writerReleaseManifest from './writer-release-manifest.mjs';

const ownerKey=id=>createHash('sha256').update(`opmx:telegram:v1:${id}:${id}`).digest('hex');
const privateId=/^[1-9][0-9]{0,15}$/;
const eventId=/^evt_[a-f0-9]{48}$/;
const digest=/^[a-f0-9]{64}$/;
const action='RECONCILE_UNWRITTEN';
const noAuthority={writeAuthorized:false,reopenAuthorized:false,retryPermitted:false,processTerminationClaimed:false};
const unavailable=(status='RECONCILIATION_REQUIRED')=>({status,...noAuthority});

// Both maintenance operations use the same locked records and authoritative
// gate. manifest is a trusted assembly dependency, never an HTTP parameter.
function createUnwrittenPreparation({pool,adminUserIds=[],observeRuntime,readWordPress,manifest=writerReleaseManifest}){
 if(typeof pool?.getConnection!=='function'||!Array.isArray(adminUserIds)||adminUserIds.some(id=>typeof id!=='string'||!privateId.test(id))||typeof observeRuntime!=='function'||typeof readWordPress!=='function')throw Error('UNWRITTEN_FREEZE_CONFIGURATION_INVALID');
 const admins=new Set(adminUserIds);
 const evidence=createRevisionReconciliation({observeRuntime,readWordPress,manifest});
 const capture=createRevisionCapture({lockVerifiedBlockedOutcomes:evidence.lockVerifiedOutcomes});
 const valid=input=>!!input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).sort().join(',')==='chat,owner,packageId,revision'&&typeof input.owner==='string'&&input.owner===input.chat&&admins.has(input.owner)&&/^tg_[a-f0-9]{40}$/.test(input.packageId??'')&&Number.isSafeInteger(input.revision)&&input.revision>=1&&input.revision<=4294967295;
 async function lock(c,input,{readiness=false}={}){
  const {packageId,revision}=input,actor=ownerKey(input.owner);
   const [q]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(q.length!==1)return null;
   const [p]=await c.execute('SELECT state,revision,owner_key FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);
   if(p.length!==1||p[0].state!=='READY'||Number(p[0].revision)!==revision||!digest.test(p[0].owner_key??''))return null;
   // Match the real reopen lock order. Eligibility never takes over an actor's
   // current session or another recovery lease, and must fit the next revision.
   if(readiness){
    if(revision>=4294967295)return null;
    const [sessions]=await c.execute('SELECT package_id FROM opmx_tg_sessions_v1 WHERE owner_key=? FOR UPDATE',[actor]);
    if(sessions.length)return {blockedBy:'SESSION_BUSY'};
    const [leases]=await c.execute('SELECT actor_key,owner_key FROM opmx_tg_recovery_leases_v1 WHERE package_id=? FOR UPDATE',[packageId]);
    if(leases.length)return {blockedBy:'NOT_REOPENABLE'};
   }
   const [attempts]=await c.execute('SELECT state,event_id FROM opmx_tg_motor_attempts_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   if(attempts.length>1||(attempts.length===1&&(!['RUNNING','BLOCKED','REVOKED'].includes(attempts[0].state)||!eventId.test(attempts[0].event_id??''))))return null;
   const [fences]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   if(fences.length!==1||!['READY_TO_WRITE','WRITING','HISTORICAL_UNRECONCILED','HISTORICAL_WRITING','RECONCILING'].includes(fences[0].state))return null;
   const [audit]=await c.execute("SELECT actor_key,owner_key FROM opmx_tg_recovery_audit_v1 WHERE package_id=? AND action='RECONCILE_UNWRITTEN' AND previous_revision=? AND revision=? FOR UPDATE",[packageId,revision,revision]);
   if(audit.length>1||(audit.length===1&&(audit[0].actor_key!==actor||audit[0].owner_key!==p[0].owner_key||(attempts.length===1&&attempts[0].state!=='REVOKED')||fences[0].state!=='RECONCILING')))return null;
   if(readiness&&audit.length!==1)return null;
   // A create-only historical revision must not hide orphan update jobs or
   // writer acknowledgements merely because it has no saved UPDATE decision.
   // Presence is enough to require the more general reconciliation process.
   const [updates]=await c.execute('SELECT destination FROM opmx_tg_update_claims_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   const [deliveries]=await c.execute('SELECT operation_id FROM opmx_tg_update_deliveries_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   const [receipts]=await c.execute('SELECT request_id,phase FROM opmx_tg_writer_receipts_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   if(updates.length||deliveries.length||receipts.length)return null;
   // Reopen parses attachment metadata before evaluating its gate. Readiness
   // must perform that same load so malformed retained metadata cannot be
   // advertised as an eligible /abrir merely because controls still validate.
   const projection=readiness?'i.item_id,i.owner_key,i.receipt_key,i.fingerprint,i.kind,i.state,i.text_content,i.attachment_json,i.reserved_bytes,i.content_bytes,i.sha256,c.actor_key':'i.item_id,i.owner_key,i.kind,i.state,i.text_content,i.content_bytes,i.sha256,c.actor_key';
   const [rows]=await c.execute(`SELECT ${projection} FROM opmx_tg_items_v1 i LEFT JOIN opmx_tg_recovery_contributions_v1 c ON c.item_id=i.item_id AND c.package_id=i.package_id WHERE i.package_id=? ORDER BY i.created_at,i.item_id FOR UPDATE`,[packageId]);
   if(rows.some(r=>r.state==='PENDING'))return null;
   const items=rows.map(r=>({itemId:r.item_id,ownerKey:r.owner_key,kind:r.kind,state:r.state,text:r.text_content,contentBytes:Number(r.content_bytes),sha256:r.sha256,actorKey:r.actor_key??null,...(readiness?{receiptKey:r.receipt_key,fingerprint:r.fingerprint,attachment:r.attachment_json?JSON.parse(r.attachment_json):null,reservedBytes:Number(r.reserved_bytes)}:{})}));
   // Both providers read real locked records. A missing ID, transient absence
   // or caller-supplied assertion cannot stand in for complete zero effects.
   const barrier=await evidence.lockSafetyBarrier(c,packageId,revision);
   if(!barrier||barrier.packageId!==packageId||barrier.revision!==revision||barrier.terminalBlocked!==true||barrier.noActiveAttempts!==true||barrier.writesFenced!==true||barrier.capabilityRevoked!==true||barrier.noPublicationSideEffects!==true||barrier.allPublicationOutcomesVerified!==true||barrier.processTerminationClaimed!==false)return null;
   const prior=await capture(c,packageId,revision,p[0].owner_key,items);
   if(!prior||prior.packageId!==packageId||prior.revision!==revision||prior.ownerKey!==p[0].owner_key||!Array.isArray(prior.destinations)||!prior.destinations.length||!Array.isArray(prior.results)||prior.results.length!==prior.destinations.length||prior.results.some((r,i)=>r.destination!==prior.destinations[i]||r.status!=='BLOCKED'||r.publicationVerdict!=='NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'||Object.hasOwn(r,'postId')))return null;
   return {packageId,revision,actor,owner:p[0].owner_key,attemptState:attempts.length?'REVOKED':'ABSENT',audit,prior,items};
 }
 return {valid,lock};
}

// Administrative reconciliation, not another Motor attempt or a write permit.
// The exact existing revision remains READY and permanently fenced. Historical
// revisions may predate the attempt registry; a missing attempt is never made.
// No Telegram receipt, session, snapshot or event is created.
export function createUnwrittenAttemptFreeze(options){
 const {pool}=options,prepare=createUnwrittenPreparation(options);
 return async input=>{
  if(!prepare.valid(input))return unavailable('UNWRITTEN_FREEZE_NOT_AUTHORIZED');
  let c,transactionStarted=false,committed=false,commitAttempted=false;
  try{
   c=await pool.getConnection();await c.beginTransaction();transactionStarted=true;
   const prepared=await prepare.lock(c,input);if(!prepared)return unavailable();
   const {packageId,revision,actor,owner,attemptState,audit,prior}=prepared;
   // SAFE_TO_REOPEN is a temporary gate result under this transaction. This
   // maintenance operation deliberately commits a closed state instead.
   const [closed]=await c.execute("UPDATE opmx_tg_publication_fence_v1 SET state='RECONCILING',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state='SAFE_TO_REOPEN'",[packageId,revision]);
   if(closed.affectedRows!==1)throw Error('UNWRITTEN_FREEZE_CONFLICT');
   if(audit.length===0){const [recorded]=await c.execute('INSERT INTO opmx_tg_recovery_audit_v1 (package_id,action,previous_revision,revision,actor_key,owner_key,created_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(6))',[packageId,action,revision,revision,actor,owner]);if(recorded.affectedRows!==1)throw Error('UNWRITTEN_FREEZE_AUDIT_UNCONFIRMED');}
   commitAttempted=true;await c.commit();committed=true;
   return {status:audit.length?'UNWRITTEN_ATTEMPT_FREEZE_REPLAY':'UNWRITTEN_ATTEMPT_FROZEN',packageId,revision,attemptState,fenceState:'RECONCILING',results:prior.results.map(r=>({destination:r.destination,status:'BLOCKED'})),...noAuthority};
  }catch{
   return commitAttempted?{status:'UNWRITTEN_FREEZE_UNCONFIRMED',writeAuthorized:false,reopenAuthorized:false,retryPermitted:false,processTerminationClaimed:false}:unavailable();
  }finally{
   if(c){if(transactionStarted&&!committed)try{await c.rollback()}catch{try{c.destroy?.()}catch{}}try{c.release()}catch{}}
  }
 };
}

// Read-only observation of a durable unwritten freeze and the real actor's
// next /abrir prerequisites. The shared gate temporarily checks its fence under
// locks; ROLLBACK restores the closed revision. A successful observation is not
// a reopen, a Telegram receipt, a READY event or permission to write to CMS.
export function createUnwrittenRecoveryReadiness(options){
 const {pool}=options,prepare=createUnwrittenPreparation(options);
 return async input=>{
  if(!prepare.valid(input))return unavailable('UNWRITTEN_READINESS_NOT_AUTHORIZED');
  let c,started=false,result=unavailable();
  try{
   c=await pool.getConnection();await c.beginTransaction();started=true;
   const prepared=await prepare.lock(c,input,{readiness:true});
   if(prepared?.blockedBy)result=unavailable(prepared.blockedBy);
   else if(prepared){
    const {packageId,revision,attemptState,items}=prepared;
    result={status:'RECOVERY_READY_REQUIRES_BOT_OPEN',packageId,revision,nextOpeningRevision:revision+1,attemptState,fenceState:'RECONCILING',auditState:'RECORDED',command:`/abrir ${packageId}`,inventory:{total:items.length,stored:items.filter(i=>i.state==='STORED').length,pending:0},consistentSnapshot:true,writesRolledBack:true,...noAuthority};
   }
  }catch{result=unavailable()}
  finally{
   if(c){
    if(started)try{await c.rollback()}catch{result=unavailable();try{c.destroy?.()}catch{}}
    try{c.release()}catch{result=unavailable()}
   }
  }
  return result;
 };
}
