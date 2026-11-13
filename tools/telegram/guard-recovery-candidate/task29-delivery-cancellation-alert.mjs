// Incident #29 is an explicitly cancelled delivery, not a final publication.
// These fixed identities are intentionally narrower than the general #30
// publication resolver. Only the Guard's authenticated read-only observer may
// supply a proof; CMS status or a Telegram message alone never authorizes it.
export const task29CancellationScope=Object.freeze({
 packageId:'tg_00991fbbd87a751fb8513f4d4f6fcebca8469bee',revision:10,
 requestId:'tg_e6400942bcd85878aaa03f722f03b7644261071d6339593c2dede692f582edbf',
 destination:'LIBERAL',postId:393,slug:'simey-olvera-innovacion-tecnologica-reducir-desigualdades',operationId:'requested-20261113-issue29-simey-liberal'
});
const task29StagePrefix='DELIVERY_CANCELLED_RECONCILED|';
const task29Hash=/^[a-f0-9]{64}$/;
const task29Time=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)?Date.parse(value):NaN;
const task29CandidateValid=c=>c?.package_id===task29CancellationScope.packageId&&c.revision===task29CancellationScope.revision&&['DRAFT_UNCERTAIN','PUBLISH_UNCERTAIN'].includes(c.sourceStage)&&Number.isFinite(task29Time(c.sourceOccurredAt));
const task29RequestMatches=(candidate,requestRows)=>{
 const rows=Array.isArray(requestRows)?requestRows.filter(r=>r?.package_id===task29CancellationScope.packageId&&r.revision===task29CancellationScope.revision&&r.stage==='REQUEST_TODOS'):[];
 const explicit=candidate?.sourceRequestId??candidate?.request_id;
 return rows.length===1&&rows[0].request_id===task29CancellationScope.requestId&&(explicit===undefined||explicit===null||explicit===task29CancellationScope.requestId);
};

export function task29CancellationStage(stage){
 return typeof stage==='string'&&stage.startsWith(task29StagePrefix)&&task29Hash.test(stage.slice(task29StagePrefix.length))?stage.slice(task29StagePrefix.length):null;
}

export function task29CancellationProofConfirmed(candidate,proof,{requestRows=[],nowMs=Date.now(),maxObservationAgeMs=120000}={}){
 const scope=task29CancellationScope,x=proof;
 if(!task29CandidateValid(candidate)||!task29RequestMatches(candidate,requestRows)||!Number.isFinite(nowMs)||!Number.isSafeInteger(maxObservationAgeMs)||maxObservationAgeMs<0)return false;
 if(!x||typeof x!=='object'||Array.isArray(x)||x.schema!=='opmx.destination-cancellation.v1'||x.status!=='DELIVERY_CANCELLATION_CONFIRMED'||x.packageId!==scope.packageId||x.revision!==scope.revision||x.requestId!==scope.requestId||x.destination!==scope.destination||x.postId!==scope.postId||x.operationId!==scope.operationId||!task29Hash.test(x.tombstoneHash??''))return false;
 if(x.currentCmsVerified!==true||x.mixedOutcome!==true||x.publicationComplete!==false||x.writeAuthorized!==false||x.reopenAuthorized!==false||x.resumeAuthorized!==false||x.retryPermitted!==false||x.processTerminationClaimed!==false||x.telegramAck!=='NOT_CHECKED'||x.publicVisibility!=='NOT_CHECKED'||x.writesFenced!==true||x.noActiveN8nWriters!==true||!['REVOKED','NOT_REGISTERED'].includes(x.attemptState)||x.fenceState!=='RECONCILING')return false;
 const observed=task29Time(x.observedAt),cancelled=task29Time(x.cancellationObservedAt),source=task29Time(candidate.sourceOccurredAt);
 if(!Number.isFinite(observed)||!Number.isFinite(cancelled)||cancelled<source||cancelled>observed||observed<source||observed>nowMs+5000||nowMs-observed>maxObservationAgeMs)return false;
 if(!Array.isArray(x.results)||x.results.length!==3)return false;
 const expected=[['OPURO',10493],['OPOL',3515],['LIBERAL',393]];
 return x.results.every((r,i)=>{
  if(!r||typeof r!=='object'||Array.isArray(r)||r.destination!==expected[i][0]||r.postId!==expected[i][1]||r.originalSlug!==scope.slug)return false;
  if(i<2)return r.status==='PUBLISHED'&&r.wordpressStatus==='publish'&&r.slug===scope.slug;
  return r.status==='CANCELLED'&&r.originalSlug===scope.slug&&((r.wordpressStatus==='draft'&&r.slug===scope.slug)||(r.wordpressStatus==='trash'&&r.slug===scope.slug+'__trashed'));
 });
}

// Suppression uses an acknowledged, durable cancellation record. A raw Guard
// proof is not enough, and the original DRAFT_UNCERTAIN remains in history.
export function task29CancellationWasReconciled(candidate,reconciliationRows=[],{requestRows=[],nowMs=Date.now()}={}){
 if(!task29CandidateValid(candidate)||!task29RequestMatches(candidate,requestRows)||!Array.isArray(reconciliationRows)||!Number.isFinite(nowMs))return false;
 const matching=reconciliationRows.filter(r=>r?.package_id===task29CancellationScope.packageId&&r.revision===task29CancellationScope.revision&&task29CancellationStage(r.stage)&&Number.isSafeInteger(r.id)&&r.id>0&&r.request_id===task29CancellationScope.requestId&&Number.isFinite(task29Time(r.occurred_at))&&task29Time(r.occurred_at)>=task29Time(candidate.sourceOccurredAt)&&task29Time(r.occurred_at)<=nowMs+5000&&!Object.hasOwn(r,'error'));
 return matching.length>0&&new Set(matching.map(r=>r.stage)).size===1;
}

export function prepareTask29CancellationReconciliations(candidates,observations,{requestRows=[],reconciliationRows=[],nowMs=Date.now()}={}){
 if(!Array.isArray(candidates)||!Array.isArray(observations)||!Array.isArray(requestRows)||!Array.isArray(reconciliationRows)||!Number.isFinite(nowMs))throw Error('TASK29_CANCELLATION_INPUT_INVALID');
 const records=[],seen=new Set();
 for(const candidate of candidates){
  if(!task29CandidateValid(candidate)||task29CancellationWasReconciled(candidate,reconciliationRows,{requestRows,nowMs}))continue;
  const matches=observations.filter(x=>x?.packageId===candidate.package_id&&x.revision===candidate.revision);
  if(matches.length!==1||!task29CancellationProofConfirmed(candidate,matches[0],{requestRows,nowMs}))continue;
  const stage=task29StagePrefix+matches[0].tombstoneHash;
  // Never append another hash to outvote a conflicting durable identity.
  if(reconciliationRows.some(r=>r?.package_id===candidate.package_id&&r.revision===candidate.revision&&Number.isSafeInteger(r.id)&&r.id>0&&task29CancellationStage(r.stage)&&r.stage!==stage))continue;
  const key=candidate.package_id+':'+candidate.revision;if(seen.has(key))continue;seen.add(key);
  records.push({package_id:candidate.package_id,revision:candidate.revision,stage,occurred_at:new Date(nowMs).toISOString(),request_id:task29CancellationScope.requestId});
 }
 return records;
}

export function task29CancellationInsertConfirmed(expected,row){
 if(expected?.package_id!==task29CancellationScope.packageId||expected.revision!==task29CancellationScope.revision||expected.request_id!==task29CancellationScope.requestId||!task29CancellationStage(expected.stage)||!Number.isFinite(task29Time(expected.occurred_at))||!row||Object.hasOwn(row,'error')||!Number.isSafeInteger(row.id)||row.id<1)return false;
 return row.package_id===expected.package_id&&row.revision===expected.revision&&row.request_id===expected.request_id&&row.stage===expected.stage&&Number.isFinite(task29Time(row.occurred_at))&&task29Time(row.occurred_at)===task29Time(expected.occurred_at);
}

export function retainAlertsWithoutTask29Cancellation(candidates,reconciliationRows,options={}){
 if(!Array.isArray(candidates))throw Error('TASK29_CANCELLATION_CANDIDATES_INVALID');
 return candidates.filter(c=>!task29CancellationWasReconciled(c,reconciliationRows,options));
}

export function task29CancellationSource(){
 return '// TASK29_MIXED_DELIVERY_CANCELLATION_V1\nconst task29CancellationScope='+JSON.stringify(task29CancellationScope)+';\nconst task29StagePrefix='+JSON.stringify(task29StagePrefix)+';\nconst task29Hash='+task29Hash+';\nconst task29Time='+task29Time+';\nconst task29CandidateValid='+task29CandidateValid+';\nconst task29RequestMatches='+task29RequestMatches+';\n'+[task29CancellationStage,task29CancellationProofConfirmed,task29CancellationWasReconciled,prepareTask29CancellationReconciliations,task29CancellationInsertConfirmed,retainAlertsWithoutTask29Cancellation].map(fn=>fn.toString()).join('\n');
}
