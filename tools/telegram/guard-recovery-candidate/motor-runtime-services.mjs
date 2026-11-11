import {motorAttemptSchema,initializeMotorAttempt,createMotorAttemptStore} from './motor-attempt-store.mjs';
import {writerReceiptSchema,createWriterReceiptStore,readCompletedWriterReceipt} from './writer-receipt-store.mjs';
import {createCmsObserver} from './cms-observation-client.mjs';

// This installs only future attempt registration and writer acknowledgements.
// It does not reopen a package, migrate historical attempts to a safe state,
// grant update/literal permission, or create a second event consumer.
export async function prepareMotorRuntimeServices({pool,secret}){
 const readWordPress=createCmsObserver({secret});
 const attempts=createMotorAttemptStore({pool,verifyCompletedWrites:readCompletedWriterReceipt});
 const receipts=createWriterReceiptStore({pool,readWordPress});
 const c=await pool.getConnection();try{for(const sql of [motorAttemptSchema,writerReceiptSchema])await c.execute(sql)}finally{c.release()}
 return Object.freeze({telegramAttempts:attempts,telegramWriterReceipts:receipts,initializeMotorAttempt,readWordPress});
}
