import {createHash} from 'node:crypto';
import {readVerifiedUpdateDecisionInTransaction} from './confirmed-correction-reader.mjs';
import {canonicalUpdateValue} from './canonical-json.mjs';
export {canonicalUpdateValue} from './canonical-json.mjs';

const pkg=/^tg_[a-f0-9]{40}$/,hash=/^[a-f0-9]{64}$/;
const sites=new Set(['OPURO','OPOL','LIBERAL']);
const allowed=new Set(['title','content','excerpt','featured_media','author','categories','tags','meta','status']);
const sha=x=>createHash('sha256').update(x).digest('hex');
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
function freezeDeep(x){if(x&&typeof x==='object'){for(const v of Object.values(x))freezeDeep(v);Object.freeze(x)}return x}
export function validUpdatePayload(payload){
 if(!object(payload)||!Object.keys(payload).length||Object.keys(payload).some(k=>!allowed.has(k)))return false;
 for(const k of ['title','content','excerpt'])if(Object.hasOwn(payload,k)&&(typeof payload[k]!=='string'||Buffer.byteLength(payload[k])>2*1024*1024))return false;
 for(const k of ['featured_media','author'])if(Object.hasOwn(payload,k)&&(!Number.isSafeInteger(payload[k])||payload[k]<0))return false;
 for(const k of ['categories','tags'])if(Object.hasOwn(payload,k)&&(!Array.isArray(payload[k])||payload[k].some(x=>!Number.isSafeInteger(x)||x<1)||new Set(payload[k]).size!==payload[k].length))return false;
 if(Object.hasOwn(payload,'meta')&&!object(payload.meta))return false;
 if(Object.hasOwn(payload,'status')&&!['publish','draft'].includes(payload.status))return false;
 try{return Buffer.byteLength(canonicalUpdateValue(payload))<=4*1024*1024}catch{return false}
}
export function cmsMatches(post,id,slug,payload){
 if(!post||post.id!==id||post.type!=='post'||post.slug!==slug||!['publish','draft'].includes(post.status))return false;
 for(const [k,v] of Object.entries(payload)){
  const value=['title','content','excerpt'].includes(k)?post[k]?.raw:post[k];
  if(k==='meta'){try{if(!object(value)||Object.keys(v).some(key=>!Object.hasOwn(value,key)||canonicalUpdateValue(value[key])!==canonicalUpdateValue(v[key])))return false}catch{return false}continue}
  try{if(canonicalUpdateValue(value)!==canonicalUpdateValue(v))return false}catch{return false}
 }
 return true;
}

// Read the real decision on a transaction-owned connection; the subsequent
// claim rechecks it under the publication fence immediately before writing.
export function createVerifiedUpdateDecisionLoader(pool){
 if(!pool?.getConnection)throw Error('UPDATE_EXECUTOR_INCOMPLETE');
 return async input=>{const c=await pool.getConnection();let committed=false;try{await c.beginTransaction();const result=await readVerifiedUpdateDecisionInTransaction(c,input);await c.commit();committed=true;return result}catch(error){if(!committed)try{await c.rollback()}catch{}throw error}finally{c.release()}};
}

// Server-only orchestrator. The caller cannot supply IDs, payloads, or CMS
// credentials; those are resolved from the verified decision and trusted
// server providers. WordPress is contacted only after the one-use guard claim.
// A lost write or readback response remains uncertain and is never retried.
export function createUpdateExecutor({loadDecision,loadPayload,claimStore,wordpress}){
 if(typeof loadDecision!=='function'||typeof loadPayload!=='function'||typeof claimStore?.begin!=='function'||typeof wordpress?.read!=='function'||typeof wordpress?.update!=='function')throw Error('UPDATE_EXECUTOR_INCOMPLETE');
 return {async execute(input){
  if(!object(input)||Object.keys(input).sort().join(',')!=='destination,packageId,previewHash,revision'||!pkg.test(input.packageId??'')||!Number.isSafeInteger(input.revision)||input.revision<2||!sites.has(input.destination)||!hash.test(input.previewHash??''))throw Error('INVALID_UPDATE_REQUEST');
  const {packageId,revision,destination,previewHash}=input;
  const no=(status,extra={})=>({status,packageId,revision,destination,wordpressConfirmation:'NOT_CONFIRMED',publicVisibility:'NOT_CHECKED',telegramAck:'NOT_CHECKED',retryPermitted:false,...extra});
  let d,p;try{d=await loadDecision({packageId,revision});p=await loadPayload({packageId,revision,destination,previewHash})}catch{return no('UPDATE_NOT_READY')}
  if(!d||d.packageId!==packageId||d.revision!==revision||d.action!=='UPDATE'||d.previewHash!==previewHash||!Array.isArray(d.posts)||new Set(d.posts.map(x=>x?.destination)).size!==d.posts.length)return no('DECISION_UNCONFIRMED');
  const target=d.posts.filter(x=>x?.destination===destination);if(target.length!==1||!Number.isSafeInteger(target[0].postId)||target[0].postId<1)return no('DECISION_UNCONFIRMED');
  const postId=target[0].postId;
  if(!p||p.packageId!==packageId||p.revision!==revision||p.destination!==destination||p.previewHash!==previewHash||p.postId!==postId||p.exactPayload!==true||typeof p.slug!=='string'||p.slug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)||!validUpdatePayload(p.payload))return no('PAYLOAD_UNCONFIRMED',{postId});
  const encoded=canonicalUpdateValue(p.payload),payload=freezeDeep(JSON.parse(encoded)),slug=p.slug,payloadHash=sha(encoded),operationId='upd_'+sha(`${packageId}:${revision}:${destination}:${postId}:${previewHash}:${payloadHash}`);
  let before;try{before=await wordpress.read({destination,postId})}catch{return no('CMS_PREFLIGHT_UNCONFIRMED',{postId})}
  if(before?.statusCode!==200||before.post?.id!==postId||before.post?.type!=='post'||before.post?.slug!==slug||!['publish','draft'].includes(before.post?.status)||Object.hasOwn(payload,'status')&&payload.status!==before.post.status)return no('CMS_PREFLIGHT_UNCONFIRMED',{postId});
  let claimed;try{claimed=await claimStore.begin({packageId,revision,destination,postId,previewHash,payloadHash,operationId})}catch{return no('CLAIM_UNCONFIRMED',{postId})}
  if(!claimed||claimed.status!=='UPDATE_STARTED'||claimed.packageId!==packageId||claimed.revision!==revision||claimed.destination!==destination||claimed.postId!==postId||claimed.operationId!==operationId)return no('CLAIM_UNCONFIRMED',{postId});
  const writeScope={packageId,revision,destination,postId,previewHash,payloadHash,operationId,slug,payload};
  let sent;try{sent=typeof wordpress.updateConfirmed==='function'?await wordpress.updateConfirmed(writeScope):await wordpress.update({destination,postId,payload})}catch{return no('UPDATE_UNCERTAIN',{postId,writeAttempted:true})}
  if(!sent||!Number.isInteger(sent.statusCode)||sent.statusCode<200||sent.statusCode>=300||sent.post?.id!==postId)return no('UPDATE_UNCERTAIN',{postId,writeAttempted:true});
  let after;try{after=await wordpress.read({destination,postId})}catch{return no('UPDATE_UNCERTAIN',{postId,writeAttempted:true})}
  if(after?.statusCode!==200||after.post?.status!==before.post.status||!cmsMatches(after.post,postId,slug,payload))return no('UPDATE_UNCERTAIN',{postId,writeAttempted:true});
  if(typeof wordpress.recordConfirmation==='function'){
   let receipt;try{receipt=await wordpress.recordConfirmation(writeScope)}catch{return no('UPDATE_UNCERTAIN',{postId,writeAttempted:true})}
   if(receipt?.status!=='UPDATE_RECEIPT_RECORDED'||receipt.operationId!==operationId)return no('UPDATE_UNCERTAIN',{postId,writeAttempted:true});
  }
  return {status:'CMS_UPDATE_CONFIRMED',packageId,revision,destination,postId,wordpressConfirmation:'CONFIRMED',wordpressStatus:after.post.status,publicVisibility:'NOT_CHECKED',telegramAck:'NOT_CHECKED',retryPermitted:false};
 }};
}
