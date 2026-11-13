import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import fixture from './fixtures/issue18-receiver-db33.mjs';
import {buildIssue18AtomicCloseReceiverOperations as build,prepareAtomicPackageClose as prepare} from './build-issue18-atomic-close-operations.mjs';
import {buildIssue18AtomicCloseQaCode} from './build-issue18-atomic-close-qa.mjs';
const graph=()=>{const used=new Set(fixture.nodes.map(n=>n.name)),remaining=fixture.nodeGroups.flatMap(g=>g.nodeNames).filter(n=>!used.has(n));return {...structuredClone(fixture),nodes:[...structuredClone(fixture.nodes),...Array.from({length:48},(_,i)=>({name:remaining[i]??'Unchanged '+i,type:'n8n-nodes-base.code',typeVersion:2,parameters:{jsCode:'return []'}}))]}};
const pkg='tg_'+'a'.repeat(40),receipt='telegram-456-3-3',context={seal_after_close:true,recovery_session:true,packageId:pkg,package_revision:39,user_id:'456',chat_id:'456',message_id:3,receipt_id:receipt};
const preview={packageId:pkg,revision:40,previewHash:'b'.repeat(64)},response=()=>({status:'CLOSE_COMPLETED',packageId:pkg,revision:40,recovery:true,replayed:false,receiptId:receipt,result:{status:'PREVIEW_READY',preview}});
function execute(source,value,lookup){return new vm.Script('(function(){'+source+'})()').runInNewContext({$input:{first:()=>({json:value})},$:name=>({first:()=>({json:lookup(name)})})})}
test('current live Receiver contracts generate one atomic /listo request and keep 52 nodes',()=>{
 const ops=build(graph()),resolver=ops.find(o=>o.nodeName==='Resolver paquete Telegram').parameters.jsCode;
 const intent={package_operation:'SEAL',kind:'COMMAND',text:'/listo',user_id:'456',chat_id:'456',message_id:3,receipt_id:receipt};
 const actual=execute(resolver,{statusCode:200,body:{status:'OPEN',packageId:pkg,revision:39,recovery:true}},()=>intent)[0].json;
 assert.equal(actual.next_url,'https://publisher.oxigenopuro.com.mx/v1/telegram/packages/close');assert.equal(actual.next_action,'close');assert.equal(actual.next_body.receiptId,receipt);assert.equal(actual.next_body.kind,'TEXT');assert(actual.next_body.text.includes('/listo'));assert.equal(actual.seal_after_close,true);
 assert.equal(ops.filter(o=>o.type==='addNode').length,1);assert.equal(ops.filter(o=>o.type==='removeNode').length,1);assert.equal(ops.find(o=>o.type==='addNode').node.type,'n8n-nodes-base.code');assert.equal(ops.some(o=>o.type==='setNodeCredential'),false);
 assert.deepEqual(ops.find(o=>o.type==='setNodeGroups').nodeGroups,fixture.nodeGroups);
});
test('ordinary closure consumes the atomic READY without a second sealing HTTP call',()=>{
 const c={...context,recovery_session:false},r={...response(),recovery:false,result:{status:'READY',packageId:pkg,revision:40}};
 assert.deepEqual(prepare(c,r),{seal_requested:false,passthrough:r.result});
});
test('recovery forwards its existing preview identity and original recorded receipt without a second Guard POST',()=>{
 const r=response(),out=prepare(context,r);assert.equal(out.preview_requested,true);assert.equal(out.seal_requested,false);assert.deepEqual(out.preview_response,r.result);assert.equal(out.preview_body.receiptId,receipt);
 const ops=build(graph()),code=ops.find(o=>o.type==='addNode').node.parameters.jsCode;assert.deepEqual(JSON.parse(JSON.stringify(execute(code,out,()=>null)[0].json)),r.result);assert(!/https?:|fetch\(|helpers\./.test(code));
});
test('pending files and specific quota diagnostics survive the atomic adapter',()=>{
 for(const r of [{status:'NOT_READY',pending:2},{status:'QUOTA_EXCEEDED',quotaDiagnostic:{code:'PACKAGE_ITEMS_LIMIT'}}])assert.deepEqual(prepare(context,r),{seal_requested:false,passthrough:r});
});
test('uncertain dispatch remains closed and cannot become a new delivery request',()=>{
 const r={...response(),replayed:true,result:{status:'PREVIEW_DELIVERY_UNCERTAIN',retryPermitted:false}},out=prepare(context,r);assert.equal(out.preview_requested,undefined);assert.equal(out.seal_requested,false);assert.equal(out.passthrough.status,'PREVIEW_DELIVERY_UNCERTAIN');
});
for(const [name,patch]of Object.entries({foreignPackage:{packageId:'tg_'+'c'.repeat(40)},foreignActor:{receiptId:'telegram-123-3-3'},futureSameActorReceipt:{receiptId:'telegram-456-99-99'},futureReplayReceipt:{replayed:true,receiptId:'telegram-456-99-99'},wrongRevision:{revision:41},modeMismatch:{recovery:false},missingReplay:{replayed:undefined},unknown:{status:'UNKNOWN'}}))test('atomic adapter rejects '+name,()=>{assert.equal(prepare(context,{...response(),...patch}).passthrough.status,'CLOSE_NOT_CONFIRMED')});
test('the actual SEAL formatter displays quota details before its generic early return',()=>{
 const code=build(graph()).find(o=>o.nodeName==='Confirmar operación de paquete Telegram').parameters.jsCode;
 const quota={schema:'opmx.package-quota-diagnostic.v1',operation:'RESERVE',code:'RECOVERY_ITEMS_LIMIT',limitsExceeded:[{code:'RECOVERY_ITEMS_LIMIT',scope:'PACKAGE_ITEMS',used:40,limit:40,requested:1}]};
 const out=execute(code,{status:'QUOTA_EXCEEDED',quotaDiagnostic:quota},()=>({...context,package_operation:'SEAL'}))[0].json;assert.match(out.reply_text,/40\/40/);assert(!out.reply_text.includes('No pude confirmar el cierre'));
});
test('builder refuses unexpected old-preview wiring instead of creating another route',()=>{
 const x=graph();x.connections['Solicitar vista de recuperación'].main[0][0].node='Other';assert.throws(()=>build(x));
});
test('isolated n8n QA executes the generated Code bodies without external I/O',()=>{
 const code=buildIssue18AtomicCloseQaCode(build(graph())),result=new vm.Script('(function(){'+code+'})()').runInNewContext()[0].json;
 assert.equal(result.status,'ISSUE18_ATOMIC_CLOSE_QA_PASSED');assert.equal(result.cases,8);assert.equal(result.assertions,30);assert.equal(result.externalIoCalls,0);assert.equal(result.cmsWrites,0);assert.equal(result.telegramMessages,0);assert(!/\b(?:eval|require|fetch)\s*\(|new Function/.test(code));
});
