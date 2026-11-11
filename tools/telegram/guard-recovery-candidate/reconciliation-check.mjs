import {createRevisionReconciliation} from './revision-reconciliation.mjs';
import {createRevisionCapture} from './revision-capture.mjs';

// Technical diagnostic: run the actual gate and identity reconciliation on
// real locked records, then unconditionally ROLLBACK. No session, lease,
// outbox event or reopen is created. This is not a publication permission.
export function createReconciliationCheck({pool,observeRuntime,readWordPress}){
 const evidence=createRevisionReconciliation({observeRuntime,readWordPress});
 const capture=createRevisionCapture({lockVerifiedBlockedOutcomes:evidence.lockVerifiedOutcomes});
 return async input=>{
  const no=()=>({status:'RECONCILIATION_REQUIRED',writeAuthorized:false,processTerminationClaimed:false});
  if(!input||Object.keys(input).sort().join(',')!=='packageId,revision'||!/^tg_[a-f0-9]{40}$/.test(input.packageId??'')||!Number.isSafeInteger(input.revision)||input.revision<1)return no();
  const c=await pool.getConnection();
  try{
   await c.beginTransaction();
   const [q]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(q.length!==1)return no();
   const [p]=await c.execute('SELECT state,revision,owner_key FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[input.packageId]);
   if(p.length!==1||p[0].state!=='READY'||Number(p[0].revision)!==input.revision)return no();
   const [rows]=await c.execute('SELECT i.item_id,i.owner_key,i.kind,i.state,i.text_content,i.content_bytes,i.sha256,c.actor_key FROM opmx_tg_items_v1 i LEFT JOIN opmx_tg_recovery_contributions_v1 c ON c.item_id=i.item_id AND c.package_id=i.package_id WHERE i.package_id=? ORDER BY i.created_at,i.item_id FOR UPDATE',[input.packageId]);
   if(rows.some(r=>r.state==='PENDING'))return no();
   const items=rows.map(r=>({itemId:r.item_id,ownerKey:r.owner_key,kind:r.kind,state:r.state,text:r.text_content,contentBytes:Number(r.content_bytes),sha256:r.sha256,actorKey:r.actor_key??null}));
   const barrier=await evidence.lockSafetyBarrier(c,input.packageId,input.revision);if(!barrier)return no();
   const prior=await capture(c,input.packageId,input.revision,p[0].owner_key,items);if(!prior)return no();
   return {status:'RECONCILIATION_VERIFIED',packageId:input.packageId,revision:input.revision,results:prior.results.map(r=>({destination:r.destination,status:r.status,...(r.postId?{postId:r.postId}:{} )})),writesRolledBack:true,writeAuthorized:false,processTerminationClaimed:false};
  }catch{return no()}finally{try{await c.rollback()}finally{c.release()}}
 };
}
