import {publicationFenceSchema} from './publication-fence-candidate.mjs';
import {requestBindingSchema,requestClassificationSchema,initializeRevisionBindings,createClassifiedTargetRouter} from './fenced-target-candidate.mjs';
import {createClassifiedMediaRouter} from './fenced-media-candidate.mjs';
import {publicationClaimSchema,beginFencedPublication} from './fenced-publication-candidate.mjs';
import {backfillHistoricalFences} from './fence-backfill.mjs';
import {withCutoverBackfill} from './fence-cutover-routing.mjs';

// This composition is explicit: it is not called by production startup.
// Schema install is separate from transactional backfill because MySQL DDL
// implicitly commits. The prior package and event tables must already exist.
export async function prepareCutoverFence({pool,legacyTargetBegin,legacyMediaBegin}){
 if(!pool?.getConnection||typeof legacyTargetBegin!=='function'||typeof legacyMediaBegin!=='function')throw Error('CUTOVER_CONFIGURATION_INCOMPLETE');
 const c=await pool.getConnection();
 try{for(const sql of [publicationFenceSchema,requestClassificationSchema,requestBindingSchema,publicationClaimSchema])await c.execute(sql)}finally{c.release()}
 const backfill=await backfillHistoricalFences(pool);
 return Object.freeze({backfill,initializePublicationFence:initializeRevisionBindings,
  targetBegin:withCutoverBackfill(createClassifiedTargetRouter(legacyTargetBegin)),
  mediaBegin:withCutoverBackfill(createClassifiedMediaRouter(legacyMediaBegin)),
  telegramPublicationBegin:withCutoverBackfill(beginFencedPublication)});
}
