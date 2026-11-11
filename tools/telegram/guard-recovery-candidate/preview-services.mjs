import {recoverySchema} from './reopen-mysql-adapter.mjs';
import {correctionSelectionSchema} from './correction-selection-store.mjs';
import {readRecoverySelectionInTransaction as readCorrectionSelectionInTransaction} from './recovery-selection-default.mjs';
import {correctionConfirmationSchema,createCorrectionConfirmationStore} from './correction-confirmation-store.mjs';
import {previewPayloadSchema,createPreviewPayloadStore} from './preview-payload-store.mjs';
import {previewDeliverySchema,createPreviewDeliveryStore} from './preview-delivery-store.mjs';
import {createPreviewMaterializer} from './preview-materializer.mjs';
import {createCorrectionFactsReader} from './correction-facts-mysql.mjs';
import {readVerifiedUpdatePosts} from './verified-update-posts.mjs';
import {enqueuePreviewGeneration} from './preview-generation-outbox.mjs';

// Preview-only composition. No CMS transport, recovery operation, selection
// mutation, confirmation or publication permit is returned to the HTTP layer.
// Existing snapshots/leases must have been independently reconciled; this
// migration creates empty structures and never manufactures those records.
export async function preparePreviewServices({pool,adminUserIds=[]}){
 if(!pool?.getConnection)throw Error('PREVIEW_SERVICES_INCOMPLETE');
 const payloads=createPreviewPayloadStore({pool,adminUserIds,readSelection:readCorrectionSelectionInTransaction});
 const delivery=createPreviewDeliveryStore({pool});
 const facts=createCorrectionFactsReader({readLockedSelection:readCorrectionSelectionInTransaction,readVerifiedUpdatePosts,readFinalPayloads:payloads.read});
 const corrections=createCorrectionConfirmationStore({pool,loadLockedFacts:facts,verifyPreviewDelivery:delivery.verifyPreviewDelivery,enqueuePreviewGeneration,
  commitConfirmed:async()=>{throw Error('CONFIRMATION_NOT_INSTALLED')}
 });
 const materialize=createPreviewMaterializer({pool,preview:corrections.preview,adminUserIds});
 const c=await pool.getConnection();
 try{for(const sql of [...recoverySchema(),correctionSelectionSchema,correctionConfirmationSchema,previewPayloadSchema,previewDeliverySchema])await c.execute(sql)}finally{c.release()}
 return Object.freeze({telegramPreviewPayloads:Object.freeze({stage:payloads.stageFromMotor,context:payloads.contextFromMotor}),telegramPreviewMaterializer:materialize,telegramPreviewDelivery:delivery});
}
