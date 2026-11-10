import {createGuard} from './deployed-guard/guard-server.mjs';
import {beginTargetWrite} from './deployed-guard/target-progress.mjs';
import {createTelegramPackageStore} from './package-store.mjs';
import {createCandidateFirstRecovery,createCandidateCorrectionSubsystem} from './recovery-assembly.mjs';
import {createUpdateClaimStore} from './update-claim.mjs';
import {readVerifiedUpdateDecisionInTransaction} from './confirmed-correction-reader.mjs';
import {readVerifiedUpdatePosts,loadVerifiedUpdateTarget} from './verified-update-posts.mjs';
import {createUpdateExecutor,createVerifiedUpdateDecisionLoader} from './update-executor.mjs';
import {createUpdatePayloadStore} from './update-payload-store.mjs';
import {verifyConfirmedUpdatePayload} from './confirmed-payload-verifier.mjs';
import {createPreviewPayloadStore} from './preview-payload-store.mjs';
import {createWordPressTransport} from './wordpress-transport.mjs';

// Explicit integration seam for the existing guard and outbox. It does not
// start a server, migrate tables, subscribe, or provide any proof by itself.
// Production must supply independent, authoritative verifiers only after all
// writers and the Motor have been wired and checked. No HTTP input, source
// document or environment boolean can substitute for those providers.
export function createRecoveryWiring({pool,secret,events,reviews,adminUserIds,verifyTerminalRun,verifyWriterCoverage,verifyDecisionConsumer,verifyLiteralEnforcement=async()=>false,legacyTargetBegin=beginTargetWrite,updateProviders=null,updateExecution=null,readFinalPayloads=null}){
 if(!pool?.getConnection||typeof secret!=='string'||!/^[a-f0-9]{64,}$/.test(secret)||!events||typeof events.enqueue!=='function'||typeof events.initialize!=='function'||typeof events.run!=='function'||!reviews||typeof reviews.run!=='function'||!Array.isArray(adminUserIds)||typeof verifyTerminalRun!=='function'||typeof verifyWriterCoverage!=='function'||typeof verifyDecisionConsumer!=='function'||typeof legacyTargetBegin!=='function')throw Error('RECOVERY_WIRING_INCOMPLETE');
 if(updateProviders!==null&&(!updateProviders||typeof updateProviders!=='object'||Array.isArray(updateProviders)||Object.keys(updateProviders).sort().join(',')!=='verifyCmsPreflight,verifyPayload,verifyUpdateEnforcement,verifyUpdateReadiness'||!Object.values(updateProviders).every(x=>typeof x==='function')))throw Error('UPDATE_CLAIM_CONFIGURATION_INCOMPLETE');
 const recovery=createCandidateFirstRecovery({pool,adminUserIds,verifyTerminalRun,verifyWriterCoverage,verifyLiteralEnforcement,...(updateProviders?{verifyUpdateEnforcement:updateProviders.verifyUpdateEnforcement}:{}),beginLegacyTarget:legacyTargetBegin});
 const previewPayloads=updateProviders?createPreviewPayloadStore({pool}):null;
 const corrections=createCandidateCorrectionSubsystem({pool,events,verifyDecisionConsumer,readFinalPayloads:readFinalPayloads??previewPayloads?.read??null,...(updateProviders?{verifyUpdateReadiness:updateProviders.verifyUpdateReadiness,readVerifiedUpdatePosts}:{})});
 const telegramStore=createTelegramPackageStore(pool,{events,recoveryEnabled:true,adminUserIds,initializePublicationFence:recovery.initializePublicationFence,initializeMotorAttempt:recovery.initializeMotorAttempt,readRecoveredPolicy:recovery.readRecoveredPolicy,readConfirmedCorrection:recovery.readConfirmedCorrection});
 // Ordinary sealing initializes the outbox before opening its transaction.
 // Confirmed recovery seals directly within the confirmation transaction, so
 // initialize it here as well; DDL must never run inside the seal transaction.
 const confirm=async input=>{await events.initialize();return corrections.confirm(input)};
 const payloadStore=updateProviders===null?null:createUpdatePayloadStore({pool,loadVerifiedTarget:loadVerifiedUpdateTarget,verifyPayload:async(c,input)=>{
  const confirmed=await verifyConfirmedUpdatePayload(c,input);if(!confirmed)return null;
  const enforcement=await updateProviders.verifyPayload(c,input);
  return enforcement&&Object.keys(confirmed).every(k=>enforcement[k]===confirmed[k])?confirmed:null;
 },verifyCmsPreflight:updateProviders.verifyCmsPreflight});
 const telegramUpdateClaims=payloadStore===null?null:createUpdateClaimStore({pool,loadVerifiedDecision:readVerifiedUpdateDecisionInTransaction,loadVerifiedPayloadEvidence:payloadStore.verifyClaim});
 let wordpress=null;
 if(updateExecution!==null){
  if(!telegramUpdateClaims||!updateExecution||typeof updateExecution!=='object'||Array.isArray(updateExecution))throw Error('UPDATE_EXECUTOR_INCOMPLETE');
  const keys=Object.keys(updateExecution).sort().join(',');
  if(keys==='wordpress'&&typeof updateExecution.wordpress?.read==='function'&&typeof updateExecution.wordpress?.update==='function')wordpress=updateExecution.wordpress;
  else if(keys==='credentials')wordpress=createWordPressTransport({credentials:updateExecution.credentials});
  else throw Error('UPDATE_EXECUTOR_INCOMPLETE');
 }
 const telegramUpdateExecutor=wordpress===null?null:createUpdateExecutor({loadDecision:createVerifiedUpdateDecisionLoader(pool),loadPayload:payloadStore.load,claimStore:telegramUpdateClaims,wordpress});
 return Object.freeze({pool,secret,telegramStore,telegramEvents:events,telegramReviews:reviews,telegramRecovery:recovery.telegramRecovery,telegramBlockedList:recovery.telegramBlockedList,telegramAttempts:recovery.motorAttempts,telegramCorrections:{preview:corrections.preview,confirm},telegramSelections:{select:corrections.select},telegramPreviewDelivery:corrections.previewDelivery,telegramPreviewPayloads:previewPayloads?{stage:previewPayloads.stage}:null,telegramPublicationBegin:recovery.telegramPublicationBegin,telegramUpdatePayloads:payloadStore?{stage:payloadStore.stage}:null,telegramUpdateClaims,telegramUpdateExecutor,targetBegin:recovery.targetBegin,mediaBegin:recovery.mediaBegin});
}
export function createRecoveryGuard(options){return createGuard(createRecoveryWiring(options));}
