import {createHash} from 'node:crypto';
import {createRecoveryWiring} from './recovery-wiring.mjs';
import {createRevisionReconciliation} from './revision-reconciliation.mjs';
import {createRuntimeObserver} from './runtime-observation-client.mjs';
import {createCmsObserver} from './cms-observation-client.mjs';
import {destinationRegistry} from './original-destinations.mjs';
import {verifyWriterReleaseObservation} from './writer-release-contract.mjs';
import manifest from './writer-release-manifest.mjs';
import {confirmedDecisionSchema} from './confirmed-recovery-seal.mjs';
import {updateClaimSchema} from './update-claim.mjs';
import {updatePayloadSchema} from './update-payload-store.mjs';
import {updateDeliverySchema,createUpdateDeliveryStore} from './update-delivery-store.mjs';
import {readVerifiedUpdateDecisionInTransaction} from './confirmed-correction-reader.mjs';
import {canonicalUpdateValue,validUpdatePayload} from './update-executor.mjs';
import {readSubmissionCompletedWriterReceipt} from './publisher-submission-store.mjs';
import {enqueuePreviewGeneration} from './preview-generation-outbox.mjs';
import {createRecoveredCreationGate} from './recovered-creation-gate.mjs';
import {literalPayloadSchema,createLiteralPayloadStore,readLiteralProofInTransaction} from './literal-payload-store.mjs';
import {readConfirmedCorrectionInTransaction} from './confirmed-correction-reader.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
// No environment switch grants a recovery or a CMS write. The two legacy
// verifier slots deliberately throw: this assembly uses lock-based revocation
// and authoritative release/CMS reconciliation instead of process termination.
export async function prepareRecoveryRuntimeServices({pool,secret,events,reviews,adminUserIds,readWordPress}){
 const observeRuntime=createRuntimeObserver({secret});
 const readEditorial=createCmsObserver({secret,editorial:true});
 const read=async({destination,postId})=>{const site=destinationRegistry()[destination]?.cms;return site?readEditorial({site,postId}):{statusCode:0,post:null}};
 const transport=createUpdateDeliveryStore({pool,secret,readWordPress:read});
 const c=await pool.getConnection();try{for(const sql of [confirmedDecisionSchema,updateClaimSchema,updatePayloadSchema,updateDeliverySchema,literalPayloadSchema])await c.execute(sql)}finally{c.release()}
 async function verifyRelease(c,{packageId,baseRevision}){
  if(manifest.workflows.qBmLf0DmcMSfuWvm?.versionId!=='d04fb5c2-ba36-48f9-9cd4-2958ab1f273e')return false;
  const [rows]=await c.execute('SELECT event_id FROM opmx_tg_events_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,baseRevision]);
  // Readiness is graph attestation, not recovery: the acknowledging MCP
  // execution itself is running. Only revision reconciliation requires idle.
  return rows.length===1&&verifyWriterReleaseObservation(await observeRuntime({packageId,revision:baseRevision,eventId:rows[0].event_id}),manifest,{requireIdle:false});
 }
 async function verifyUpdateReadiness(c,{preview}){
  if(preview?.action!=='UPDATE'||!preview.finalPayloads||!Array.isArray(preview.posts)||!preview.posts.length)return false;
  if(!await verifyRelease(c,{packageId:preview.packageId,baseRevision:preview.baseRevision}))return false;
  for(const p of preview.posts){
   const payload=preview.finalPayloads[p.destination];if(!validUpdatePayload(payload))return false;
   let r;try{r=await read({destination:p.destination,postId:p.postId})}catch{return false}
   if(r.statusCode!==200||r.post?.id!==p.postId||r.post.type!=='post'||!['publish','draft'].includes(r.post.status)||Object.hasOwn(payload,'status')&&payload.status!==r.post.status)return false;
  }
  return true;
 }
 async function verifyLiteralRelease(c,{packageId,revision,eventId}){
  const [rows]=await c.execute('SELECT event_id FROM opmx_tg_events_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
  return rows.length===1&&rows[0].event_id===eventId&&verifyWriterReleaseObservation(await observeRuntime({packageId,revision,eventId}),manifest,{requireIdle:false});
 }
 const literalPayloads=createLiteralPayloadStore({pool,verifyRelease:verifyLiteralRelease});
 async function verifyUpdateEnforcement(c,scope){
  let d;try{d=await readVerifiedUpdateDecisionInTransaction(c,{packageId:scope.packageId,revision:scope.revision})}catch{return false}
  if(!d||d.previewHash!==scope.previewHash||d.destination!==scope.destination||!d.finalPayloads||!await verifyRelease(c,d))return false;
  const [rows]=await c.execute('SELECT destination,post_id,preview_hash,payload_hash,payload_json FROM opmx_tg_update_payloads_v1 WHERE package_id=? AND revision=? FOR UPDATE',[d.packageId,d.revision]);
  if(rows.length!==d.posts.length||new Set(rows.map(r=>r.destination)).size!==d.posts.length)return false;
  return d.posts.every(p=>rows.some(r=>r.destination===p.destination&&Number(r.post_id)===p.postId&&r.preview_hash===d.previewHash&&r.payload_json===canonicalUpdateValue(d.finalPayloads[p.destination])&&r.payload_hash===sha(r.payload_json)));
 }
 const notTermination=async()=>{throw Error('REVOCATION_PROVIDER_REQUIRED')};
 const wiring=createRecoveryWiring({pool,secret,events,reviews,adminUserIds,
  verifyTerminalRun:notTermination,verifyWriterCoverage:notTermination,
  reconciliationEvidence:createRevisionReconciliation({observeRuntime,readWordPress}),
  verifyDecisionConsumer:async(c,{preview})=>{
   // The pinned CREATE writers enforce a source-bound literal payload before
   // any media/post claim. Preview delivery alone is never a write permit;
   // acknowledgement below additionally requires that durable payload proof.
   return verifyRelease(c,{packageId:preview.packageId,baseRevision:preview.baseRevision});
  },
  verifyLiteralEnforcement:async(c,scope)=>{
   let update;try{update=await readVerifiedUpdateDecisionInTransaction(c,scope)}catch{}
   if(update?.action==='UPDATE')return update.contentMode==='LITERAL'&&verifyUpdateEnforcement(c,{...scope,destination:update.destination});
   let d;try{d=await readConfirmedCorrectionInTransaction(c,scope.packageId,scope.revision)}catch{return false}
   if(!d||d.action!=='CREATE'||d.content_mode!=='LITERAL'||d.preview_hash!==scope.previewHash||d.destination!==scope.destination)return false;
   const proof=await readLiteralProofInTransaction(c,{packageId:scope.packageId,revision:scope.revision,destination:d.destination,previewHash:d.preview_hash});
   return !!proof&&verifyLiteralRelease(c,scope);
  },
  verifyCompletedWrites:readSubmissionCompletedWriterReceipt,
  updateProviders:{verifyUpdateReadiness,verifyUpdateEnforcement},updateExecution:{wordpress:transport.wordpress},enqueuePreviewGeneration
 });
 return Object.freeze({...wiring,creationWriteAllowed:createRecoveredCreationGate({pool,readWordPress:read}),telegramLiteralValidation:literalPayloads.validate,telegramUpdateDeliveries:{consume:transport.consume}});
}
