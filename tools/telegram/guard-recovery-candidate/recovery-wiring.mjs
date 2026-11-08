import {createGuard} from './deployed-guard/guard-server.mjs';
import {beginTargetWrite} from './deployed-guard/target-progress.mjs';
import {createTelegramPackageStore} from './package-store.mjs';
import {createCandidateFirstRecovery,createCandidateCorrectionSubsystem} from './recovery-assembly.mjs';
import {createUpdateClaimStore} from './update-claim.mjs';

// Explicit integration seam for the existing guard and outbox. It does not
// start a server, migrate tables, subscribe, or provide any proof by itself.
// Production must supply independent, authoritative verifiers only after all
// writers and the Motor have been wired and checked. No HTTP input, source
// document or environment boolean can substitute for those providers.
export function createRecoveryWiring({pool,secret,events,reviews,adminUserIds,verifyTerminalRun,verifyWriterCoverage,verifyDecisionConsumer,legacyTargetBegin=beginTargetWrite,updateProviders=null}){
 if(!pool?.getConnection||typeof secret!=='string'||!/^[a-f0-9]{64,}$/.test(secret)||!events||typeof events.enqueue!=='function'||typeof events.initialize!=='function'||typeof events.run!=='function'||!reviews||typeof reviews.run!=='function'||!Array.isArray(adminUserIds)||typeof verifyTerminalRun!=='function'||typeof verifyWriterCoverage!=='function'||typeof verifyDecisionConsumer!=='function'||typeof legacyTargetBegin!=='function')throw Error('RECOVERY_WIRING_INCOMPLETE');
 const recovery=createCandidateFirstRecovery({pool,adminUserIds,verifyTerminalRun,verifyWriterCoverage,beginLegacyTarget:legacyTargetBegin});
 const corrections=createCandidateCorrectionSubsystem({pool,events,verifyDecisionConsumer});
 const telegramStore=createTelegramPackageStore(pool,{events,recoveryEnabled:true,adminUserIds,initializePublicationFence:recovery.initializePublicationFence,initializeMotorAttempt:recovery.initializeMotorAttempt,readRecoveredPolicy:recovery.readRecoveredPolicy,readConfirmedCorrection:recovery.readConfirmedCorrection});
 // Ordinary sealing initializes the outbox before opening its transaction.
 // Confirmed recovery seals directly within the confirmation transaction, so
 // initialize it here as well; DDL must never run inside the seal transaction.
 const confirm=async input=>{await events.initialize();return corrections.confirm(input)};
 if(updateProviders!==null&&(!updateProviders||typeof updateProviders!=='object'||Array.isArray(updateProviders)||Object.keys(updateProviders).sort().join(',')!=='loadVerifiedDecision,loadVerifiedPayloadEvidence'))throw Error('UPDATE_CLAIM_CONFIGURATION_INCOMPLETE');
 const telegramUpdateClaims=updateProviders===null?null:createUpdateClaimStore({pool,loadVerifiedDecision:updateProviders.loadVerifiedDecision,loadVerifiedPayloadEvidence:updateProviders.loadVerifiedPayloadEvidence});
 return Object.freeze({pool,secret,telegramStore,telegramEvents:events,telegramReviews:reviews,telegramRecovery:recovery.telegramRecovery,telegramBlockedList:recovery.telegramBlockedList,telegramAttempts:recovery.motorAttempts,telegramCorrections:{preview:corrections.preview,confirm},telegramSelections:{select:corrections.select},telegramPreviewDelivery:corrections.previewDelivery,telegramPublicationBegin:recovery.telegramPublicationBegin,telegramUpdateClaims,targetBegin:recovery.targetBegin});
}
export function createRecoveryGuard(options){return createGuard(createRecoveryWiring(options));}
