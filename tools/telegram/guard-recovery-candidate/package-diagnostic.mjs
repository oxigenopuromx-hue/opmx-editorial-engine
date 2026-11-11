import {readRecoverySelectionInTransaction} from './recovery-selection-default.mjs';
const prefix='OPMX-TELEGRAM-ORDER-';
// Read-only, invoked after the existing package/administrator authorization.
// Editorial text is display data, never an instruction or permission.
export async function readPackageDiagnostic(c,{pack,lease,actorKey,ownerKey,items}){
 const active=items.filter(x=>x.state==='STORED'),texts=active.filter(x=>x.kind==='TEXT'&&!String(x.text_content).startsWith(prefix)),files=active.filter(x=>x.kind==='FILE');
 const urls=[...new Set(texts.flatMap(x=>String(x.text_content).match(/https?:\/\/[^\s<>"']+/g)??[]))].slice(0,6).map(x=>x.slice(0,500));
 const substantive=texts.filter(x=>String(x.text_content).replace(/https?:\/\/[^\s]+/g,'').trim().length>=80);
 const topic=substantive[0]?String(substantive[0].text_content).split('\n').find(x=>x.trim())?.slice(0,160):null;
 const d={schema:'opmx.package-diagnostic.v1',recovery:!!lease,origin:actorKey===ownerKey?'OWN':'OTHER_ACCOUNT',texts:texts.length,substantiveTexts:substantive.length,images:files.filter(x=>String(x.attachment_json??'').includes('image/')).length,files:files.length,pending:items.filter(x=>x.state==='PENDING').length,urls,topic:topic??null,action:null,contentMode:null,destination:null,originalMode:null,previousResults:[],confirmationCommand:null,previewDelivery:'NONE'};
 if(lease){
  const scope={packageId:pack.package_id,revision:Number(pack.revision),actorKey,ownerKey};
  const [rows]=await c.execute('SELECT owner_key,snapshot_json FROM opmx_tg_revision_snapshots_v1 WHERE package_id=? AND revision=?',[pack.package_id,Number(lease.opening_revision)-1]);
  if(rows.length===1&&rows[0].owner_key===ownerKey){let s;try{s=JSON.parse(rows[0].snapshot_json)}catch{}d.originalMode=s?.prior?.authorization?.mode??null;d.previousResults=(s?.prior?.results??[]).map(x=>({destination:x.destination,status:x.status,...(Number.isSafeInteger(x.postId)?{postId:x.postId}:{})}));}
  let selected;try{selected=await readRecoverySelectionInTransaction(c,scope)}catch{}
  if(selected){d.action=selected.action;d.contentMode=selected.mode;d.destination=selected.destination;}
  const [previews]=await c.execute("SELECT preview_hash,preview_json FROM opmx_tg_correction_previews_v1 WHERE package_id=? AND revision=? AND owner_key=? AND state='PREVIEWED'",[pack.package_id,Number(pack.revision),actorKey]);
  if(previews.length===1){
   const [parts]=await c.execute('SELECT part_number,part_count,state,telegram_message_id FROM opmx_tg_preview_delivery_v1 WHERE package_id=? AND revision=? AND preview_hash=? AND actor_key=? ORDER BY part_number',[pack.package_id,Number(pack.revision),previews[0].preview_hash,actorKey]);
   const complete=parts.length>0&&parts.every((p,i)=>p.state==='SENT'&&Number(p.part_number)===i+1&&Number(p.part_count)===parts.length&&Number(p.telegram_message_id)>0);
   d.previewDelivery=complete?'DELIVERED':parts.some(p=>p.state==='SENDING')?'UNCERTAIN':'PENDING';
   let p;try{p=JSON.parse(previews[0].preview_json)}catch{}
   if(complete&&['CREATE','UPDATE'].includes(p?.action)&&/^[a-f0-9]{64}$/.test(previews[0].preview_hash))d.confirmationCommand=`/confirmar ${p.action==='CREATE'?'crear':'actualizar'} ${pack.revision} ${previews[0].preview_hash}`;
  }
 }
 d.next=d.pending?'RESOLVE_PENDING':d.recovery&&!d.action?'RECONCILE_OPTIONS':d.confirmationCommand?'CONFIRM_PREVIEW':d.previewDelivery==='UNCERTAIN'?'CHECK_UNCERTAIN_DELIVERY':d.recovery?'REQUEST_PREVIEW':'SEAL';
 return d;
}
