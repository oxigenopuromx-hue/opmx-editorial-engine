import {publisherSubmissionSchema,createPublisherSubmissionStore,readSubmissionCompletedWriterReceipt} from './publisher-submission-store.mjs';
import {createUnwrittenAttemptFreeze,createUnwrittenRecoveryReadiness} from './unwritten-attempt-freeze.mjs';
import {createBlockedUnwrittenAttemptRecovery} from './blocked-unwritten-attempt-recovery.mjs';
import {destinationCancellationSchema,createPendingDestinationCancellation,incident29CancellationScope} from './destination-cancellation.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {createDestinationCancellationEnforcement} from './destination-cancellation-enforcement.mjs';
import {createFinalPublicationObserver} from './final-publication-observer.mjs';
import {motorAttemptSchema,initializeMotorAttempt,createMotorAttemptStore} from './motor-attempt-store.mjs';
import {writerReceiptSchema,createWriterReceiptStore,readCompletedWriterReceipt} from './writer-receipt-store.mjs';
import {createCmsObserver} from './cms-observation-client.mjs';
import {createRequestTargetReconciler} from './target-reconciliation.mjs';
import {createReconciliationCheck} from './reconciliation-check.mjs';
import {createRuntimeObserver} from './runtime-observation-client.mjs';

// Registers attempts/receipts and administrative reconciliation. Freezing an
// unwritten attempt requires the real locked release/ledger/CMS gate and leaves
// its revision fenced. No package reopening, write permit or event consumer.
export async function prepareMotorRuntimeServices({pool,secret,adminUserIds=[]}){
 const readWordPress=createCmsObserver({secret});
 const readCancellationWordPress=createCmsObserver({secret,allowTrashedSlug:true});
 const recoverBlockedUnwritten=createBlockedUnwrittenAttemptRecovery({pool,adminUserIds,readWordPress,observeRuntime:createRuntimeObserver({secret})});
 const attempts=createMotorAttemptStore({pool,adminUserIds,verifyCompletedWrites:readSubmissionCompletedWriterReceipt,recoverBlockedUnwritten});
 const receipts=createWriterReceiptStore({pool,readWordPress});
 const submissions=createPublisherSubmissionStore({pool,adminUserIds});
 const observeTarget=createRequestTargetReconciler({pool,readWordPress});
 const checkRevision=createReconciliationCheck({pool,readWordPress,observeRuntime:createRuntimeObserver({secret})});
 const freezeUnwritten=createUnwrittenAttemptFreeze({pool,adminUserIds,readWordPress,observeRuntime:createRuntimeObserver({secret})});
 const recoveryReadiness=createUnwrittenRecoveryReadiness({pool,adminUserIds,readWordPress,observeRuntime:createRuntimeObserver({secret})});
 const destinationCancellation=createPendingDestinationCancellation({pool,adminUserIds,readWordPress:readCancellationWordPress,observeRuntime:createRuntimeObserver({secret})});
 const cancellationAllowed=createDestinationCancellationEnforcement({pool});
 // Fixed server-side projection for the existing administrator monitor. A
 // caller supplies no actor, target, operation, receipt, or publication claim.
 const observeCancellation=input=>{
  if(Object.keys(input??{}).sort().join(',')!=='packageId,revision')return destinationCancellation.observe(input);
  const scope=incident29CancellationScope,owner=adminUserIds[0];
  if(input.packageId!==scope.packageId||input.revision!==scope.revision||typeof owner!=='string')return {status:'DELIVERY_CANCELLATION_UNCONFIRMED',writeAuthorized:false,retryPermitted:false};
  return destinationCancellation.observe({owner,chat:owner,packageId:scope.packageId,revision:scope.revision,requestId:expectedDraftRequestId({packageId:scope.packageId,revision:scope.revision,destination:'TODOS'}),destination:scope.destination,postId:scope.postId,operationId:'requested-20261113-issue29-simey-liberal'});
 };
 const observeFinalPublication=createFinalPublicationObserver({pool,readWordPress,observeRuntime:createRuntimeObserver({secret})});
 const c=await pool.getConnection();try{for(const sql of [motorAttemptSchema,writerReceiptSchema,publisherSubmissionSchema,destinationCancellationSchema])await c.execute(sql)}finally{c.release()}
 return Object.freeze({telegramFinalPublication:observeFinalPublication,telegramReconciliationFreeze:freezeUnwritten,telegramRecoveryReadiness:recoveryReadiness,telegramDestinationCancellation:{...destinationCancellation,observe:observeCancellation,allowed:cancellationAllowed},telegramAttempts:attempts,telegramWriterReceipts:receipts,telegramSubmissions:submissions,initializeMotorAttempt,readWordPress,telegramReconciliation:input=>Object.keys(input??{}).sort().join(',')==='packageId,revision'?checkRevision(input):observeTarget(input)});
}
