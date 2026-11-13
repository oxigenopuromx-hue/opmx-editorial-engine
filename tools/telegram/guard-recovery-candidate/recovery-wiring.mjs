import {readPublisherSubmissionResultInTransaction} from './publisher-submission-store.mjs';
import {readPackageDiagnostic} from './package-diagnostic.mjs';
import {readRecoverySelectionInTransaction} from './recovery-selection-default.mjs';
import {createGuard} from './deployed-guard/guard-server.mjs';
import {beginTargetWrite} from './deployed-guard/target-progress.mjs';
import {createTelegramPackageStore} from './package-store.mjs';
import {createCandidateFirstRecovery,createCandidateCorrectionSubsystem,createCandidateRecoverySubsystem} from './recovery-assembly.mjs';
import {createRevisionCapture} from './revision-capture.mjs';
import {createUpdateClaimStore} from './update-claim.mjs';
import {readVerifiedUpdateDecisionInTransaction,readConfirmedCorrectionManifestInTransaction} from './confirmed-correction-reader.mjs';
import {readVerifiedUpdatePosts,loadVerifiedUpdateTarget} from './verified-update-posts.mjs';
import {createUpdateExecutor,createVerifiedUpdateDecisionLoader} from './update-executor.mjs';
import {createUpdatePayloadStore} from './update-payload-store.mjs';
import {verifyConfirmedUpdatePayload} from './confirmed-payload-verifier.mjs';
import {createPreviewPayloadStore} from './preview-payload-store.mjs';
import {createPreviewMaterializer} from './preview-materializer.mjs';
import {createWordPressTransport} from './wordpress-transport.mjs';
import {createHash} from 'node:crypto';

// Explicit integration seam for the existing guard and outbox. It does not
// start a server, migrate tables, subscribe, or provide any proof by itself.
// Production must supply independent, authoritative verifiers only after all
// writers and the Motor have been wired and checked. No HTTP input, source
// document or environment boolean can substitute for those providers.
export function createRecoveryWiring({pool,secret,events,reviews,adminUserIds,verifyTerminalRun,verifyWriterCoverage,verifyDecisionConsumer,verifyLiteralEnforcement=async()=>false,verifyCompletedWrites=async()=>null,reconciliationEvidence=null,legacyTargetBegin=beginTargetWrite,updateProviders=null,updateExecution=null,readFinalPayloads=null,readEditorialPlacement=null,verifyEditorialPlacement=null,enqueuePreviewGeneration=null,recoverBlockedUnwritten=null}){
 if(!pool?.getConnection||typeof secret!=='string'||!/^[a-f0-9]{64,}$/.test(secret)||!events||typeof events.enqueue!=='function'||typeof events.initialize!=='function'||typeof events.run!=='function'||!reviews||typeof reviews.run!=='function'||!Array.isArray(adminUserIds)||typeof verifyTerminalRun!=='function'||typeof verifyWriterCoverage!=='function'||typeof verifyDecisionConsumer!=='function'||typeof legacyTargetBegin!=='function')throw Error('RECOVERY_WIRING_INCOMPLETE');
 if(updateProviders!==null&&(!updateProviders||typeof updateProviders!=='object'||Array.isArray(updateProviders)||!['verifyCmsPreflight,verifyPayload,verifyUpdateEnforcement,verifyUpdateReadiness','verifyUpdateEnforcement,verifyUpdateReadiness'].includes(Object.keys(updateProviders).sort().join(','))||!Object.values(updateProviders).every(x=>typeof x==='function')))throw Error('UPDATE_CLAIM_CONFIGURATION_INCOMPLETE');
 if((readEditorialPlacement!==null&&typeof readEditorialPlacement!=='function')||(verifyEditorialPlacement!==null&&typeof verifyEditorialPlacement!=='function'))throw Error('PLACEMENT_CONFIGURATION_INVALID');
 let wordpress=null;
 if(updateExecution!==null){
  if(!updateProviders||!updateExecution||typeof updateExecution!=='object'||Array.isArray(updateExecution))throw Error('UPDATE_EXECUTOR_INCOMPLETE');
  const keys=Object.keys(updateExecution).sort().join(',');
  if(keys==='wordpress'&&typeof updateExecution.wordpress?.read==='function'&&typeof updateExecution.wordpress?.update==='function')wordpress=updateExecution.wordpress;
  else if(keys==='credentials')wordpress=createWordPressTransport({credentials:updateExecution.credentials});
  else throw Error('UPDATE_EXECUTOR_INCOMPLETE');
 }
 if(updateProviders&&!updateProviders.verifyCmsPreflight&&!wordpress)throw Error('UPDATE_CLAIM_CONFIGURATION_INCOMPLETE');
 // Preflight is server-owned: resolve the target from the confirmed decision
 // and the locked historical ledger, then read that ID from its own CMS.
 // An unavailable CMS, changed slug or non-editable post fails closed.
 const verifyCmsPreflight=updateProviders?.verifyCmsPreflight??(wordpress?async(c,input)=>{
  const scope={packageId:input.packageId,revision:input.revision,destination:input.destination,previewHash:input.previewHash,postId:input.postId,payloadHash:input.payloadHash};
  const target=await loadVerifiedUpdateTarget(c,scope);if(!target)return null;
  let result;try{result=await wordpress.read({destination:input.destination,postId:input.postId})}catch{return null}
  const post=result?.post;
  if(result?.statusCode!==200||post?.id!==input.postId||post?.type!=='post'||post?.slug!==target.slug||!['publish','draft'].includes(post?.status))return null;
  return {...input,authenticatedCmsPreflight:true};
 }:null);
 const recoveryOptions={pool,adminUserIds,verifyTerminalRun,verifyWriterCoverage,verifyLiteralEnforcement,verifyCompletedWrites,recoverBlockedUnwritten,...(updateProviders?{verifyUpdateEnforcement:updateProviders.verifyUpdateEnforcement}:{}),beginLegacyTarget:legacyTargetBegin};
 if(reconciliationEvidence!==null&&(typeof reconciliationEvidence.lockSafetyBarrier!=='function'||typeof reconciliationEvidence.lockVerifiedOutcomes!=='function'))throw Error('RECOVERY_WIRING_INCOMPLETE');
 const recovery=reconciliationEvidence?createCandidateRecoverySubsystem({...recoveryOptions,lockTrustedSafetyBarrier:reconciliationEvidence.lockSafetyBarrier,captureTrustedRevision:createRevisionCapture({lockVerifiedBlockedOutcomes:reconciliationEvidence.lockVerifiedOutcomes})}):createCandidateFirstRecovery(recoveryOptions);
 const previewPayloads=updateProviders?createPreviewPayloadStore({pool,adminUserIds,readSelection:readRecoverySelectionInTransaction}):null;
 const corrections=createCandidateCorrectionSubsystem({pool,events,readLockedSelection:readRecoverySelectionInTransaction,verifyDecisionConsumer,enqueuePreviewGeneration,readFinalPayloads:readFinalPayloads??previewPayloads?.read??null,...(updateProviders?{verifyUpdateReadiness:updateProviders.verifyUpdateReadiness,readVerifiedUpdatePosts}:{})});
 const telegramPreviewMaterializer=previewPayloads?createPreviewMaterializer({pool,preview:corrections.preview,adminUserIds}):null;
 const telegramStore=createTelegramPackageStore(pool,{events,recoveryEnabled:true,adminUserIds,initializePublicationFence:recovery.initializePublicationFence,initializeMotorAttempt:recovery.initializeMotorAttempt,readRecoveredPolicy:recovery.readRecoveredPolicy,readConfirmedCorrection:readConfirmedCorrectionManifestInTransaction,readDiagnostic:readPackageDiagnostic,readPublisherResult:readPublisherSubmissionResultInTransaction,readEditorialPlacement,closeRecoveryPreview:corrections.previewInTransaction,readCloseRecoveryResult:corrections.readClosePreviewInTransaction});
 // Ordinary sealing initializes the outbox before opening its transaction.
 // Confirmed recovery seals directly within the confirmation transaction, so
 // initialize it here as well; DDL must never run inside the seal transaction.
 const confirm=async input=>{await events.initialize();return corrections.confirm(input)};
 const payloadStore=updateProviders===null?null:createUpdatePayloadStore({pool,loadVerifiedTarget:loadVerifiedUpdateTarget,verifyPayload:async(c,input)=>{
  const confirmed=await verifyConfirmedUpdatePayload(c,input);if(!confirmed)return null;
  const enforcement=updateProviders.verifyPayload?await updateProviders.verifyPayload(c,input):confirmed;
  return enforcement&&Object.keys(confirmed).every(k=>enforcement[k]===confirmed[k])?confirmed:null;
 },verifyCmsPreflight});
 const telegramUpdateClaims=payloadStore===null?null:createUpdateClaimStore({pool,loadVerifiedDecision:readVerifiedUpdateDecisionInTransaction,loadVerifiedPayloadEvidence:payloadStore.verifyClaim});
 const loadUpdateDecision=createVerifiedUpdateDecisionLoader(pool);
 const executor=wordpress===null?null:createUpdateExecutor({loadDecision:loadUpdateDecision,loadPayload:payloadStore.load,claimStore:telegramUpdateClaims,wordpress,...(verifyEditorialPlacement===null?{}:{verifyEditorialPlacement})});
 const telegramUpdateExecutor=executor===null?null:{async execute(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='chat,destination,owner,packageId,previewHash,revision'||typeof input.owner!=='string'||input.owner!==input.chat||!/^[1-9][0-9]{0,15}$/.test(input.owner))return {status:'UPDATE_NOT_READY',retryPermitted:false};
  const scope={packageId:input.packageId,revision:input.revision,destination:input.destination,previewHash:input.previewHash};
  const actorKey=createHash('sha256').update(`opmx:telegram:v1:${input.owner}:${input.chat}`).digest('hex');
  let decision;try{decision=await loadUpdateDecision({packageId:scope.packageId,revision:scope.revision})}catch{return {status:'UPDATE_NOT_READY',retryPermitted:false}}
  if(!decision||(decision.actorKey!==actorKey&&decision.ownerKey!==actorKey)||decision.previewHash!==scope.previewHash)return {status:'UPDATE_NOT_READY',retryPermitted:false};
  return executor.execute(scope);
 }};
 const telegramAttempts={...recovery.motorAttempts,async acknowledgeDecision(input){
  // Stage every exact confirmed payload before the acknowledgement opens the
  // fence. The caller supplies no payload; all bytes come from the persisted
  // preview that the editor received and confirmed.
  if(input?.action==='UPDATE'&&payloadStore){
   let d;try{d=await loadUpdateDecision({packageId:input.packageId,revision:input.revision})}catch{return {status:'DECISION_UNCONFIRMED',retryPermitted:false}}
   if(!d||d.previewHash!==input.previewHash||!d.finalPayloads)return {status:'PAYLOAD_UNCONFIRMED',retryPermitted:false};
   for(const p of d.posts){const r=await payloadStore.stage({packageId:d.packageId,revision:d.revision,destination:p.destination,previewHash:d.previewHash,payload:d.finalPayloads[p.destination]});if(!['PAYLOAD_STAGED','PAYLOAD_REPLAY'].includes(r.status))return {status:'DECISION_UNCONFIRMED',retryPermitted:false}}
  }
  return recovery.motorAttempts.acknowledgeDecision(input);
 }};
 return Object.freeze({pool,secret,telegramStore,telegramEvents:events,telegramReviews:reviews,telegramRecovery:recovery.telegramRecovery,telegramBlockedList:recovery.telegramBlockedList,telegramAttempts,telegramCorrections:{preview:corrections.preview,confirm},telegramSelections:{select:corrections.select},telegramPreviewDelivery:corrections.previewDelivery,telegramPreviewMaterializer,telegramPreviewPayloads:previewPayloads?{stage:previewPayloads.stageFromMotor,context:previewPayloads.contextFromMotor}:null,telegramPublicationBegin:recovery.telegramPublicationBegin,telegramUpdatePayloads:payloadStore?{stage:payloadStore.stage}:null,telegramUpdateClaims,telegramUpdateExecutor,targetBegin:recovery.targetBegin,mediaBegin:recovery.mediaBegin});
}
export function createRecoveryGuard(options){return createGuard(createRecoveryWiring(options));}
