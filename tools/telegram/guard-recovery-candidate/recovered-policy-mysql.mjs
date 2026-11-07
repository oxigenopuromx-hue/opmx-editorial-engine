import {resolveRecoveredPolicy} from './recovered-policy.mjs';

// Caller owns the transaction and must publish no result until it commits.
// This deliberately exposes no HTTP route and does not authorize recovery.
export async function readRecoveredPolicyInTransaction(connection,packageId,revision){
 if(!connection?.execute||!/^tg_[a-f0-9]{40}$/.test(packageId??'')||!Number.isSafeInteger(revision)||revision<1)throw Error('INVALID_RECOVERY_POLICY_REQUEST');
 const [pkgs]=await connection.execute('SELECT owner_key,state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);
 if(pkgs.length!==1||pkgs[0].state!=='READY'||Number(pkgs[0].revision)!==revision)throw Error('RECOVERY_POLICY_UNCONFIRMED');
 const [closures]=await connection.execute('SELECT snapshot_revision,actor_key,close_item_id,close_receipt_key FROM opmx_tg_recovery_closures_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
 if(closures.length!==1)throw Error('RECOVERY_POLICY_UNCONFIRMED');
 const row=closures[0],snapshotRevision=Number(row.snapshot_revision);
 const [snapshots]=await connection.execute('SELECT owner_key,snapshot_json FROM opmx_tg_revision_snapshots_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,snapshotRevision]);
 if(snapshots.length!==1||snapshots[0].owner_key!==pkgs[0].owner_key)throw Error('RECOVERY_POLICY_UNCONFIRMED');
 let snapshot;try{snapshot=JSON.parse(snapshots[0].snapshot_json)}catch{throw Error('RECOVERY_POLICY_UNCONFIRMED')}
 const [rows]=await connection.execute('SELECT i.item_id,i.owner_key,i.receipt_key,i.fingerprint,i.kind,i.state,i.text_content,i.attachment_json,i.reserved_bytes,i.content_bytes,i.sha256,c.actor_key FROM opmx_tg_items_v1 i LEFT JOIN opmx_tg_recovery_contributions_v1 c ON c.item_id=i.item_id AND c.package_id=i.package_id WHERE i.package_id=? ORDER BY i.created_at,i.item_id FOR UPDATE',[packageId]);
 let items;try{items=rows.map(x=>({itemId:x.item_id,ownerKey:x.owner_key,receiptKey:x.receipt_key,fingerprint:x.fingerprint,kind:x.kind,state:x.state,text:x.text_content,attachment:x.attachment_json?JSON.parse(x.attachment_json):null,reservedBytes:Number(x.reserved_bytes),contentBytes:Number(x.content_bytes),sha256:x.sha256,actorKey:x.actor_key}));}catch{throw Error('RECOVERY_POLICY_UNCONFIRMED')}
 return resolveRecoveredPolicy({packageId,revision,snapshot,closure:{packageId,revision,snapshotRevision,actorKey:row.actor_key,closeItemId:row.close_item_id,closeReceiptKey:row.close_receipt_key},items});
}
