import {createHash} from 'node:crypto';
import {decodeControl} from './original-destination-policy.mjs';

const prefix='OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d\n';
const hash=x=>createHash('sha256').update(x).digest('hex');
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=()=>{throw Error('RECOVERY_POLICY_UNCONFIRMED')};
const itemPattern=/^ti_[a-f0-9]{40}$/;
const hashPattern=/^[a-f0-9]{64}$/;
// Same direct-image grammar used by the authenticated Telegram receiver and
// the production image selector. It conveys image intent, never publication
// authorization; mode commands remain forbidden in the recovery additions.
const directImage=/^(?:\/imagen\s+generar$|(?:genera|generar|crea|crear)\s+(?:una\s+)?(?:imagen|ilustraci[oó]n)[^\n]{0,180}(?:\n|$))/i;
function validClose(text,packageId){
 if(typeof text!=='string'||!text.startsWith(prefix+'/listo\n'))return false;
 let c;try{c=JSON.parse(text.slice((prefix+'/listo\n').length))}catch{return false}
 return object(c)&&Object.keys(c).sort().join(',')==='message_id,package_id,policy'&&c.package_id===packageId&&['publish-ambos-v1','publish-todos-v2'].includes(c.policy)&&Number.isSafeInteger(c.message_id)&&c.message_id>0;
}

// Candidate only. All arguments must come from guard-owned immutable snapshots,
// closure records and item/contribution rows under one consistent read. Never
// accept this structure from Telegram or from the editorial material itself.
export function resolveRecoveredPolicy({packageId,revision,snapshot,closure,items}){
 if(!/^tg_[a-f0-9]{40}$/.test(packageId??'')||!Number.isSafeInteger(revision)||revision<1||!object(snapshot)||!object(snapshot.prior)||!object(closure)||!Array.isArray(items))fail();
 const prior=snapshot.prior,auth=prior.authorization;
 if(prior.packageId!==packageId||!hashPattern.test(prior.ownerKey??'')||closure.packageId!==packageId||closure.revision!==revision||closure.snapshotRevision!==prior.revision||closure.snapshotRevision>=revision||
    !object(auth)||!['PUBLISH','DRAFT'].includes(auth.mode)||auth.authorized!==true||!['DIRECT_MODE_COMMAND','ANNOUNCED_DEFAULT_AND_DIRECT_CLOSE'].includes(auth.authorization)||typeof auth.explicit!=='boolean'||
    (auth.authorization==='DIRECT_MODE_COMMAND'&&auth.explicit!==true)||(auth.authorization==='ANNOUNCED_DEFAULT_AND_DIRECT_CLOSE'&&(auth.explicit!==false||auth.mode!=='PUBLISH'))||
    !Array.isArray(prior.destinations)||!prior.destinations.length||prior.destinations.some(d=>!['OPURO','OPOL','LIBERAL'].includes(d))||new Set(prior.destinations).size!==prior.destinations.length||
    !Array.isArray(prior.controls)||!Array.isArray(snapshot.items)||!hashPattern.test(closure.actorKey??'')||!hashPattern.test(closure.closeReceiptKey??'')||!itemPattern.test(closure.closeItemId??''))fail();
 const before=new Map(),after=new Map();
 for(const item of snapshot.items){if(!itemPattern.test(item.itemId??'')||item.ownerKey!==prior.ownerKey||before.has(item.itemId))fail();before.set(item.itemId,item);}
 for(const item of items){if(!itemPattern.test(item.itemId??'')||after.has(item.itemId))fail();after.set(item.itemId,item);}
 // Compare all immutable source and quota fields preserved by the snapshot.
 for(const [id,old] of before){
  const now=after.get(id);if(!now)fail();
  for(const key of ['ownerKey','receiptKey','fingerprint','kind','text','contentBytes','sha256'])if(old[key]!==now[key])fail();
  if(JSON.stringify(old.attachment??null)!==JSON.stringify(now.attachment??null))fail();
  // The store retains original bytes, fingerprint and quota reservation when
  // an editor discards a stored item; history must still count toward quota.
  // Original authorization controls must remain stored and immutable.
  const removed=old.state==='STORED'&&now.state==='DISCARDED';
  if(removed){if(prior.controls.includes(id)||now.reservedBytes!==old.reservedBytes)fail();}
  else if(old.state!==now.state||old.reservedBytes!==now.reservedBytes)fail();
 }
 if(new Set(prior.controls).size!==prior.controls.length||prior.controls.some(id=>!before.has(id)))fail();
 // Preserve a source mode only when it was captured from authenticated
 // controls or a previously confirmed correction. Old snapshots with no
 // content mode keep their legacy editorial behavior.
 const hasContentMode=Object.hasOwn(prior,'contentMode');
 if(hasContentMode&&!['LITERAL','EDITORIAL'].includes(prior.contentMode))fail();
 if(Object.hasOwn(prior,'confirmedPreviewHash')&&!hashPattern.test(prior.confirmedPreviewHash??''))fail();
 const contentIds=prior.contentControlItemIds??[];
 if(!Array.isArray(contentIds)||new Set(contentIds).size!==contentIds.length||contentIds.some(id=>!prior.controls.includes(id)))fail();
 const embedded=[];
 for(const id of prior.controls){const item=before.get(id);if(item?.kind!=='TEXT'||typeof item.text!=='string')continue;let control;try{control=decodeControl(item.text.trim(),packageId)}catch{fail()}if(control&&['/literal','/editorial'].includes(control.command))embedded.push({id,...control});}
 if(embedded.length!==contentIds.length||embedded.some(c=>!contentIds.includes(c.id))||contentIds.some(id=>!embedded.some(c=>c.id===id))||contentIds.length&&!hasContentMode)fail();
 const lastContent=contentIds.length?embedded.find(c=>c.id===contentIds.at(-1)):null;
 const confirmedOverride=hashPattern.test(prior.confirmedPreviewHash??'');
 if(hasContentMode&&!confirmedOverride&&((prior.contentMode==='LITERAL'&&!lastContent)||lastContent&&(lastContent.command==='/literal'?'LITERAL':'EDITORIAL')!==prior.contentMode))fail();
 const extra=items.filter(i=>!before.has(i.itemId));
 if(!extra.length||extra.at(-1).itemId!==closure.closeItemId||items.at(-1)?.itemId!==closure.closeItemId)fail();
 const additionalCloses=[];
 for(const item of extra){
  if(item.ownerKey!==prior.ownerKey||!['STORED','DISCARDED'].includes(item.state)||item.actorKey!==closure.actorKey||!['TEXT','FILE'].includes(item.kind))fail();
  // Stored discards retain bytes and quota; pending file reservations can be
  // released because they have no stored bytes or content hash.
  if(item.state==='DISCARDED'){
   if(item.sha256===null){if(item.reservedBytes!==0||item.contentBytes!==0)fail();}
   else if(!hashPattern.test(item.sha256??'')||item.reservedBytes!==item.contentBytes)fail();
   continue;
  }
  if(item.kind==='TEXT'){
   if(typeof item.text!=='string'||hash(item.text)!==item.sha256||Buffer.byteLength(item.text)!==item.contentBytes)fail();
   if(item.text.startsWith(prefix)&&item.itemId!==closure.closeItemId&&!directImage.test(item.text.slice(prefix.length))){if(!validClose(item.text,packageId))fail();additionalCloses.push(item.itemId)}
  }
 }
 const close=extra.at(-1);
 if(close.kind!=='TEXT'||close.receiptKey!==closure.closeReceiptKey||!validClose(close.text,packageId))fail();
 const selected=['OPURO','OPOL','LIBERAL'].filter(d=>prior.destinations.includes(d));
 const destination=selected.length===3?'TODOS':selected.join(',')==='OPURO,OPOL'?'AMBOS':selected.join(',');
 // This is provenance from an immutable server-owned snapshot, not a new
 // correction or permission to acknowledge the old preview on this revision.
 // Keep it separate from confirmed_correction so a later capture can retain
 // a literal choice originally authorized by an earlier confirmed preview.
 return {mode:auth.mode,authorized:true,explicit:auth.explicit,authorization:auth.authorization,destination,control_item_ids:[...prior.controls,...additionalCloses,closure.closeItemId],...(hasContentMode?{content_mode:prior.contentMode,content_control_item_ids:[...contentIds],...(confirmedOverride?{content_mode_provenance_hash:prior.confirmedPreviewHash}:{})}:{})};
}
