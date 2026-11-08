import {createHash} from 'node:crypto';
import {destinationLabel,resolveDestinations} from './original-destinations.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {copyVerifiedOutcomes} from './verified-outcomes.mjs';

// Read IDs from a guard-owned snapshot and the existing target ledger while
// the package is locked. This is identity evidence for a preview only. It
// never permits a write: the update writer must recheck WordPress and claim
// the exact payload separately. A deleted, missing or ambiguous post fails.
// The snapshot must have been recorded by an authenticated server-side CMS
// reconciliation; messages and document contents cannot create it.
export async function readVerifiedUpdatePosts(c,input){
 const {packageId,revision,baseRevision,ownerKey,actorKey,destination}=input??{};
 if(!c?.execute||!/^tg_[a-f0-9]{40}$/.test(packageId??'')||!Number.isSafeInteger(revision)||!Number.isSafeInteger(baseRevision)||baseRevision<1||revision<=baseRevision||!/^[a-f0-9]{64}$/.test(ownerKey??'')||!/^[a-f0-9]{64}$/.test(actorKey??''))return null;
 let selected;try{selected=resolveDestinations(destination);if(destinationLabel(selected)!==destination)return null}catch{return null}
 const [rows]=await c.execute('SELECT owner_key,snapshot_json FROM opmx_tg_revision_snapshots_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,baseRevision]);
 if(rows.length!==1||rows[0].owner_key!==ownerKey)return null;
 let snap;try{snap=JSON.parse(rows[0].snapshot_json)}catch{return null}
 const prior=snap?.prior,barrier=snap?.barrier;
 if(!prior||prior.packageId!==packageId||prior.revision!==baseRevision||prior.ownerKey!==ownerKey||!copyVerifiedOutcomes(prior.destinations,prior.results)||!barrier||barrier.packageId!==packageId||barrier.revision!==baseRevision||barrier.writesFenced!==true||barrier.terminalBlocked!==true||barrier.noActiveAttempts!==true||barrier.noPublicationSideEffects!==false||barrier.allPublicationOutcomesVerified!==true)return null;
 let originalLabel;try{originalLabel=destinationLabel(prior.destinations);if(resolveDestinations(originalLabel).length!==prior.destinations.length||prior.requestId!==expectedDraftRequestId({packageId,revision:baseRevision,destination:originalLabel}))return null}catch{return null}
 if(selected.some(d=>!prior.destinations.includes(d)))return null;
 const posts={};
 for(const destination of selected){
  const result=prior.results.find(x=>x?.destination===destination);
  if(!result||result.publicationVerdict!=='CMS_RECORD_CONFIRMED'||result.cmsVerified!==true||!['PUBLISHED','DRAFT'].includes(result.status)||(result.status==='PUBLISHED'?result.wordpressStatus!=='publish':result.wordpressStatus!=='draft')||!Number.isSafeInteger(result.postId)||result.postId<1||typeof result.slug!=='string'||result.slug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.slug))return null;
  const key=createHash('sha256').update(`opmx:v1:${destination}:${result.slug}`).digest('hex');
  const [ledger]=await c.execute('SELECT target_key,status,post_id FROM opmx_mcp_target_progress WHERE target_key=? AND request_id=? AND destination=? FOR UPDATE',[key,prior.requestId,destination]);
  if(ledger.length!==1||ledger[0].target_key!==key||ledger[0].status!=='reported'||String(ledger[0].post_id)!==String(result.postId))return null;
  posts[destination]=result.postId;
 }
 return {packageId,revision,baseRevision,ownerKey,actorKey,destination,verified:true,posts};
}
