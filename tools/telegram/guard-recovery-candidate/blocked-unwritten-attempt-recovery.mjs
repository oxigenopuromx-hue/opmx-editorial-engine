import {createHash,randomBytes} from 'node:crypto';
import {createRevisionReconciliation} from './revision-reconciliation.mjs';
import {createRevisionCapture} from './revision-capture.mjs';
import {readConfirmedCorrectionInTransaction} from './confirmed-correction-reader.mjs';
import {destinationSelectionAllowedInTransaction} from './destination-cancellation.mjs';
import {resolveDestinations,destinationLabel} from './original-destinations.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import writerReleaseManifest from './writer-release-manifest.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const event=value=>typeof value==='string'&&/^evt_[a-f0-9]{48}$/.test(value);
const actorKey=id=>sha(`opmx:telegram:v1:${id}:${id}`);
const labels=['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'];
const action='RESUME_UNWRITTEN';
const noAuthority={writeAuthorized:false,reopenAuthorized:false,retryPermitted:false,processTerminationClaimed:false};
const denied=(status='RECONCILIATION_REQUIRED')=>({status,...noAuthority});
const uncertain=()=>({...denied('BLOCKED_RECOVERY_UNCONFIRMED'),nextAction:'OBSERVE_ONLY'});
const originValid=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')==='executionId,workflowId'&&x.workflowId==='bnzVMNkZuGO1GQCZ'&&typeof x.executionId==='string'&&/^[1-9][0-9]{0,31}$/.test(x.executionId);

// Resume a proven unwritten BLOCKED attempt, not a new package or publication.
// The ordinary acknowledgement remains mandatory: the returned capability has
// no permission to write until the same confirmed decision passes that gate.
export function createBlockedUnwrittenAttemptRecovery({pool,adminUserIds=[],observeRuntime,readWordPress,manifest=writerReleaseManifest,tokenFactory=()=>randomBytes(32).toString('hex'),now=Date.now}){
 if(typeof pool?.getConnection!=='function'||!Array.isArray(adminUserIds)||adminUserIds.some(id=>typeof id!=='string'||!/^[1-9][0-9]{0,15}$/.test(id))||typeof observeRuntime!=='function'||typeof readWordPress!=='function'||typeof tokenFactory!=='function'||typeof now!=='function')throw Error('BLOCKED_RECOVERY_CONFIGURATION_INVALID');
 const admins=new Set(adminUserIds);
 const valid=input=>input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).sort().join(',')===(Object.hasOwn(input,'origin')?'chat,eventId,origin,owner,packageId,previewHash,revision':'chat,eventId,owner,packageId,previewHash,revision')&&(!Object.hasOwn(input,'origin')||originValid(input.origin))&&typeof input.owner==='string'&&input.owner===input.chat&&admins.has(input.owner)&&/^tg_[a-f0-9]{40}$/.test(input.packageId??'')&&Number.isSafeInteger(input.revision)&&input.revision>=2&&input.revision<=4294967295&&event(input.eventId)&&hex(input.previewHash);
 return async input=>{
  if(!valid(input))return denied('RECOVERY_NOT_AUTHORIZED');
  const {packageId,revision,eventId,previewHash,origin}=input;
  const evidence=createRevisionReconciliation({observeRuntime:scope=>observeRuntime(scope,origin?{nonWritingRecoveryExecution:origin}:{}),readWordPress,manifest,nonWritingRecoveryExecution:origin??null});
  const capture=createRevisionCapture({lockVerifiedBlockedOutcomes:evidence.lockVerifiedOutcomes});
  let c,started=false,committed=false,commitAttempted=false,result=denied();
  try{
   c=await pool.getConnection();started=true;await c.beginTransaction();
   result=await (async()=>{
    // Match the package/quota lock order of seal/reopen and all audited writers.
    const [quota]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(quota.length!==1)return denied();
    const [packages]=await c.execute('SELECT state,revision,owner_key FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);
    if(packages.length!==1||packages[0].state!=='READY'||Number(packages[0].revision)!==revision||!hex(packages[0].owner_key))return denied('STALE_REVISION');
    const ownerKey=packages[0].owner_key;
    const [attempts]=await c.execute('SELECT state,event_id,token_hash FROM opmx_tg_motor_attempts_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    if(attempts.length!==1||attempts[0].event_id!==eventId||!((attempts[0].state==='BLOCKED'&&hex(attempts[0].token_hash))||(attempts[0].state==='QUEUED'&&attempts[0].token_hash===null)))return denied('RECOVERY_NOT_PERMITTED');
    const previousTokenHash=attempts[0].token_hash;
    const [fences]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    if(fences.length!==1||!(attempts[0].state==='BLOCKED'&&fences[0].state==='RECONCILING'||attempts[0].state==='QUEUED'&&fences[0].state==='AWAITING_DECISION'))return denied();
    const [audits]=await c.execute("SELECT actor_key,owner_key FROM opmx_tg_recovery_audit_v1 WHERE package_id=? AND action='RESUME_UNWRITTEN' AND previous_revision=? AND revision=? FOR UPDATE",[packageId,revision,revision]);
    if(audits.length)return denied('RECOVERY_NOT_PERMITTED');
    const [sessions]=await c.execute('SELECT owner_key FROM opmx_tg_sessions_v1 WHERE package_id=? FOR UPDATE',[packageId]);
    const [leases]=await c.execute('SELECT actor_key,owner_key FROM opmx_tg_recovery_leases_v1 WHERE package_id=? FOR UPDATE',[packageId]);
    if(sessions.length||leases.length)return denied();
    let decision;try{decision=await readConfirmedCorrectionInTransaction(c,packageId,revision)}catch{return denied('DECISION_UNCONFIRMED')}
    if(!decision||decision.package_id!==packageId||decision.revision!==revision||decision.action!=='CREATE'||decision.content_mode!=='EDITORIAL'||decision.preview_hash!==previewHash)return denied('DECISION_MISMATCH');
    let destinations;try{destinations=resolveDestinations(decision.destination);if(destinationLabel(destinations)!==decision.destination)return denied('DECISION_MISMATCH')}catch{return denied('DECISION_MISMATCH')}
    if(await destinationSelectionAllowedInTransaction(c,{packageId,destination:decision.destination})!==true)return denied('RECOVERY_NOT_PERMITTED');
    const expected=labels.map(destination=>expectedDraftRequestId({packageId,revision,destination})),marks=expected.map(()=>'?').join(',');
    // Presence is disqualifying, including a reservation or acceptance that
    // has no reported post yet. No absence of a post/notice is used as proof.
    for(const table of ['opmx_mcp_requests','opmx_mcp_targets','opmx_mcp_target_progress','opmx_mcp_media_progress']){
     const [rows]=await c.execute(`SELECT request_id FROM ${table} WHERE request_id IN (${marks}) LIMIT 1 FOR UPDATE`,expected);if(rows.length)return denied();
    }
    for(const table of ['opmx_tg_publication_claims_v1','opmx_tg_publisher_submissions_v1','opmx_tg_writer_receipts_v1']){
     const [rows]=await c.execute(`SELECT request_id FROM ${table} WHERE (package_id=? AND revision=?) OR request_id IN (${marks}) LIMIT 1 FOR UPDATE`,[packageId,revision,...expected]);if(rows.length)return denied();
    }
    const [updates]=await c.execute('SELECT destination FROM opmx_tg_update_claims_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    const [jobs]=await c.execute('SELECT operation_id FROM opmx_tg_update_deliveries_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    if(updates.length||jobs.length)return denied();
    const [rows]=await c.execute('SELECT i.item_id,i.owner_key,i.kind,i.state,i.text_content,i.attachment_json,i.content_bytes,i.sha256,OCTET_LENGTH(i.content_blob) AS blob_bytes,SHA2(i.content_blob,256) AS blob_sha256,c.actor_key FROM opmx_tg_items_v1 i LEFT JOIN opmx_tg_recovery_contributions_v1 c ON c.item_id=i.item_id AND c.package_id=i.package_id WHERE i.package_id=? ORDER BY i.created_at,i.item_id FOR UPDATE',[packageId]);
    if(!rows.length||rows.length>40||new Set(rows.map(r=>r.item_id)).size!==rows.length)return denied();
    const items=[];
    for(const row of rows){
     if(!/^ti_[a-f0-9]{40}$/.test(row.item_id??'')||row.owner_key!==ownerKey||!['TEXT','FILE'].includes(row.kind)||!['STORED','DISCARDED'].includes(row.state))return denied();
     const bytes=Number(row.content_bytes);let attachment=null;
     if(!Number.isSafeInteger(bytes)||bytes<0||bytes>10*1024*1024)return denied();
     try{attachment=row.attachment_json?JSON.parse(row.attachment_json):null}catch{return denied()}
     if(row.state==='STORED'){
      if(!hex(row.sha256))return denied();
      if(row.kind==='TEXT'&&(typeof row.text_content!=='string'||Buffer.byteLength(row.text_content)!==bytes||sha(row.text_content)!==row.sha256))return denied();
      if(row.kind==='FILE'&&(bytes<1||Number(row.blob_bytes)!==bytes||row.blob_sha256!==row.sha256))return denied();
     }
     items.push({itemId:row.item_id,ownerKey:row.owner_key,kind:row.kind,state:row.state,text:row.text_content,attachment,contentBytes:bytes,sha256:row.sha256,actorKey:row.actor_key??null});
    }
    const [confirmed]=await c.execute('SELECT decision_json FROM opmx_tg_confirmed_decisions_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    let materials;try{if(confirmed.length!==1)return denied('DECISION_UNCONFIRMED');materials=JSON.parse(confirmed[0].decision_json).materials}catch{return denied('DECISION_UNCONFIRMED')}
    const active=items.filter(item=>item.state==='STORED');
    if(!Array.isArray(materials)||materials.length!==active.length||materials.some((m,i)=>!m||m.itemId!==active[i].itemId||m.kind!==active[i].kind||m.state!=='STORED'||m.sha256!==active[i].sha256))return denied('DECISION_MISMATCH');
    // This is the actual pinned all-writers gate and immutable policy capture,
    // not caller assertions. Its temporary revocation is rolled back on failure.
    const barrier=await evidence.lockSafetyBarrier(c,packageId,revision);
    const observed=Date.parse(barrier?.observedAt),current=now();
    if(!barrier||barrier.packageId!==packageId||barrier.revision!==revision||barrier.terminalBlocked!==true||barrier.noActiveAttempts!==true||barrier.writesFenced!==true||barrier.capabilityRevoked!==true||barrier.noPublicationSideEffects!==true||barrier.allPublicationOutcomesVerified!==true||barrier.processTerminationClaimed!==false||!Number.isFinite(observed)||!Number.isFinite(current)||observed>current+5000||current-observed>120000)return denied();
    const prior=await capture(c,packageId,revision,ownerKey,items),requestId=expectedDraftRequestId({packageId,revision,destination:decision.destination});
    if(!prior||prior.packageId!==packageId||prior.revision!==revision||prior.ownerKey!==ownerKey||prior.requestId!==requestId||prior.contentMode!=='EDITORIAL'||prior.confirmedPreviewHash!==previewHash||prior.destinations?.join(',')!==destinations.join(',')||prior.authorization?.authorized!==true||!['DRAFT','PUBLISH'].includes(prior.authorization.mode)||!Array.isArray(prior.results)||prior.results.length!==destinations.length||prior.results.some((r,i)=>r.destination!==destinations[i]||r.status!=='BLOCKED'||r.publicationVerdict!=='NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'||Object.hasOwn(r,'postId')))return denied();
    const token=tokenFactory();if(!hex(token)||sha(token)===previousTokenHash)throw Error('BLOCKED_RECOVERY_TOKEN_INVALID');
    const [closed]=await c.execute("UPDATE opmx_tg_publication_fence_v1 SET state='AWAITING_DECISION',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state='SAFE_TO_REOPEN'",[packageId,revision]);if(closed.affectedRows!==1)throw Error('BLOCKED_RECOVERY_FENCE_CONFLICT');
    const [resumed]=await c.execute("UPDATE opmx_tg_motor_attempts_v1 SET state='RUNNING',token_hash=?,updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND event_id=? AND state='REVOKED' AND token_hash IS NULL",[sha(token),packageId,revision,eventId]);if(resumed.affectedRows!==1)throw Error('BLOCKED_RECOVERY_ATTEMPT_CONFLICT');
    const [audit]=await c.execute('INSERT INTO opmx_tg_recovery_audit_v1 (package_id,action,previous_revision,revision,actor_key,owner_key,created_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(6))',[packageId,action,revision,revision,actorKey(input.owner),ownerKey]);if(audit.affectedRows!==1)throw Error('BLOCKED_RECOVERY_AUDIT_UNCONFIRMED');
    commitAttempted=true;await c.commit();committed=true;
    return {status:attempts[0].state==='QUEUED'?'QUEUED_UNWRITTEN_ATTEMPT_RECOVERED':'BLOCKED_UNWRITTEN_ATTEMPT_RECOVERED',packageId,revision,eventId,token,requestId,destination:decision.destination,decisionAcknowledgementRequired:true,...noAuthority};
   })();
  }catch{result=commitAttempted?uncertain():denied()}
  finally{
   if(c){
    if(started&&!committed)try{await c.rollback()}catch{result=uncertain();try{c.destroy?.()}catch{}}
    try{await c.release()}catch{result=uncertain()}
   }
  }
  return result;
 };
}
