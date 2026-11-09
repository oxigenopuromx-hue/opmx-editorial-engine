import {createHash} from 'node:crypto';
import {resolveDestinations,destinationLabel} from './original-destinations.mjs';
import {canonicalUpdateValue} from './canonical-json.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const pkgId=/^tg_[a-f0-9]{40}$/;
const itemId=/^ti_[a-f0-9]{40}$/;
const hash=/^[a-f0-9]{64}$/;
const validRevision=x=>Number.isSafeInteger(x)&&x>0&&x<=4294967295;
const fail=()=>{throw Error('CORRECTION_PREVIEW_UNCONFIRMED')};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

// This function has no HTTP endpoint or publisher side effects. Its arguments
// must come from an authenticated session and locked, server-owned records.
// It is a preview of package changes, not an authorization to publish.
export function buildCorrectionPreview({packageId,revision,ownerKey,actorKey,authorizedEditorKey,baseRevision,before,after,action,mode,destination,verifiedPosts,controlItemIds=[],finalPayloads=null}){
 if(!pkgId.test(packageId??'')||!validRevision(revision)||!validRevision(baseRevision)||baseRevision>=revision||!hash.test(ownerKey??'')||!hash.test(actorKey??'')||(actorKey!==ownerKey&&authorizedEditorKey!==actorKey)||!Array.isArray(before)||!Array.isArray(after)||!['CREATE','UPDATE'].includes(action)||!['LITERAL','EDITORIAL'].includes(mode))fail();
 let destinations;try{destinations=resolveDestinations(destination)}catch{fail()}
 if(!obj(verifiedPosts)||Object.keys(verifiedPosts).some(x=>!['OPURO','OPOL','LIBERAL'].includes(x)))fail();
 for(const [name,id] of Object.entries(verifiedPosts))if(!Number.isSafeInteger(id)||id<1||!destinations.includes(name))fail();
 if(action==='UPDATE'&&destinations.some(d=>!Object.hasOwn(verifiedPosts,d)))fail();
 if(action==='CREATE'&&Object.keys(verifiedPosts).length)fail();
 const read=items=>{const out=new Map();for(const x of items){
  if(!obj(x)||!itemId.test(x.itemId??'')||out.has(x.itemId)||!['TEXT','FILE'].includes(x.kind)||!['STORED','DISCARDED'].includes(x.state)||!hash.test(x.sha256??''))fail();
  // Text is data for the owner's preview, never an operational command. Its
  // bytes must match the stored digest; captions/files remain identified by ID.
  if(x.text!==undefined&&x.text!==null&&(typeof x.text!=='string'||Buffer.byteLength(x.text)>16384))fail();
  if(x.kind==='FILE'&&(typeof x.fileName!=='string'||Buffer.byteLength(x.fileName)>1024||typeof x.caption!=='string'||Buffer.byteLength(x.caption)>16384))fail();
  if(x.kind==='TEXT'&&typeof x.text==='string'&&sha(x.text)!==x.sha256)fail();
  out.set(x.itemId,{itemId:x.itemId,kind:x.kind,state:x.state,sha256:x.sha256,...(x.kind==='TEXT'&&typeof x.text==='string'?{text:x.text}:{}),...(x.kind==='FILE'&&x.fileName!==undefined?{fileName:x.fileName}:{}),...(x.kind==='FILE'&&x.caption!==undefined?{caption:x.caption}:{})});
 }return out};
 const old=read(before),current=read(after),changes=[];
 if(!Array.isArray(controlItemIds)||new Set(controlItemIds).size!==controlItemIds.length||controlItemIds.some(id=>!itemId.test(id??'')||current.get(id)?.state!=='STORED'))fail();
 for(const [id,item] of old){const now=current.get(id);if(!now||now.kind!==item.kind||now.sha256!==item.sha256||now.fileName!==item.fileName||now.caption!==item.caption)fail();if(item.state==='DISCARDED'&&now.state!=='DISCARDED')fail();if(item.state==='STORED'&&now.state==='DISCARDED')changes.push({itemId:id,kind:item.kind,change:'REMOVED',sha256:item.sha256,...(item.text!==undefined?{text:item.text}:{}),...(item.fileName!==undefined?{fileName:item.fileName}:{}),...(item.caption!==undefined?{caption:item.caption}:{})});}
 for(const [id,item] of current)if(!old.has(id)&&item.state==='STORED')changes.push({itemId:id,kind:item.kind,change:'ADDED',sha256:item.sha256,...(item.text!==undefined?{text:item.text}:{}),...(item.fileName!==undefined?{fileName:item.fileName}:{}),...(item.caption!==undefined?{caption:item.caption}:{})});
 if(![...current.values()].some(x=>x.state==='STORED'))fail();
 const posts=destinations.map(d=>({destination:d,postId:verifiedPosts[d]??null}));
 // Bind the complete retained inventory, not just the delta. Otherwise an
 // editor cannot review unchanged text or determine which files remain active.
 const materials=[...current.values()].filter(x=>x.state==='STORED');
 const preview={packageId,revision,baseRevision,ownerKey,actorKey,action,mode,destination:destinationLabel(destinations),posts,changes,materials,controlItemIds:[...controlItemIds]};
 // Optional server-generated final output, reviewed before confirmation. No
 // content from a Telegram source can supply this property as a command.
 if(finalPayloads!==null){
  if(action!=='UPDATE'||!obj(finalPayloads)||Object.keys(finalPayloads).length!==destinations.length||destinations.some(d=>!Object.hasOwn(finalPayloads,d)||!obj(finalPayloads[d])))fail();
  let encoded;try{encoded=canonicalUpdateValue(finalPayloads)}catch{fail()}
  if(encoded.length>16384)fail();
  preview.finalPayloads=JSON.parse(encoded);
 }
 return {...preview,previewHash:sha(JSON.stringify(preview))};
}

// Confirmation must refer to the exact preview, actor and current revision.
// This check alone is not a durable single-use claim; the caller must persist
// the proposal and consume it atomically in the same transaction as enqueue.
export function validateCorrectionConfirmation({preview,previewHash,actorKey,ownerKey,currentRevision,explicitAction}){
 if(!obj(preview)||!hash.test(previewHash??'')||!hash.test(ownerKey??'')||!hash.test(actorKey??'')||preview.actorKey!==actorKey||preview.ownerKey!==ownerKey||!validRevision(currentRevision)||currentRevision!==preview.revision||!['CREATE','UPDATE'].includes(explicitAction)||explicitAction!==preview.action)return false;
 const {previewHash:embedded,...content}=preview;
 return embedded===previewHash&&sha(JSON.stringify(content))===previewHash;
}
