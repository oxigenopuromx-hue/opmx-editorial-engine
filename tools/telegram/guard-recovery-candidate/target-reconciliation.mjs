import {destinationRegistry} from './original-destinations.mjs';
import {inspectTargetProgress} from './deployed-guard/target-progress.mjs';
import {resolveDestinations,destinationLabel} from './original-destinations.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {createHash} from 'node:crypto';

// Adapter to the existing target ledger; it never inserts or modifies rows.
// An absent, malformed, or unsafe integer ID is not evidence of no post.
export function createTargetLedgerReader(pool){
 if(!pool?.getConnection)throw Error('RECONCILIATION_CONFIGURATION_INCOMPLETE');
 return async input=>{
  const record=await inspectTargetProgress(pool,input);
  const raw=record.postId,parsed=typeof raw==='string'&&/^[1-9][0-9]*$/.test(raw)?Number(raw):NaN;
  return {...input,status:record.status,postId:Number.isSafeInteger(parsed)&&parsed>0?parsed:null};
 };
}

// Historical targets do not store the slug in clear text. Locate only the ID
// recorded for the server-derived request ID and verify the returned WP slug
// against its stored target_key. This is an observation, not a consistent
// snapshot or authority to recreate/update a post.
export function createRequestTargetReconciler({pool,readWordPress}){
 if(!pool?.getConnection||typeof readWordPress!=='function')throw Error('RECONCILIATION_CONFIGURATION_INCOMPLETE');
 return async input=>{
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='destination,destinationChoice,packageId,revision'||!/^tg_[a-f0-9]{40}$/.test(input.packageId??'')||!Number.isSafeInteger(input.revision)||input.revision<1||!Object.hasOwn(destinationRegistry(),input.destination))throw Error('INVALID_RECONCILIATION_REQUEST');
  let destinations,requestId;try{destinations=resolveDestinations(input.destinationChoice);if(destinationLabel(destinations)!==input.destinationChoice||!destinations.includes(input.destination))throw Error();requestId=expectedDraftRequestId({packageId:input.packageId,revision:input.revision,destination:input.destinationChoice})}catch{throw Error('INVALID_RECONCILIATION_REQUEST')}
  const unknown=(reason,postId=null,observedStatus=null)=>({status:'RECONCILIATION_REQUIRED',reason,destination:input.destination,postId,observedStatus,cmsVerified:false,publicVisibility:'NOT_CHECKED',telegramAck:'NOT_CHECKED',consistentSnapshot:false,retryPermitted:false,writeAuthorized:false});
  let rows,c;try{c=await pool.getConnection();[rows]=await c.execute('SELECT target_key,status,post_id FROM opmx_mcp_target_progress WHERE request_id=? AND destination=?',[requestId,input.destination])}catch{return unknown('LEDGER_UNAVAILABLE')}finally{c?.release()}
  if(!Array.isArray(rows)||rows.length!==1||rows[0].status!=='reported'||!/^[a-f0-9]{64}$/.test(rows[0].target_key??''))return unknown('POST_ID_UNCONFIRMED');
  const raw=String(rows[0].post_id??''),postId=/^[1-9][0-9]*$/.test(raw)?Number(raw):NaN;
  if(!Number.isSafeInteger(postId)||postId<1)return unknown('POST_ID_UNCONFIRMED');
  let response;try{response=await readWordPress({site:destinationRegistry()[input.destination].cms,postId})}catch{return unknown('CMS_UNAVAILABLE',postId)}
  const p=response?.post;if(response?.statusCode!==200||!p||p.id!==postId||p.type!=='post')return unknown('CMS_IDENTITY_UNCONFIRMED',postId);
  const status=['publish','draft','trash','pending','future','private'].includes(p.status)?p.status:null;
  if(typeof p.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)||createHash('sha256').update(`opmx:v1:${input.destination}:${p.slug}`).digest('hex')!==rows[0].target_key)return unknown('CMS_IDENTITY_UNCONFIRMED',postId,status);
  if(!status)return unknown('CMS_STATUS_UNCONFIRMED',postId);
  return {status:'CMS_RECORD_CONFIRMED',requestId,destination:input.destination,postId,slug:p.slug,wordpressStatus:status,cmsVerified:true,publicVisibility:'NOT_CHECKED',telegramAck:'NOT_CHECKED',consistentSnapshot:false,retryPermitted:false,writeAuthorized:false};
 };
}

// Read-only internal integration. Providers are server-owned, never Telegram
// source content. This does not authorize an update, create or retry: the
// caller must still establish a writer fence, terminal execution and an
// explicit decision bound to the exact revision and post IDs.
export function createTargetReconciler({loadLedger,readWordPress}){
 if(typeof loadLedger!=='function'||typeof readWordPress!=='function')throw Error('RECONCILIATION_CONFIGURATION_INCOMPLETE');
 return async function reconcile(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='destination,requestId,slug'||typeof input.requestId!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(input.requestId)||typeof input.slug!=='string'||input.slug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)||!Object.hasOwn(destinationRegistry(),input.destination))throw Error('INVALID_RECONCILIATION_REQUEST');
  const unknown=(reason,postId=null)=>({status:'RECONCILIATION_REQUIRED',reason,destination:input.destination,postId,cmsVerified:false,publicVisibility:'NOT_CHECKED',telegramAck:'NOT_CHECKED',retryPermitted:false,writeAuthorized:false});
  let ledger;try{ledger=await loadLedger(input)}catch{return unknown('LEDGER_UNAVAILABLE')}
  if(!ledger||ledger.requestId!==input.requestId||ledger.slug!==input.slug||ledger.destination!==input.destination)return unknown('LEDGER_UNCONFIRMED');
  if(ledger.status!=='reported'||!Number.isSafeInteger(ledger.postId)||ledger.postId<1)return unknown('POST_ID_UNCONFIRMED');
  const postId=ledger.postId,site=destinationRegistry()[input.destination].cms;
  let result;try{result=await readWordPress({site,postId})}catch{return unknown('CMS_UNAVAILABLE',postId)}
  if(!result||result.statusCode!==200||!result.post||result.post.id!==postId||result.post.type!=='post'||result.post.slug!==input.slug)return unknown('CMS_IDENTITY_UNCONFIRMED',postId);
  const status=result.post.status;
  if(!['publish','draft','trash','pending','future','private'].includes(status))return unknown('CMS_STATUS_UNCONFIRMED',postId);
  return {status:'CMS_RECORD_CONFIRMED',destination:input.destination,postId,wordpressStatus:status,cmsVerified:true,publicVisibility:'NOT_CHECKED',telegramAck:'NOT_CHECKED',retryPermitted:false,writeAuthorized:false};
 };
}
