import {readCorrectionSelectionInTransaction} from './correction-selection-store.mjs';
import {resolveDestinations,destinationLabel} from './original-destinations.mjs';
// An absent manual option inherits only a reconciled server-owned snapshot.
// It cannot promote source text to authority or turn an existing post into CREATE.
export async function readRecoverySelectionInTransaction(c,scope){
 const selected=await readCorrectionSelectionInTransaction(c,scope);if(selected)return selected;
 const {packageId,revision,ownerKey,actorKey=ownerKey}=scope;
 const [choices]=await c.execute('SELECT s.action FROM opmx_tg_correction_selections_v2 s JOIN opmx_tg_recovery_leases_v1 l ON l.package_id=s.package_id WHERE s.package_id=? AND s.revision>=l.opening_revision AND s.revision<=? LIMIT 1 FOR UPDATE',[packageId,revision]);
 if(choices.length)throw Error('SELECTION_UNCONFIRMED');
 const [leases]=await c.execute('SELECT owner_key,actor_key,opening_revision FROM opmx_tg_recovery_leases_v1 WHERE package_id=? FOR UPDATE',[packageId]);
 const l=leases[0],baseRevision=Number(l?.opening_revision)-1;
 if(leases.length!==1||l.owner_key!==ownerKey||l.actor_key!==actorKey||!Number.isSafeInteger(baseRevision)||baseRevision<1||baseRevision>=revision)return null;
 const [rows]=await c.execute('SELECT owner_key,snapshot_json FROM opmx_tg_revision_snapshots_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,baseRevision]);
 if(rows.length!==1||rows[0].owner_key!==ownerKey)return null;
 let snap;try{snap=JSON.parse(rows[0].snapshot_json)}catch{return null}
 const p=snap?.prior,b=snap?.barrier;
 if(p?.packageId!==packageId||p.revision!==baseRevision||p.ownerKey!==ownerKey||p.authorization?.authorized!==true||!['DRAFT','PUBLISH'].includes(p.authorization.mode)||b?.writesFenced!==true||b.terminalBlocked!==true||b.noActiveAttempts!==true||!Array.isArray(p.destinations)||!Array.isArray(p.results)||p.results.length!==p.destinations.length||new Set(p.results.map(x=>x?.destination)).size!==p.destinations.length)return null;
 let destination;try{destination=destinationLabel(p.destinations);if(resolveDestinations(destination).length!==p.destinations.length||p.results.some(x=>!p.destinations.includes(x.destination)))return null}catch{return null}
 const absent=p.results.every(x=>x.status==='BLOCKED'&&x.publicationVerdict==='NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED');
 const existing=p.results.every(x=>x.publicationVerdict==='CMS_RECORD_CONFIRMED'&&x.cmsVerified===true&&Number.isSafeInteger(x.postId)&&x.postId>0&&['PUBLISHED','DRAFT'].includes(x.status));
 if(absent&&b.noPublicationSideEffects!==true||existing&&(b.noPublicationSideEffects!==false||b.allPublicationOutcomesVerified!==true)||!absent&&!existing)return null;
 return {packageId,revision,ownerKey,action:absent?'CREATE':'UPDATE',mode:'EDITORIAL',destination};
}
