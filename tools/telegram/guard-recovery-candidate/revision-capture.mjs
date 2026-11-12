import {createOriginalRevisionCapture} from './original-policy-provider.mjs';
import {readRecoveredPolicyInTransaction} from './recovered-policy-mysql.mjs';
import {readConfirmedCorrectionManifestInTransaction} from './confirmed-correction-reader.mjs';
import {resolveDestinations} from './original-destinations.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {copyVerifiedOutcomes} from './verified-outcomes.mjs';

// Runs only inside the guard-owned reopen transaction. Historical revisions
// without closure records use the original verified controls; earlier
// recoveries use their persisted closure and snapshot instead.
export function createRevisionCapture({lockVerifiedBlockedOutcomes,readRecoveredPolicy=readRecoveredPolicyInTransaction,readConfirmedCorrection=readConfirmedCorrectionManifestInTransaction}){
 if(typeof lockVerifiedBlockedOutcomes!=='function'||typeof readRecoveredPolicy!=='function'||typeof readConfirmedCorrection!=='function')throw Error('REVISION_CAPTURE_INCOMPLETE');
 const original=createOriginalRevisionCapture({lockVerifiedBlockedOutcomes});
 return async function capture(c,packageId,revision,ownerKey,items){
  const [closures]=await c.execute('SELECT package_id FROM opmx_tg_recovery_closures_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
  if(closures.length===0)return original(c,packageId,revision,ownerKey,items);
  if(closures.length!==1)return null;
  let policy,correction;try{policy=await readRecoveredPolicy(c,packageId,revision);correction=await readConfirmedCorrection(c,packageId,revision)}catch{return null;}
  if(!policy||policy.authorized!==true||!['PUBLISH','DRAFT'].includes(policy.mode)||!Array.isArray(policy.control_item_ids)||!policy.control_item_ids.length||new Set(policy.control_item_ids).size!==policy.control_item_ids.length)return null;
  if(correction&&(correction.package_id!==packageId||correction.revision!==revision||!['CREATE','UPDATE'].includes(correction.action)||!['LITERAL','EDITORIAL'].includes(correction.content_mode)||!/^[a-f0-9]{64}$/.test(correction.preview_hash??'')))return null;
  const contentMode=correction?.content_mode??policy.content_mode??'EDITORIAL';
  const contentControlItemIds=policy.content_control_item_ids??[];
  const provenance=correction?.preview_hash??policy.content_mode_provenance_hash;
  if(!['LITERAL','EDITORIAL'].includes(contentMode)||!Array.isArray(contentControlItemIds)||new Set(contentControlItemIds).size!==contentControlItemIds.length||contentControlItemIds.some(id=>!policy.control_item_ids.includes(id))||provenance!==undefined&&!/^[a-f0-9]{64}$/.test(provenance))return null;
  if(contentControlItemIds.length&&!Object.hasOwn(policy,'content_mode')||contentMode==='LITERAL'&&!contentControlItemIds.length&&!provenance)return null;
  const destination=correction?.destination??policy.destination;
  let destinations,requestId;try{destinations=resolveDestinations(destination);requestId=expectedDraftRequestId({packageId,revision,destination})}catch{return null;}
  const decision={packageId,revision,ownerKey,requestId,destinations,authorization:{mode:policy.mode,authorized:true,explicit:policy.explicit,authorization:policy.authorization},controls:policy.control_item_ids,contentMode,contentControlItemIds:[...contentControlItemIds],...(provenance?{confirmedPreviewHash:provenance}:{})};
  const results=copyVerifiedOutcomes(destinations,await lockVerifiedBlockedOutcomes(c,decision));
  if(correction?.action==='UPDATE'&&(!results||results.some(r=>r.publicationVerdict!=='CMS_RECORD_CONFIRMED'||!correction.posts?.some(p=>p.destination===r.destination&&p.post_id===r.postId))))return null;
  return results?{...decision,results}:null;
 };
}
