import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {renderCorrectionPreview} from './correction-preview-renderer.mjs';
import {validateCorrectionConfirmation} from './correction-preview.mjs';

// Candidate migration: only install explicitly in an isolated database.
export const previewDeliverySchema=`CREATE TABLE IF NOT EXISTS opmx_tg_preview_delivery_v1 (
 package_id VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL, preview_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 part_number INT UNSIGNED NOT NULL, part_count INT UNSIGNED NOT NULL,
 payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 state VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 telegram_message_id BIGINT UNSIGNED NULL, updated_at DATETIME(6) NOT NULL,
 PRIMARY KEY(package_id,revision,preview_hash,part_number),
 UNIQUE KEY preview_message(package_id,revision,preview_hash,telegram_message_id)
) ENGINE=InnoDB`;
const hash=x=>createHash('sha256').update(x).digest('hex');
const hex=/^[a-f0-9]{64}$/,pkg=/^tg_[a-f0-9]{40}$/,user=/^[1-9][0-9]{0,15}$/;
const actor=id=>hash(`opmx:telegram:v1:${id}:${id}`);
const validRevision=n=>Number.isSafeInteger(n)&&n>0&&n<4294967295;
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&hex.test(a)&&hex.test(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
function inputIdentity(x,extra=[]){
 const keys=['owner','chat','packageId','revision','previewHash',...extra];
 if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join(',')!==keys.sort().join(',')||typeof x.owner!=='string'||!user.test(x.owner)||x.owner!==x.chat||!pkg.test(x.packageId??'')||!validRevision(x.revision)||!hex.test(x.previewHash??''))throw Error('INVALID_PREVIEW_DELIVERY');
 return actor(x.owner);
}
function renderVerified(row,x,actorKey){
 let preview;try{preview=JSON.parse(row.preview_json)}catch{throw Error('PREVIEW_DELIVERY_UNCONFIRMED')}
 if(row.owner_key!==actorKey||preview.actorKey!==actorKey||preview.packageId!==x.packageId||preview.revision!==x.revision||!validateCorrectionConfirmation({preview,previewHash:x.previewHash,actorKey,ownerKey:preview.ownerKey,currentRevision:x.revision,explicitAction:'CREATE'}))throw Error('PREVIEW_DELIVERY_UNCONFIRMED');
 const rendered=renderCorrectionPreview({status:'PREVIEW_READY',preview});
 if(rendered.status!=='PREVIEW_RENDERED'||!Array.isArray(rendered.messages)||!rendered.messages.length||rendered.messages.length>300)throw Error('PREVIEW_DELIVERY_UNCONFIRMED');
 return rendered.messages;
}
export function createPreviewDeliveryStore({pool,tokenFactory=()=>randomBytes(32).toString('hex')}){
 if(!pool?.getConnection||typeof tokenFactory!=='function')throw Error('INVALID_PREVIEW_DELIVERY_CONFIGURATION');
 async function tx(fn){const c=await pool.getConnection();let committed=false;try{await c.beginTransaction();const result=await fn(c);await c.commit();committed=true;return result}catch(e){if(!committed)try{await c.rollback()}catch{}throw e}finally{c.release()}}
 async function lock(c,x,actorKey){
  const [quota]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(quota.length!==1)throw Error('QUOTA_MISSING');
  const [p]=await c.execute('SELECT owner_key,state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[x.packageId]);
  if(p.length!==1||p[0].state!=='OPEN'||Number(p[0].revision)!==x.revision)return null;
  const [rows]=await c.execute('SELECT owner_key,preview_receipt,preview_json,state FROM opmx_tg_correction_previews_v1 WHERE package_id=? AND revision=? AND preview_hash=? FOR UPDATE',[x.packageId,x.revision,x.previewHash]);
  if(rows.length!==1||rows[0].state!=='PREVIEWED'||rows[0].owner_key!==actorKey)return null;
  const messages=renderVerified(rows[0],x,actorKey);
  if(JSON.parse(rows[0].preview_json).ownerKey!==p[0].owner_key)throw Error('PREVIEW_DELIVERY_UNCONFIRMED');
  return {row:rows[0],messages};
 }
 const key=x=>[x.packageId,x.revision,x.previewHash];
 async function rows(c,x){const [r]=await c.execute('SELECT actor_key,part_number,part_count,payload_hash,state,token_hash,telegram_message_id FROM opmx_tg_preview_delivery_v1 WHERE package_id=? AND revision=? AND preview_hash=? ORDER BY part_number FOR UPDATE',key(x));return r}
 function validateRows(r,messages,actorKey){return r.length===messages.length&&r.every((v,i)=>{
  if(v.actor_key!==actorKey||Number(v.part_number)!==i+1||Number(v.part_count)!==messages.length||v.payload_hash!==hash(messages[i]))return false;
  if(v.state==='PENDING')return v.token_hash===null&&v.telegram_message_id===null;
  if(v.state==='SENDING')return hex.test(v.token_hash??'')&&v.telegram_message_id===null;
  if(v.state==='SENT')return hex.test(v.token_hash??'')&&Number.isSafeInteger(Number(v.telegram_message_id))&&Number(v.telegram_message_id)>0;
  return false;
 })}
 return {
  async initialize(x){const actorKey=inputIdentity(x);return tx(async c=>{
   const current=await lock(c,x,actorKey);if(!current)return {status:'NOT_AVAILABLE'};
   let r=await rows(c,x);if(r.length){if(!validateRows(r,current.messages,actorKey))throw Error('PREVIEW_DELIVERY_UNCONFIRMED');return {status:'DELIVERY_EXISTS',parts:r.length}}
   for(let i=0;i<current.messages.length;i++)await c.execute("INSERT INTO opmx_tg_preview_delivery_v1 (package_id,revision,preview_hash,actor_key,part_number,part_count,payload_hash,state,token_hash,telegram_message_id,updated_at) VALUES (?,?,?,?,?,?,?,'PENDING',NULL,NULL,UTC_TIMESTAMP(6))",[...key(x),actorKey,i+1,current.messages.length,hash(current.messages[i])]);
   return {status:'DELIVERY_READY',parts:current.messages.length};
  })},
  async claim(x){const actorKey=inputIdentity(x);return tx(async c=>{
   const current=await lock(c,x,actorKey);if(!current)return {status:'NOT_AVAILABLE'};
   const r=await rows(c,x);if(!validateRows(r,current.messages,actorKey))return {status:'DELIVERY_NOT_READY'};
   const next=r.findIndex(v=>v.state!=='SENT');if(next<0)return {status:'DELIVERY_COMPLETE'};
   if(r[next].state!=='PENDING'||r.slice(next+1).some(v=>v.state!=='PENDING'))return {status:'DELIVERY_UNCERTAIN',retryPermitted:false};
   const token=tokenFactory();if(!hex.test(token??''))throw Error('INVALID_DELIVERY_TOKEN');
   const [changed]=await c.execute("UPDATE opmx_tg_preview_delivery_v1 SET state='SENDING',token_hash=?,updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND preview_hash=? AND part_number=? AND state='PENDING'",[hash(token),...key(x),next+1]);
   if(changed.affectedRows!==1)throw Error('PREVIEW_DELIVERY_CONFLICT');
   return {status:'PART_CLAIMED',part:next+1,parts:r.length,token,text:current.messages[next],parseMode:'HTML'};
  })},
  // Only the trusted receiver may report the actual Telegram API response.
  // User content, a timeout, or a claim token alone is never a delivery ack.
  async report(x){const actorKey=inputIdentity(x,['part','token','telegramChat','telegramMessageId']);
   if(!Number.isSafeInteger(x.part)||x.part<1||!hex.test(x.token??'')||x.telegramChat!==x.chat||!Number.isSafeInteger(x.telegramMessageId)||x.telegramMessageId<1)throw Error('INVALID_PREVIEW_DELIVERY');
   return tx(async c=>{const current=await lock(c,x,actorKey);if(!current)return {status:'NOT_AVAILABLE'};
    const r=await rows(c,x);if(!validateRows(r,current.messages,actorKey)||x.part>r.length)return {status:'DELIVERY_NOT_READY'};
    const part=r[x.part-1];if(!same(part.token_hash,hash(x.token)))return {status:'NOT_AUTHORIZED'};
    if(part.state==='SENT')return Number(part.telegram_message_id)===x.telegramMessageId?{status:'PART_REPORTED_REPLAY'}:{status:'DELIVERY_UNCERTAIN',retryPermitted:false};
    if(part.state!=='SENDING'||r.slice(0,x.part-1).some(v=>v.state!=='SENT'||!Number.isSafeInteger(Number(v.telegram_message_id))||Number(v.telegram_message_id)>=x.telegramMessageId))return {status:'DELIVERY_UNCERTAIN',retryPermitted:false};
    const [changed]=await c.execute("UPDATE opmx_tg_preview_delivery_v1 SET state='SENT',telegram_message_id=?,updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND preview_hash=? AND part_number=? AND state='SENDING' AND token_hash=?",[x.telegramMessageId,...key(x),x.part,hash(x.token)]);
    if(changed.affectedRows!==1)throw Error('PREVIEW_DELIVERY_CONFLICT');return {status:'PART_REPORTED'};
   });
  },
  async verifyPreviewDelivery(c,x){
   if(!c?.execute||!pkg.test(x?.packageId??'')||!validRevision(x.revision)||!hex.test(x.previewHash??'')||!hex.test(x.actorKey??''))return false;
   const [p]=await c.execute('SELECT owner_key,preview_receipt,preview_json,state FROM opmx_tg_correction_previews_v1 WHERE package_id=? AND revision=? AND preview_hash=? FOR UPDATE',key(x));
   if(p.length!==1||p[0].state!=='PREVIEWED'||p[0].preview_receipt!==x.previewReceipt)return false;
   let messages;try{messages=renderVerified(p[0],x,x.actorKey)}catch{return false}
   const r=await rows(c,x);return validateRows(r,messages,x.actorKey)&&r.every((v,i)=>v.state==='SENT'&&Number.isSafeInteger(Number(v.telegram_message_id))&&Number(v.telegram_message_id)>0&&(i===0||Number(r[i-1].telegram_message_id)<Number(v.telegram_message_id)));
  }
 };
}
