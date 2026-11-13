import {createHash} from 'node:crypto';
import {buildTask29CancellationAdminOperations,task29AdminNames} from './task29-build-cancellation-admin-operations.mjs';
import {task29CancellationScope} from '../task29-delivery-cancellation-alert.mjs';

// Emits real Code-node function literals. No network/table/Telegram calls,
// eval/require, prototype adaptations, or globals borrowed from the host.
export function buildTask29CancellationAdminCodeQa(graph,expected){
 const ops=buildTask29CancellationAdminOperations(graph,expected),n=task29AdminNames;
 const code=name=>ops.find(x=>x.nodeName===name)?.parameters.jsCode??ops.find(x=>x.node?.name===name)?.node.parameters.jsCode;
 const functions=[['prepare',n.prepare,'$input,Date'],['records',n.prepareRecords,'$input,Date'],['select',n.select,'$input,Date'],['verify',n.verify,'$json,$,Date'],['attach',n.attachCancellation,'$json,$']];
 return `// TASK29_ADMIN_REAL_CODE_QA_V1
const scope=${JSON.stringify(task29CancellationScope)};
const sourceHashes=${JSON.stringify(Object.fromEntries(functions.map(([name,node])=>[name,createHash('sha256').update(code(node)).digest('hex')])))};
${functions.map(([name,node,args])=>`const ${name}=function(${args}){\n${code(node)}\n};`).join('\n')}
const now=Date.parse('2026-11-13T04:00:00.000Z'),source='2026-11-12T01:00:41.397Z';
class QaDate extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}}
let checks=0,cases=0;const check=(v,code)=>{checks++;if(!v)throw Error('TASK29_ADMIN_QA_'+code)};
const run=(fn,items)=>fn({all:()=>items.map(json=>({json}))},QaDate);
const binding={id:10,package_id:scope.packageId,revision:10,stage:'REQUEST_TODOS',request_id:scope.requestId};
const rows=(stage='DRAFT_UNCERTAIN',extra=[])=>[{id:1,package_id:scope.packageId,revision:10,stage:'QUEUED',chat_id:'123',occurred_at:source},binding,{id:1637,package_id:scope.packageId,revision:10,stage,occurred_at:source},...extra];
const proof=()=>({schema:'opmx.destination-cancellation.v1',status:'DELIVERY_CANCELLATION_CONFIRMED',...scope,tombstoneHash:'a'.repeat(64),observedAt:'2026-11-13T03:59:59.000Z',cancellationObservedAt:'2026-11-13T03:59:00.000Z',currentCmsVerified:true,mixedOutcome:true,publicationComplete:false,writeAuthorized:false,reopenAuthorized:false,resumeAuthorized:false,retryPermitted:false,processTerminationClaimed:false,telegramAck:'NOT_CHECKED',publicVisibility:'NOT_CHECKED',writesFenced:true,noActiveN8nWriters:true,attemptState:'REVOKED',fenceState:'RECONCILING',consistentSnapshot:false,results:[{destination:'OPURO',postId:10493,status:'PUBLISHED',wordpressStatus:'publish',slug:scope.slug,originalSlug:scope.slug},{destination:'OPOL',postId:3515,status:'PUBLISHED',wordpressStatus:'publish',slug:scope.slug,originalSlug:scope.slug},{destination:'LIBERAL',postId:393,status:'CANCELLED',wordpressStatus:'trash',slug:scope.slug+'__trashed',originalSlug:scope.slug}]});
const original=rows(),copy=JSON.stringify(original),batch=run(prepare,original)[0].json;
cases++;check(JSON.stringify(original)===copy,'INPUT_IMMUTABLE');check(batch.needsObservation===true,'OBSERVE');check(batch.candidates[0].sourceStage==='DRAFT_UNCERTAIN','BASE_STAGE');
const p=proof(),withProof={...batch,cancellationObservation:p};
check(run(select,[withProof])[0].json.alerts.length===1,'RAW_PROOF_NO_SUPPRESSION');
const reconciled=run(records,[withProof])[0].json;check(reconciled.reconciliationRecords.length===1,'ONE_RECORD');
const record=reconciled.reconciliationRecords[0];check(record.stage==='DELIVERY_CANCELLED_RECONCILED|'+'a'.repeat(64),'CANCEL_STAGE');check(record.request_id===scope.requestId,'ORIGINAL_REQUEST');check(!JSON.stringify(record).includes('PUBLICATION_RECONCILED'),'NO_FALSE_PUBLISH');
cases++;const context={...reconciled,reconciliation:record},getter=()=>({item:{json:context}});
const failed=verify({id:400},getter,QaDate).json;check(failed.persistenceConfirmed===false,'ACK_ALL_COLUMNS');check(run(select,[failed])[0].json.alerts.length===1,'FAILED_ACK_VISIBLE');
const acknowledged=verify({...record,id:400},getter,QaDate).json;check(acknowledged.persistenceConfirmed===true,'ACK_CONFIRMED');check(run(select,[acknowledged]).length===0,'ACK_SUPPRESSION');check(run(prepare,rows('DRAFT_UNCERTAIN',[{...record,id:400}])).length===0,'NEXT_POLL_SUPPRESSION');
for(const change of[{requestId:'tg_'+'b'.repeat(64)},{operationId:'another-operation-20261113'},{publicationComplete:true},{writesFenced:false},{observedAt:'2026-11-13T03:55:00.000Z'},{results:p.results.map(x=>x.destination==='LIBERAL'?{...x,status:'PUBLISHED',wordpressStatus:'publish',slug:scope.slug}:x)}]){cases++;const b=run(records,[{...batch,cancellationObservation:{...proof(),...change}}])[0].json;check(b.reconciliationRecords.length===0,'REJECT_INVALID_PROOF');check(run(select,[b])[0].json.alerts.length===1,'INVALID_STAYS_VISIBLE')}
cases++;const media=run(prepare,rows('DIAG|MEDIA_FAILED|IMAGE_CREDIT_REQUIRED|2',[{...record,id:400}]))[0].json,visible=run(select,[media])[0].json;check(visible.alerts.length===1,'MEDIA_VISIBLE');check(visible.text.includes('Falta un crédito'),'DIAG_PRESERVED');check(!visible.text.includes(scope.requestId),'NO_REQUEST_LEAK');check(Object.keys(visible.alerts[0]).sort().join(',')==='occurred_at,package_id,revision,stage','ACK_FOUR_FIELDS');
cases++;const alerted=run(prepare,rows('DRAFT_UNCERTAIN',[{id:1638,package_id:scope.packageId,revision:10,stage:'ALERT_ADMIN_1637',occurred_at:source}]))[0].json;check(alerted.needsObservation===true,'ALREADY_ALERTED_OBSERVABLE');check(alerted.candidates[0].alreadyAlerted===true,'DEDUP_PRESERVED');check(run(records,[{...alerted,cancellationObservation:proof()}])[0].json.reconciliationRecords.length===1,'ALREADY_ALERTED_RECONCILE');check(run(select,[alerted]).length===0,'NO_DUPLICATE_MESSAGE');
cases++;const other={...batch,candidates:batch.candidates.map(c=>({...c,sourceRequestId:'tg_'+'b'.repeat(64)})),cancellationObservation:proof()};check(run(records,[other])[0].json.reconciliationRecords.length===0,'OTHER_REQUEST');
cases++;const many=[];for(let i=0;i<20;i++){const package_id='tg_'+(i+1).toString(16).padStart(40,'0');many.push({id:i*2+1,package_id,revision:8,stage:'QUEUED',chat_id:'123',occurred_at:source},{id:100+i,package_id,revision:8,stage:'DIAG|MEDIA_FAILED|IMAGE_CREDIT_REQUIRED|2',occurred_at:source})}
const twenty=run(prepare,many)[0].json,sent=run(select,[twenty])[0].json;check(sent.text.length<=3800,'BUDGET');check(sent.alerts.length>0&&sent.alerts.length<20,'COMPLETE_PREFIX');check((sent.text.match(/Código:/g)||[]).length===sent.alerts.length,'NO_TRUNCATION');check(sent.alerts.every(a=>Object.keys(a).sort().join(',')==='occurred_at,package_id,revision,stage'),'DELIVERED_ONLY_ACK');const next=run(prepare,[...many,...sent.alerts.map((a,i)=>({...a,id:1000+i}))])[0].json;check(next.candidates.every(c=>!sent.alerts.some(a=>a.package_id===c.package_id)),'NEXT_POLL_REMAINDER');
cases++;const attached=attach({statusCode:200,body:proof()},()=>({item:{json:{...batch,observe:{packageId:scope.packageId,revision:10},observation:{status:'NOT_FINAL'}}}})).json;check(attached.cancellationObservation.status==='DELIVERY_CANCELLATION_CONFIRMED','PAIRED_CANCEL_PROOF');check(attached.observation.status==='NOT_FINAL','ORIGINAL_PROOF_PRESERVED');const unmatched=attach({statusCode:200,body:{...proof(),revision:11}},()=>({item:{json:{...batch,observe:{packageId:scope.packageId,revision:10}}}})).json;check(unmatched.cancellationObservation===null,'WRONG_HTTP_SCOPE');
return [{json:{status:'TASK29_ADMIN_REAL_CODE_QA_PASSED',cases,checks,sourceHashes,networkCalls:0,tableWrites:0,telegramMessages:0,prototypeAdaptations:0,changedCodeBodies:4,newCodeBodies:1}}];`;
}
