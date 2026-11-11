import {createHash} from 'node:crypto';
import {createRevisionReconciliation} from './revision-reconciliation.mjs';
import {createRevisionCapture} from './revision-capture.mjs';
import writerReleaseManifest from './writer-release-manifest.mjs';

const ownerKey=id=>createHash('sha256').update(`opmx:telegram:v1:${id}:${id}`).digest('hex');
const privateId=/^[1-9][0-9]{0,15}$/;
const eventId=/^evt_[a-f0-9]{48}$/;
const digest=/^[a-f0-9]{64}$/;
const action='RECONCILE_UNWRITTEN';

// Administrative reconciliation, not another Motor attempt or a write permit.
// The exact existing revision remains READY and permanently fenced. The same
// quota/package locks protect the real release/ledger/CMS gate, capability
// revocation and audit. No Telegram receipt, session, snapshot or event is made.
// manifest is a trusted assembly dependency, never an HTTP parameter.
export function createUnwrittenAttemptFreeze({pool,adminUserIds=[],observeRuntime,readWordPress,manifest=writerReleaseManifest}){
 if(typeof pool?.getConnection!=='function'||!Array.isArray(adminUserIds)||adminUserIds.some(id=>typeof id!=='string'||!privateId.test(id))||typeof observeRuntime!=='function'||typeof readWordPress!=='function')throw Error('UNWRITTEN_FREEZE_CONFIGURATION_INVALID');
 const admins=new Set(adminUserIds);
 const evidence=createRevisionReconciliation({observeRuntime,readWordPress,manifest});
 const capture=createRevisionCapture({lockVerifiedBlockedOutcomes:evidence.lockVerifiedOutcomes});
 const unavailable=()=>({status:'RECONCILIATION_REQUIRED',writeAuthorized:false,reopenAuthorized:false,retryPermitted:false,processTerminationClaimed:false});
 return async input=>{
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='chat,owner,packageId,revision'||typeof input.owner!=='string'||input.owner!==input.chat||!admins.has(input.owner)||!/^tg_[a-f0-9]{40}$/.test(input.packageId??'')||!Number.isSafeInteger(input.revision)||input.revision<1||input.revision>4294967295)return {status:'UNWRITTEN_FREEZE_NOT_AUTHORIZED',writeAuthorized:false,reopenAuthorized:false,retryPermitted:false,processTerminationClaimed:false};
  const {packageId,revision}=input,actor=ownerKey(input.owner);
  let c,transactionStarted=false,committed=false,commitAttempted=false;
  try{
   c=await pool.getConnection();await c.beginTransaction();transactionStarted=true;
   const [q]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(q.length!==1)return unavailable();
   const [p]=await c.execute('SELECT state,revision,owner_key FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);
   if(p.length!==1||p[0].state!=='READY'||Number(p[0].revision)!==revision||!digest.test(p[0].owner_key??''))return unavailable();
   const [attempts]=await c.execute('SELECT state,event_id FROM opmx_tg_motor_attempts_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   if(attempts.length!==1||!['RUNNING','BLOCKED','REVOKED'].includes(attempts[0].state)||!eventId.test(attempts[0].event_id??''))return unavailable();
   const [fences]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   if(fences.length!==1||!['READY_TO_WRITE','WRITING','HISTORICAL_UNRECONCILED','HISTORICAL_WRITING','RECONCILING'].includes(fences[0].state))return unavailable();
   const [audit]=await c.execute("SELECT actor_key,owner_key FROM opmx_tg_recovery_audit_v1 WHERE package_id=? AND action='RECONCILE_UNWRITTEN' AND previous_revision=? AND revision=? FOR UPDATE",[packageId,revision,revision]);
   if(audit.length>1||audit.length===1&&(audit[0].actor_key!==actor||audit[0].owner_key!==p[0].owner_key||attempts[0].state!=='REVOKED'||fences[0].state!=='RECONCILING'))return unavailable();
   // A create-only historical revision must not hide orphan update jobs or
   // writer acknowledgements merely because it has no saved UPDATE decision.
   // Presence is enough to require the more general reconciliation process.
   const [updates]=await c.execute('SELECT destination FROM opmx_tg_update_claims_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   const [deliveries]=await c.execute('SELECT operation_id FROM opmx_tg_update_deliveries_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   const [receipts]=await c.execute('SELECT request_id,phase FROM opmx_tg_writer_receipts_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   if(updates.length||deliveries.length||receipts.length)return unavailable();
   const [rows]=await c.execute('SELECT i.item_id,i.owner_key,i.kind,i.state,i.text_content,i.content_bytes,i.sha256,c.actor_key FROM opmx_tg_items_v1 i LEFT JOIN opmx_tg_recovery_contributions_v1 c ON c.item_id=i.item_id AND c.package_id=i.package_id WHERE i.package_id=? ORDER BY i.created_at,i.item_id FOR UPDATE',[packageId]);
   if(rows.some(r=>r.state==='PENDING'))return unavailable();
   const items=rows.map(r=>({itemId:r.item_id,ownerKey:r.owner_key,kind:r.kind,state:r.state,text:r.text_content,contentBytes:Number(r.content_bytes),sha256:r.sha256,actorKey:r.actor_key??null}));
   // Both providers read real locked records. A missing ID, transient absence
   // or caller-supplied assertion cannot stand in for complete zero effects.
   const barrier=await evidence.lockSafetyBarrier(c,packageId,revision);
   if(!barrier||barrier.packageId!==packageId||barrier.revision!==revision||barrier.terminalBlocked!==true||barrier.noActiveAttempts!==true||barrier.writesFenced!==true||barrier.capabilityRevoked!==true||barrier.noPublicationSideEffects!==true||barrier.allPublicationOutcomesVerified!==true||barrier.processTerminationClaimed!==false)return unavailable();
   const prior=await capture(c,packageId,revision,p[0].owner_key,items);
   if(!prior||prior.packageId!==packageId||prior.revision!==revision||prior.ownerKey!==p[0].owner_key||!Array.isArray(prior.destinations)||!prior.destinations.length||!Array.isArray(prior.results)||prior.results.length!==prior.destinations.length||prior.results.some((r,i)=>r.destination!==prior.destinations[i]||r.status!=='BLOCKED'||r.publicationVerdict!=='NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'||Object.hasOwn(r,'postId')))return unavailable();
   // SAFE_TO_REOPEN is a temporary gate result under this transaction. This
   // maintenance operation deliberately commits a closed state instead.
   const [closed]=await c.execute("UPDATE opmx_tg_publication_fence_v1 SET state='RECONCILING',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state='SAFE_TO_REOPEN'",[packageId,revision]);
   if(closed.affectedRows!==1)throw Error('UNWRITTEN_FREEZE_CONFLICT');
   if(audit.length===0){const [recorded]=await c.execute('INSERT INTO opmx_tg_recovery_audit_v1 (package_id,action,previous_revision,revision,actor_key,owner_key,created_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(6))',[packageId,action,revision,revision,actor,p[0].owner_key]);if(recorded.affectedRows!==1)throw Error('UNWRITTEN_FREEZE_AUDIT_UNCONFIRMED');}
   commitAttempted=true;await c.commit();committed=true;
   return {status:audit.length?'UNWRITTEN_ATTEMPT_FREEZE_REPLAY':'UNWRITTEN_ATTEMPT_FROZEN',packageId,revision,attemptState:'REVOKED',fenceState:'RECONCILING',results:prior.results.map(r=>({destination:r.destination,status:'BLOCKED'})),writeAuthorized:false,reopenAuthorized:false,retryPermitted:false,processTerminationClaimed:false};
  }catch{
   return commitAttempted?{status:'UNWRITTEN_FREEZE_UNCONFIRMED',writeAuthorized:false,reopenAuthorized:false,retryPermitted:false,processTerminationClaimed:false}:unavailable();
  }finally{
   if(c){if(transactionStarted&&!committed)try{await c.rollback()}catch{try{c.destroy?.()}catch{}}try{c.release()}catch{}}
  }
 };
}
