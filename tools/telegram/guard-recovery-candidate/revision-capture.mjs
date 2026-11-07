import {createOriginalRevisionCapture} from './original-policy-provider.mjs';
import {readRecoveredPolicyInTransaction} from './recovered-policy-mysql.mjs';
import {readConfirmedCorrectionInTransaction} from './confirmed-correction-reader.mjs';
import {resolveDestinations} from './original-destinations.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';

// Runs only inside the guard-owned reopen transaction. Historical revisions
// without closure records use the original verified controls; earlier
// recoveries use their persisted closure and snapshot instead.
export function createRevisionCapture({lockVerifiedBlockedOutcomes,readRecoveredPolicy=readRecoveredPolicyInTransaction,readConfirmedCorrection=readConfirmedCorrectionInTransaction}){
 if(typeof lockVerifiedBlockedOutcomes!=='function'||typeof readRecoveredPolicy!=='function'||typeof readConfirmedCorrection!=='function')throw Error('REVISION_CAPTURE_INCOMPLETE');
 const original=createOriginalRevisionCapture({lockVerifiedBlockedOutcomes});
 return async function capture(c,packageId,revision,ownerKey,items){
  const [closures]=await c.execute('SELECT package_id FROM opmx_tg_recovery_closures_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
  if(closures.length===0)return original(c,packageId,revision,ownerKey,items);
  if(closures.length!==1)return null;
  let policy,correction;try{policy=await readRecoveredPolicy(c,packageId,revision);correction=await readConfirmedCorrection(c,packageId,revision)}catch{return null;}
  if(!policy||policy.authorized!==true||!['PUBLISH','DRAFT'].includes(policy.mode)||!Array.isArray(policy.control_item_ids)||!policy.control_item_ids.length)return null;
  if(correction&&(correction.package_id!==packageId||correction.revision!==revision||correction.action!=='CREATE'||!['LITERAL','EDITORIAL'].includes(correction.content_mode)))return null;
  const destination=correction?.destination??policy.destination;
  let destinations,requestId;try{destinations=resolveDestinations(destination);requestId=expectedDraftRequestId({packageId,revision,destination})}catch{return null;}
  const decision={packageId,revision,ownerKey,requestId,destinations,authorization:{mode:policy.mode,authorized:true,explicit:policy.explicit,authorization:policy.authorization},controls:policy.control_item_ids,...(correction?{contentMode:correction.content_mode,confirmedPreviewHash:correction.preview_hash}:{})};
  const results=await lockVerifiedBlockedOutcomes(c,decision);
  if(!Array.isArray(results)||results.length!==destinations.length||new Set(results.map(x=>x?.destination)).size!==destinations.length||results.some(x=>!destinations.includes(x?.destination)||x.status!=='BLOCKED'||x.publicationVerdict!=='NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'))return null;
  return {...decision,results:results.map(({destination,status,publicationVerdict})=>({destination,status,publicationVerdict}))};
 };
}
