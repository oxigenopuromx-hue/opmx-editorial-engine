import {destinationRegistry} from './original-destinations.mjs';
import {inspectTargetProgress} from './deployed-guard/target-progress.mjs';

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
