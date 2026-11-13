import {diagnosePackageQuotaFailure} from '../package-quota-diagnostic.mjs';

export function buildIssue18AtomicCloseQaCode(operations){
 const code=name=>operations.find(o=>o.type==='updateNodeParameters'&&o.nodeName===name)?.parameters.jsCode;
 const resolve=code('Resolver paquete Telegram'),prepare=code('Preparar sellado con cierre acreditado'),confirm=code('Confirmar operación de paquete Telegram'),pass=operations.find(o=>o.type==='addNode'&&o.node.name==='Solicitar vista de recuperación')?.node.parameters.jsCode;
 if([resolve,prepare,confirm,pass].some(s=>typeof s!=='string'))throw Error('ATOMIC_CLOSE_QA_OPERATIONS_INVALID');
 const quota=diagnosePackageQuotaFailure({operation:'RESERVE',pack:{item_count:39,used_bytes:100},quota:{used_bytes:100},requestedBytes:1,itemLimit:39,packageBytesLimit:26214400,totalBytesLimit:134217728,recovery:true});
 return `// ISSUE18_ATOMIC_CLOSE_QA_V1: actual candidate Code; synthetic in-memory data.
function resolveCode($input,$){\n${resolve}\n}
function prepareCode($input,$){\n${prepare}\n}
function confirmCode($input,$){\n${confirm}\n}
function passCode($input,$){\n${pass}\n}
let assertions=0;const cases=[];const check=(x,label)=>{assertions++;if(!x)throw Error('ATOMIC_CLOSE_QA_'+label)};
const clone=x=>JSON.parse(JSON.stringify(x)),pkg='tg_'+'a'.repeat(40),receipt='telegram-456-3-3';
function execute(fn,value,context){return clone(fn({first:()=>({json:clone(value)})},()=>({first:()=>({json:clone(context)})})))[0].json}
const intent={package_operation:'SEAL',kind:'COMMAND',text:'/listo',user_id:'456',chat_id:'456',message_id:3,receipt_id:receipt};
for(const recovery of [false,true]){
 const session={statusCode:200,body:{status:'OPEN',packageId:pkg,revision:39,recovery}},resolved=execute(resolveCode,session,intent);
 check(resolved.next_action==='close','SINGLE_CLOSE_ROUTE');check(resolved.next_url==='https://publisher.oxigenopuro.com.mx/v1/telegram/packages/close','FIXED_GUARD_ORIGIN');check(resolved.next_body.receiptId===receipt&&resolved.next_body.owner==='456'&&resolved.next_body.chat==='456','AUTHENTICATED_BODY');check(resolved.next_body.text.includes('/listo'),'ATTESTED_CONTROL');
 const result=recovery?{status:'PREVIEW_READY',preview:{packageId:pkg,revision:40,previewHash:'b'.repeat(64)}}:{status:'READY',packageId:pkg,revision:40};
 const wrapper={status:'CLOSE_COMPLETED',packageId:pkg,revision:40,recovery,replayed:false,receiptId:receipt,result},prepared=execute(prepareCode,wrapper,resolved);
 check(prepared.seal_requested===false,'NO_SECOND_SEAL_CALL');
 if(recovery){check(prepared.preview_requested===true,'PREVIEW_CONTINUES');check(JSON.stringify(execute(passCode,prepared,resolved))===JSON.stringify(result),'PREVIEW_PASSED_LOCALLY');check(prepared.preview_body.revision===40,'EXACT_PREVIEW_REVISION')}
 else{check(prepared.preview_requested!==true,'NO_PREVIEW_FOR_ORDINARY');check(execute(confirmCode,prepared.passthrough,resolved).package_state==='READY','CLOSURE_NOTICE')}
 cases.push(recovery?'recovery_preview':'ordinary_ready');
}
const resolved=execute(resolveCode,{statusCode:200,body:{status:'OPEN',packageId:pkg,revision:40,recovery:true}},intent);
const originalReceipt='telegram-456-2-2',cached={status:'CLOSE_COMPLETED',packageId:pkg,revision:40,recovery:true,replayed:true,receiptId:originalReceipt,result:{status:'PREVIEW_EXISTS',preview:{packageId:pkg,revision:40,previewHash:'b'.repeat(64)}}};
let prepared=execute(prepareCode,cached,resolved);check(prepared.preview_body.receiptId===originalReceipt,'ORIGINAL_RECORDED_RECEIPT');check(prepared.preview_body.revision===40,'NO_NEW_REVISION');cases.push('lost_response_replay');
const uncertain={...cached,result:{status:'PREVIEW_DELIVERY_UNCERTAIN',retryPermitted:false}};prepared=execute(prepareCode,uncertain,resolved);check(prepared.preview_requested!==true&&prepared.seal_requested===false,'UNCERTAINTY_CLOSED');const notice=execute(confirmCode,prepared.passthrough,resolved);check(notice.reply_text.includes('No se repitió el envío'),'UNCERTAIN_NOTICE');cases.push('uncertain_not_resent');
for(const patch of [{packageId:'tg_'+'c'.repeat(40)},{receiptId:'telegram-123-2-2'},{revision:41},{recovery:false},{status:'UNKNOWN'}]){const rejected=execute(prepareCode,{...cached,...patch},resolved);check(rejected.passthrough?.status==='CLOSE_NOT_CONFIRMED'&&rejected.preview_requested!==true,'FOREIGN_OR_UNCONFIRMED_CLOSED')}
cases.push('scope_negatives');
for(const replayed of [false,true]){const bad=execute(prepareCode,{...cached,replayed,receiptId:'telegram-456-99-99'},resolved);check(bad.passthrough?.status==='CLOSE_NOT_CONFIRMED'&&bad.preview_requested!==true,'CROSSED_RECEIPT_REJECTED')}
cases.push('same_actor_crossed_receipt');
const quota=${JSON.stringify(quota)};prepared=execute(prepareCode,{status:'QUOTA_EXCEEDED',quotaDiagnostic:quota},resolved);check(prepared.passthrough.quotaDiagnostic.code==='RECOVERY_ITEMS_LIMIT','QUOTA_PRESERVED');const quotaReply=execute(confirmCode,prepared.passthrough,resolved).reply_text;check(quotaReply.includes('39/39'),'SPECIFIC_SEAL_QUOTA_NOTICE');check(!quotaReply.includes('No pude confirmar el cierre'),'SEAL_QUOTA_NOT_MASKED');cases.push('quota_reason');
prepared=execute(prepareCode,{status:'NOT_READY',pending:2},resolved);check(prepared.passthrough.pending===2&&!prepared.preview_requested,'PENDING_FILES_BLOCK');cases.push('pending_files');
return [{json:{status:'ISSUE18_ATOMIC_CLOSE_QA_PASSED',cases:cases.length,assertions,casesPassed:cases,syntheticFixturesOnly:true,externalIoCalls:0,cmsWrites:0,telegramMessages:0,packageWrites:0}}];`;
}
