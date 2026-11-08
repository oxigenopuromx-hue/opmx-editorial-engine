import {validateCorrectionConfirmation} from './correction-preview.mjs';
import {destinationLabel,resolveDestinations} from './original-destinations.mjs';
import {createHash} from 'node:crypto';
const digest=x=>createHash('sha256').update(x).digest('hex');
const fail=()=>{throw Error('CONFIRMED_CORRECTION_UNCONFIRMED')};

// Caller owns the read transaction. A missing decision is a legacy recovery,
// not permission to invent one. All records below are server-owned; source
// text cannot supply them. This module is not enabled in production.
export async function readConfirmedCorrectionInTransaction(c,packageId,revision){
 if(!c?.execute||!/^tg_[a-f0-9]{40}$/.test(packageId??'')||!Number.isSafeInteger(revision)||revision<2)fail();
 const [pkgs]=await c.execute('SELECT owner_key,state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);
 if(pkgs.length!==1||pkgs[0].state!=='READY'||Number(pkgs[0].revision)!==revision)fail();
 const [decisions]=await c.execute('SELECT preview_hash,decision_json FROM opmx_tg_confirmed_decisions_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
 if(!decisions.length)return null;if(decisions.length!==1)fail();
 let decision;try{decision=JSON.parse(decisions[0].decision_json)}catch{fail()}
 if(!decision||decision.packageId!==packageId||decision.revision!==revision-1||decision.ownerKey!==pkgs[0].owner_key||!/^[a-f0-9]{64}$/.test(decision.actorKey??'')||decision.action!=='CREATE'||!['LITERAL','EDITORIAL'].includes(decision.mode)||!Array.isArray(decision.posts)||decision.posts.some(p=>p.postId!==null))fail();
 try{const destinations=resolveDestinations(decision.destination);if(destinationLabel(destinations)!==decision.destination||decision.posts.length!==destinations.length||decision.posts.some((p,i)=>p.destination!==destinations[i]))fail()}catch{fail()}
 const hash=decisions[0].preview_hash;
 if(!validateCorrectionConfirmation({preview:decision,previewHash:hash,actorKey:decision.actorKey,ownerKey:pkgs[0].owner_key,currentRevision:revision-1,explicitAction:'CREATE'}))fail();
 const [records]=await c.execute('SELECT owner_key,preview_receipt,confirmation_receipt,state,event_id,preview_json FROM opmx_tg_correction_previews_v1 WHERE package_id=? AND revision=? AND preview_hash=? FOR UPDATE',[packageId,revision-1,hash]);
 if(records.length!==1||records[0].owner_key!==decision.actorKey||records[0].state!=='CONFIRMED'||records[0].preview_json!==decisions[0].decision_json||!/^evt_[a-f0-9]{48}$/.test(records[0].event_id??''))fail();
 const receipt=/^telegram-([1-9][0-9]{0,15})-([0-9]{1,16})-([0-9]{1,16})$/;
 const a=receipt.exec(records[0].preview_receipt??''),b=receipt.exec(records[0].confirmation_receipt??'');if(!a||!b||a[1]!==b[1]||digest(`opmx:telegram:v1:${a[1]}:${a[1]}`)!==decision.actorKey||BigInt(b[2])<=BigInt(a[2]))fail();
 const [events]=await c.execute('SELECT event_id FROM opmx_tg_events_v1 WHERE event_id=? AND package_id=? AND revision=? FOR UPDATE',[records[0].event_id,packageId,revision]);if(events.length!==1)fail();
 const [closures]=await c.execute('SELECT snapshot_revision,actor_key,close_receipt_key FROM opmx_tg_recovery_closures_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
 if(closures.length!==1||Number(closures[0].snapshot_revision)!==decision.baseRevision||closures[0].actor_key!==decision.actorKey||closures[0].close_receipt_key!==digest(records[0].preview_receipt))fail();
 return {package_id:packageId,revision,action:'CREATE',destination:decision.destination,content_mode:decision.mode,preview_hash:hash};
}
