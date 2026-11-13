import {readVerifiedUpdateDecisionInTransaction} from './confirmed-correction-reader.mjs';
import {readVerifiedUpdatePosts} from './verified-update-posts.mjs';
import {canonicalUpdateValue} from './canonical-json.mjs';
import {validUpdatePayload} from './update-executor.mjs';
import {createHash} from 'node:crypto';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {destinationRegistry} from './original-destinations.mjs';
import {verifyWriterReleaseObservation} from './writer-release-contract.mjs';
import writerReleaseManifest from './writer-release-manifest.mjs';

const labels=['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'];
const hash=s=>createHash('sha256').update(s).digest('hex');
const valid=(id,r)=>/^tg_[a-f0-9]{40}$/.test(id??'')&&Number.isSafeInteger(r)&&r>0&&r<=4294967295;

// Revocation, not process termination: reopen already holds quota + package
// locks. Every audited tg writer must acquire that same package lock before
// obtaining a write permit. Freeze first, then observe the complete n8n graph
// and all outstanding executions. A previously granted writer is visible in
// those pages; a later claim cannot pass the held lock. COMMIT atomically
// advances the revision and keeps the old fence closed. Any failure rolls the
// entire reopen transaction back. An old ChatGPT process may remain alive;
// its old revision no longer has a usable write capability.
export function createRevisionReconciliation({observeRuntime,readWordPress,manifest=writerReleaseManifest,readUpdateDecision=readVerifiedUpdateDecisionInTransaction,readUpdateOrigins=readVerifiedUpdatePosts,nonWritingRecoveryExecution=null,allowQueuedAwaiting=false}){
 if(typeof observeRuntime!=='function'||typeof readWordPress!=='function')throw Error('RECONCILIATION_CONFIGURATION_INVALID');
 const observations=new WeakMap();
 async function lockSafetyBarrier(c,packageId,revision){
  observations.delete(c);
  if(!c?.execute||!valid(packageId,revision))return null;
  const [p]=await c.execute('SELECT state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);
  if(p.length!==1||p[0].state!=='READY'||Number(p[0].revision)!==revision)return null;
  const [attempts]=await c.execute('SELECT state,event_id FROM opmx_tg_motor_attempts_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
  const [f]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
  if(f.length!==1||attempts.length>1||!(['READY_TO_WRITE','WRITING','HISTORICAL_UNRECONCILED','HISTORICAL_WRITING','RECONCILING'].includes(f[0].state)||(allowQueuedAwaiting===true&&f[0].state==='AWAITING_DECISION'&&attempts.length===1&&attempts[0].state==='QUEUED')))return null;
  const [events]=await c.execute('SELECT event_id FROM opmx_tg_events_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
  if(events.length!==1||!/^evt_[a-f0-9]{48}$/.test(events[0].event_id??'')||attempts.length&&attempts[0].event_id!==events[0].event_id)return null;
  const eventId=events[0].event_id;
  if(f[0].state!=='RECONCILING'){
   const [changed]=await c.execute("UPDATE opmx_tg_publication_fence_v1 SET state='RECONCILING',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state=?",[packageId,revision,f[0].state]);
   if(changed.affectedRows!==1)throw Error('FENCE_CONFLICT');
  }
  const runtime=await observeRuntime({packageId,revision,eventId});
  if(!verifyWriterReleaseObservation(runtime,manifest,{nonWritingRecoveryExecution}))return null;
  const expected=labels.map(destination=>expectedDraftRequestId({packageId,revision,destination}));
  const [bindings]=await c.execute('SELECT request_id FROM opmx_tg_request_binding_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
  if(bindings.length!==7||new Set(bindings.map(b=>b.request_id)).size!==7||expected.some(id=>!bindings.some(b=>b.request_id===id)))return null;
  const marks=expected.map(()=>'?').join(',');
  const [classes]=await c.execute(`SELECT request_id,kind FROM opmx_tg_request_class_v1 WHERE request_id IN (${marks}) FOR UPDATE`,expected);
  if(classes.length!==7||new Set(classes.map(b=>b.request_id)).size!==7||classes.some(b=>b.kind!=='TELEGRAM')||expected.some(id=>!classes.some(b=>b.request_id===id)))return null;
  const [targets]=await c.execute(`SELECT request_id,destination,target_key,status,post_id FROM opmx_mcp_target_progress WHERE request_id IN (${marks}) FOR UPDATE`,expected);
  const [media]=await c.execute(`SELECT request_id,target_key,role,status,media_id FROM opmx_mcp_media_progress WHERE request_id IN (${marks}) FOR UPDATE`,expected);
  const [claims]=await c.execute('SELECT request_id,slug,destinations FROM opmx_tg_publication_claims_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
  if(targets.length>3||new Set(targets.map(t=>t.destination)).size!==targets.length||new Set(targets.map(t=>t.request_id)).size>1||claims.length>1)return null;
  if(media.some(m=>m.status!=='reported'||!Number.isSafeInteger(Number(m.media_id))||Number(m.media_id)<1||!targets.some(t=>t.request_id===m.request_id&&t.target_key===m.target_key)))return null;
  if(claims.length&&(!targets.length||claims[0].request_id!==targets[0].request_id))return null;
  const results=[];let updateRequestId=null;
  const [decisions]=await c.execute('SELECT decision_json FROM opmx_tg_confirmed_decisions_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
  if(decisions.length>1)return null;
  let saved;try{saved=decisions.length?JSON.parse(decisions[0].decision_json):null}catch{return null}
  if(saved?.action==='UPDATE'){
   if(targets.length||media.length||claims.length)return null;
   let d,origins;try{d=await readUpdateDecision(c,{packageId,revision});if(d)origins=await readUpdateOrigins(c,{packageId,revision:revision-1,baseRevision:d.baseRevision,ownerKey:d.ownerKey,actorKey:d.actorKey,destination:d.destination})}catch{return null}
   if(!d||!origins?.verified||!d.finalPayloads||!Array.isArray(d.posts)||!d.posts.length)return null;
   const [uc]=await c.execute('SELECT destination,post_id,preview_hash,payload_hash,operation_id,state FROM opmx_tg_update_claims_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   const [jobs]=await c.execute('SELECT destination,post_id,preview_hash,payload_hash,operation_id,state,payload_json FROM opmx_tg_update_deliveries_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
   if((uc.length||jobs.length)&&(uc.length!==d.posts.length||jobs.length!==d.posts.length))return null;
   if(new Set(uc.map(x=>x.destination)).size!==uc.length||new Set(jobs.map(x=>x.destination)).size!==jobs.length)return null;
   for(const p of d.posts){
    const payload=d.finalPayloads[p.destination];if(!validUpdatePayload(payload)||origins.posts[p.destination]!==p.postId)return null;
    const encoded=canonicalUpdateValue(payload),payloadHash=hash(encoded),operationId='upd_'+hash(`${packageId}:${revision}:${p.destination}:${p.postId}:${d.previewHash}:${payloadHash}`);
    if(uc.length){const a=uc.find(x=>x.destination===p.destination),b=jobs.find(x=>x.destination===p.destination);if(!a||!b||[a,b].some(x=>x.state!=='CONFIRMED'||Number(x.post_id)!==p.postId||x.preview_hash!==d.previewHash||x.payload_hash!==payloadHash||x.operation_id!==operationId)||b.payload_json!==encoded)return null}
    const site=destinationRegistry()[p.destination]?.cms;let r;try{r=await readWordPress({site,postId:p.postId})}catch{return null}
    const post=r?.post,slug=origins.slugs[p.destination],ledgerRequestId=origins.ledgerRequestIds[p.destination];
    if(!site||!/^tg_[a-f0-9]{64}$/.test(ledgerRequestId??'')||r?.statusCode!==200||post?.id!==p.postId||post.type!=='post'||post.slug!==slug||!['draft','publish'].includes(post.status))return null;
    results.push({destination:p.destination,status:post.status==='publish'?'PUBLISHED':'DRAFT',publicationVerdict:'CMS_RECORD_CONFIRMED',cmsVerified:true,wordpressStatus:post.status,postId:p.postId,slug,ledgerRequestId});
   }
   updateRequestId=expectedDraftRequestId({packageId,revision,destination:d.destination});
  }

  for(const t of targets){
   const id=Number(t.post_id),site=destinationRegistry()[t.destination]?.cms;
   if(!site||t.status!=='reported'||!Number.isSafeInteger(id)||id<1)return null;
   let r;try{r=await readWordPress({site,postId:id})}catch{return null}
   const post=r?.post;
   if(r?.statusCode!==200||post?.id!==id||post.type!=='post'||!['publish','draft'].includes(post.status)||typeof post.slug!=='string'||post.slug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)||t.target_key!==hash(`opmx:v1:${t.destination}:${post.slug}`)||claims.length&&claims[0].slug!==post.slug)return null;
   results.push({destination:t.destination,status:post.status==='publish'?'PUBLISHED':'DRAFT',publicationVerdict:'CMS_RECORD_CONFIRMED',cmsVerified:true,wordpressStatus:post.status,postId:id,slug:post.slug});
  }
  const [changed]=await c.execute("UPDATE opmx_tg_publication_fence_v1 SET state='SAFE_TO_REOPEN',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state='RECONCILING'",[packageId,revision]);
  if(changed.affectedRows!==1)throw Error('FENCE_CONFLICT');
  // The token is invalidated in the same transaction as the new revision.
  if(attempts.length){const [retired]=await c.execute("UPDATE opmx_tg_motor_attempts_v1 SET state='REVOKED',token_hash=NULL,updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND event_id=?",[packageId,revision,eventId]);if(retired.affectedRows!==1)throw Error('ATTEMPT_STATE_CONFLICT')}
  observations.set(c,{packageId,revision,targets,media,claims,results,updateRequestId});
  return {packageId,revision,terminalBlocked:true,noActiveAttempts:true,writesFenced:true,noPublicationSideEffects:results.length===0,allPublicationOutcomesVerified:true,capabilityRevoked:true,processTerminationClaimed:false,writerRelease:'opmx.fenced-writer-release.v1',observedAt:runtime.observedAt};
 }
 async function lockVerifiedOutcomes(c,decision){
  const x=observations.get(c);observations.delete(c);
  if(!x||decision?.packageId!==x.packageId||decision.revision!==x.revision||!Array.isArray(decision.destinations)||!decision.destinations.length||new Set(decision.destinations).size!==decision.destinations.length)return null;
  if(x.updateRequestId&&x.updateRequestId!==decision.requestId)return null;
  if(x.targets.some(t=>t.request_id!==decision.requestId||!decision.destinations.includes(t.destination)))return null;
  if(x.claims.length&&x.claims[0].request_id!==decision.requestId)return null;
  const [f]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[x.packageId,x.revision]);
  if(f.length!==1||f[0].state!=='SAFE_TO_REOPEN')return null;
  return decision.destinations.map(destination=>x.results.find(r=>r.destination===destination)??{destination,status:'BLOCKED',publicationVerdict:'NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'});
 }
 return Object.freeze({lockSafetyBarrier,lockVerifiedOutcomes});
}
