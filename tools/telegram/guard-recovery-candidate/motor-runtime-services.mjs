import {publisherSubmissionSchema,createPublisherSubmissionStore,readSubmissionCompletedWriterReceipt} from './publisher-submission-store.mjs';
import {createUnwrittenAttemptFreeze} from './unwritten-attempt-freeze.mjs';
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
 const attempts=createMotorAttemptStore({pool,adminUserIds,verifyCompletedWrites:readSubmissionCompletedWriterReceipt});
 const receipts=createWriterReceiptStore({pool,readWordPress});
 const submissions=createPublisherSubmissionStore({pool,adminUserIds});
 const observeTarget=createRequestTargetReconciler({pool,readWordPress});
 const checkRevision=createReconciliationCheck({pool,readWordPress,observeRuntime:createRuntimeObserver({secret})});
 const freezeUnwritten=createUnwrittenAttemptFreeze({pool,adminUserIds,readWordPress,observeRuntime:createRuntimeObserver({secret})});
 const observeFinalPublication=createFinalPublicationObserver({pool,readWordPress,observeRuntime:createRuntimeObserver({secret})});
 const c=await pool.getConnection();try{for(const sql of [motorAttemptSchema,writerReceiptSchema,publisherSubmissionSchema])await c.execute(sql)}finally{c.release()}
 return Object.freeze({telegramFinalPublication:observeFinalPublication,telegramReconciliationFreeze:freezeUnwritten,telegramAttempts:attempts,telegramWriterReceipts:receipts,telegramSubmissions:submissions,initializeMotorAttempt,readWordPress,telegramReconciliation:input=>Object.keys(input??{}).sort().join(',')==='packageId,revision'?checkRevision(input):observeTarget(input)});
}
