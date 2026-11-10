import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
const pkg=/^tg_[a-f0-9]{40}$/, user=/^[1-9][0-9]{0,15}$/,hex=/^[a-f0-9]{64}$/,receipt=/^telegram-([1-9][0-9]{0,15})-([1-9][0-9]{0,15})-([0-9]{1,16})$/;
const ownerKey=x=>hash(`opmx:telegram:v1:${x}:${x}`);
// Only the server selects the recipient and original close receipt. A Motor
// can request materialization but supplies no text, destination or recipient.
export function createPreviewMaterializer({pool,preview,adminUserIds=[]}){
 if(!pool?.getConnection||typeof preview!=='function'||!Array.isArray(adminUserIds)||adminUserIds.some(x=>typeof x!=='string'||!user.test(x)))throw Error('PREVIEW_MATERIALIZER_INCOMPLETE');
 const admins=new Set(adminUserIds);
 return async function materialize(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='chat,owner,packageId,revision'||typeof input.owner!=='string'||!user.test(input.owner)||input.chat!==input.owner||!pkg.test(input.packageId??'')||!Number.isSafeInteger(input.revision)||input.revision<2||input.revision>=4294967295)return {status:'PREVIEW_NOT_READY'};
  const c=await pool.getConnection();let rows;try{
   [rows]=await c.execute("SELECT p.owner_key,p.state AS package_state,p.revision,l.owner_key lease_owner,l.actor_key,l.receipt_id lease_receipt,j.receipt_id,j.receipt_hash,j.state AS job_state FROM opmx_tg_packages_v1 p JOIN opmx_tg_recovery_leases_v1 l ON l.package_id=p.package_id JOIN opmx_tg_preview_generation_v1 j ON j.package_id=p.package_id AND j.revision=? WHERE p.package_id=?",[input.revision,input.packageId]);
  }finally{c.release()}
  const row=rows[0],lease=receipt.exec(row?.lease_receipt??''),close=receipt.exec(row?.receipt_id??''),editor=lease?.[1];
  if(rows.length!==1||row.owner_key!==ownerKey(input.owner)||row.lease_owner!==row.owner_key||row.package_state!=='OPEN'||Number(row.revision)!==input.revision||!['DISPATCHING','DISPATCHED'].includes(row.job_state)||!lease||!close||close[1]!==editor||row.actor_key!==ownerKey(editor)||(editor!==input.owner&&!admins.has(editor))||!hex.test(row.receipt_hash??'')||hash(row.receipt_id)!==row.receipt_hash)return {status:'PREVIEW_NOT_READY'};
  // The preview operation reacquires quota/package/lease/selection locks and
  // revalidates all stored content and IDs, closing the read-to-use race.
  const result=await preview({owner:editor,chat:editor,packageId:input.packageId,revision:input.revision,receiptId:row.receipt_id});
  const p=result?.preview;
  if(!['PREVIEW_READY','PREVIEW_EXISTS'].includes(result?.status)||p?.packageId!==input.packageId||p?.revision!==input.revision||!hex.test(p?.previewHash??'')||p.actorKey!==row.actor_key||p.ownerKey!==row.owner_key)return {status:'PREVIEW_NOT_READY'};
  // This response is internal to n8n's guarded delivery graph; the MCP
  // response must never expose editor identities, message parts or tokens.
  return {status:'PREVIEW_MATERIALIZED',owner:editor,chat:editor,packageId:input.packageId,revision:input.revision,previewHash:p.previewHash};
 };
}
