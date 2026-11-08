import {resolveRecoveredPolicy} from './recovered-policy.mjs';
import {resolveDestinations,destinationLabel} from './original-destinations.mjs';

const fail=()=>{throw Error('CORRECTION_FACTS_UNCONFIRMED')};
const id=/^tg_[a-f0-9]{40}$/, hash=/^[a-f0-9]{64}$/;

// Called under the quota and package locks held by the confirmation store.
// The selection provider must read choices recorded from authenticated direct
// Telegram commands, under this transaction. Source material is never a choice.
// CREATE is the only supported action; existing WordPress posts require a
// separately reconciled update path that this provider deliberately rejects.
export function createCorrectionFactsReader({readLockedSelection}) {
 if(typeof readLockedSelection!=='function')throw Error('CORRECTION_FACTS_CONFIGURATION_INCOMPLETE');
 return async function readFacts(c,{packageId,revision,ownerKey,actorKey=ownerKey}) {
  if(!c?.execute||!id.test(packageId??'')||!hash.test(ownerKey??'')||!hash.test(actorKey??'')||!Number.isSafeInteger(revision)||revision<2||revision>=4294967295)fail();
  const [leases]=await c.execute('SELECT actor_key,owner_key,opening_revision FROM opmx_tg_recovery_leases_v1 WHERE package_id=? FOR UPDATE',[packageId]);
  if(leases.length!==1||leases[0].owner_key!==ownerKey||leases[0].actor_key!==actorKey)fail();
  const baseRevision=Number(leases[0].opening_revision)-1;if(!Number.isSafeInteger(baseRevision)||baseRevision<1||baseRevision>=revision)fail();
  const [sessions]=await c.execute('SELECT package_id FROM opmx_tg_sessions_v1 WHERE owner_key=? FOR UPDATE',[actorKey]);
  if(sessions.length!==1||sessions[0].package_id!==packageId)fail();
  const [snapshots]=await c.execute('SELECT owner_key,snapshot_json FROM opmx_tg_revision_snapshots_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,baseRevision]);
  if(snapshots.length!==1||snapshots[0].owner_key!==ownerKey)fail();
  let snapshot;try{snapshot=JSON.parse(snapshots[0].snapshot_json)}catch{fail()}
  const [rows]=await c.execute('SELECT i.item_id,i.owner_key,i.receipt_key,i.fingerprint,i.kind,i.state,i.text_content,i.attachment_json,i.reserved_bytes,i.content_bytes,i.sha256,c.actor_key FROM opmx_tg_items_v1 i LEFT JOIN opmx_tg_recovery_contributions_v1 c ON c.item_id=i.item_id AND c.package_id=i.package_id WHERE i.package_id=? ORDER BY i.created_at,i.item_id FOR UPDATE',[packageId]);
  let items;try{items=rows.map(x=>({itemId:x.item_id,ownerKey:x.owner_key,receiptKey:x.receipt_key,fingerprint:x.fingerprint,kind:x.kind,state:x.state,text:x.text_content,attachment:x.attachment_json?JSON.parse(x.attachment_json):null,reservedBytes:Number(x.reserved_bytes),contentBytes:Number(x.content_bytes),sha256:x.sha256,actorKey:x.actor_key??null}))}catch{fail()}
  if(!items.length||items.some(x=>x.state==='PENDING'))fail();
  const close=items.at(-1);
  // Reuse the same immutable-inventory and attested-close checks as Motor.
  let verifiedPolicy;try{verifiedPolicy=resolveRecoveredPolicy({packageId,revision:revision+1,snapshot,closure:{packageId,revision:revision+1,snapshotRevision:baseRevision,actorKey,closeItemId:close.itemId,closeReceiptKey:close.receiptKey},items})}catch{fail()}
  const selection=await readLockedSelection(c,{packageId,revision,ownerKey,actorKey});
  if(!selection||selection.packageId!==packageId||selection.revision!==revision||selection.ownerKey!==ownerKey||selection.action!=='CREATE'||!['LITERAL','EDITORIAL'].includes(selection.mode))fail();
  let destination;try{destination=destinationLabel(resolveDestinations(selection.destination));if(destination!==selection.destination)fail()}catch{fail()}
  const visible=list=>list.filter(x=>x.sha256!==null).map(x=>{
   if(x.kind==='FILE'&&(!x.attachment||typeof x.attachment.file_name!=='string'||typeof x.text!=='string'))fail();
   return {itemId:x.itemId,kind:x.kind,state:x.state,sha256:x.sha256,...(x.kind==='TEXT'?{text:x.text}:{fileName:x.attachment.file_name,caption:x.text})};
  });
  if(!Array.isArray(snapshot.items))fail();
  return {baseRevision,before:visible(snapshot.items),after:visible(items),action:'CREATE',mode:selection.mode,destination,verifiedPosts:{},authorizedEditorKey:actorKey,controlItemIds:verifiedPolicy.control_item_ids};
 };
}
