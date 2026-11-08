import {createRecoveryMysqlAdapter} from './reopen-mysql-adapter.mjs';
import {createReopenService} from './reopen-service.mjs';
import {claimFenceInTransaction} from './publication-fence-candidate.mjs';
import {createClassifiedTargetRouter,initializeRevisionBindings,initializeDecisionPendingBindings} from './fenced-target-candidate.mjs';
import {createMotorAttemptStore,initializeMotorAttempt} from './motor-attempt-store.mjs';
import {createNeverWrittenEvidence} from './never-written-evidence.mjs';
import {createRevisionCapture} from './revision-capture.mjs';
import {readRecoveredPolicyInTransaction} from './recovered-policy-mysql.mjs';
import {readConfirmedCorrectionInTransaction} from './confirmed-correction-reader.mjs';
import {createCorrectionConfirmationStore} from './correction-confirmation-store.mjs';
import {createConfirmedRecoverySeal} from './confirmed-recovery-seal.mjs';
import {createCorrectionFactsReader} from './correction-facts-mysql.mjs';
import {createCorrectionSelectionStore,readCorrectionSelectionInTransaction} from './correction-selection-store.mjs';
import {beginFencedPublication} from './fenced-publication-candidate.mjs';
import {createBlockedList} from './blocked-list.mjs';
import {createPreviewDeliveryStore} from './preview-delivery-store.mjs';

// Explicitly composed by the server, never by HTTP input. Merely constructing
// this object must not enable production; the caller must install and migrate
// schemas, wire the package store, event consumer and every relevant writer,
// and provide evidence backed by authoritative records and an effective fence.
export function createCandidateRecoverySubsystem({pool,adminUserIds,lockTrustedSafetyBarrier,captureTrustedRevision,beginLegacyTarget,verifyLiteralEnforcement=async()=>false,verifyUpdateEnforcement=async()=>false}) {
  if(!pool?.getConnection||!Array.isArray(adminUserIds)||typeof lockTrustedSafetyBarrier!=='function'||
     typeof captureTrustedRevision!=='function'||typeof beginLegacyTarget!=='function')throw Error('RECOVERY_CONFIGURATION_INCOMPLETE');
  const db=createRecoveryMysqlAdapter(pool,{lockTrustedSafetyBarrier,captureTrustedRevision,
    claimTrustedRecoveryFence:(connection,id,revision)=>claimFenceInTransaction(connection,id,revision)});
  return Object.freeze({
    telegramRecovery:createReopenService({db,adminUserIds}),
    telegramBlockedList:createBlockedList({pool,adminUserIds}),
    targetBegin:createClassifiedTargetRouter(beginLegacyTarget),
    telegramPublicationBegin:beginFencedPublication,
    initializePublicationFence:initializeRevisionBindings,
    motorAttempts:createMotorAttemptStore({pool,verifyLiteralEnforcement,verifyUpdateEnforcement}),
    initializeMotorAttempt,
    readRecoveredPolicy:readRecoveredPolicyInTransaction,
    readConfirmedCorrection:readConfirmedCorrectionInTransaction,
  });
}

// These callbacks must be real, authoritative deployment integrations. Their
// existence or test doubles does not establish that production is safe.
export function createCandidateFirstRecovery({pool,adminUserIds,verifyTerminalRun,verifyWriterCoverage,beginLegacyTarget,verifyLiteralEnforcement=async()=>false,verifyUpdateEnforcement=async()=>false}) {
  const evidence=createNeverWrittenEvidence({verifyTerminalRun,verifyWriterCoverage});
  return createCandidateRecoverySubsystem({pool,adminUserIds,beginLegacyTarget,verifyLiteralEnforcement,verifyUpdateEnforcement,
    lockTrustedSafetyBarrier:evidence.lockSafetyBarrier,
    captureTrustedRevision:createRevisionCapture({lockVerifiedBlockedOutcomes:evidence.lockVerifiedBlockedOutcomes})});
}

// Opt-in composition for isolated integration tests. No production startup
// calls this; the facts provider and consumer attestation must be real before
// an event may be emitted. It reuses the existing event store, not a consumer.
export function createCandidateCorrectionSubsystem({pool,events,loadLockedFacts=null,readLockedSelection=null,readVerifiedUpdatePosts=null,verifyDecisionConsumer,verifyUpdateReadiness=async()=>false}){
 if(loadLockedFacts!==null&&readLockedSelection!==null)throw Error('CORRECTION_FACTS_CONFIGURATION_INCOMPLETE');
 const facts=loadLockedFacts??createCorrectionFactsReader({readLockedSelection:readLockedSelection??readCorrectionSelectionInTransaction,readVerifiedUpdatePosts});
 const commitConfirmed=createConfirmedRecoverySeal({events,initializePublicationFence:initializeDecisionPendingBindings,initializeMotorAttempt,verifyDecisionConsumer,verifyUpdateReadiness});
 const previewDelivery=createPreviewDeliveryStore({pool});
 return {...createCorrectionConfirmationStore({pool,loadLockedFacts:facts,commitConfirmed,verifyPreviewDelivery:previewDelivery.verifyPreviewDelivery}),...createCorrectionSelectionStore({pool}),previewDelivery};
}
