import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {observePackageStorageResponse as observe,packageOpeningDiagnostic as diagnose,packageOpeningDiagnosticJson as json,resolveObservedPackageSession as resolve} from './package-opening-observation.mjs';
import {buildPackageOpeningDiagnosticOperations as build,patchPackageOpeningResolver,patchPackageOpeningReceipt,packageOpeningNodes as names} from './build-package-opening-diagnostic-operations.mjs';

const packageId='tg_'+'a'.repeat(40),other='tg_'+'b'.repeat(40);
const intent={package_operation:'OPEN',kind:'COMMAND',message_id:10,chat_id:'101',user_id:'101',receipt_id:'telegram-101-10-20',mode:'PACKAGE_STORAGE',has_file:false};
const original=readFileSync(new URL('./resolve-candidate.js',import.meta.url),'utf8');
const patched=patchPackageOpeningResolver(original);
const envelope=body=>({statusCode:200,headers:{authorization:'DO_NOT_KEEP'},body});
function evaluate(source,input,context){return new Function('$input','$',source)({first:()=>({json:input})},name=>({first:()=>{assert.equal(name,'Preparar paquete Telegram');return {json:context}}}))[0].json;}
const run=(raw,context=intent)=>evaluate(patched,raw,context);
const base=(raw,context=intent)=>evaluate(original,raw,context);
const diagnostic=result=>JSON.parse(result.storage_diagnostic);

for(const body of [{status:'OPEN',packageId,revision:1},{status:'ALREADY_OPEN',packageId},{status:'OPEN_REPLAY',packageId,state:'OPEN'}])test('confirms real opening contract '+body.status,()=>{
 const result=run(envelope(body));const {storage_diagnostic,...rest}=result;
 assert.deepEqual(rest,base(body));assert.equal(result.packageId,packageId);assert.equal(result.package_state,'OPEN');assert.equal(diagnostic(result).operation,'OPEN');assert.equal(diagnostic(result).httpStatus,200);
 assert.equal(result.routing_owner_confirmed,body.status!=='ALREADY_OPEN');
});
for(const state of ['READY','CANCELLED'])test('old '+state+' replay cannot announce opening, append policy or become routing owner',()=>{
 const result=run(envelope({status:'OPEN_REPLAY',packageId,state}));
 assert.equal(result.package_state,state);assert.equal(result.default_policy_candidate,false);assert.equal(result.routing_owner_confirmed,false);assert.equal(result.requires_operation,false);assert.equal(result.requires_storage,false);assert.equal(result.next_action,undefined);assert.match(result.reply_text,/paquete cerrado/);assert.doesNotMatch(result.reply_text,/Paquete abierto:|PUBLICARÁ/);assert.equal(diagnostic(result).code,'OPEN_CLOSED_REPLAY');
});
test('quota failure is explicit without altering quota, sessions or existing materials',()=>{
 const result=run(envelope({status:'QUOTA_EXCEEDED',original:'DO_NOT_KEEP'}));assert.equal(diagnostic(result).code,'OPEN_QUOTA_EXCEEDED');assert.match(result.reply_text,/límite de paquetes/);assert.equal(result.packageId,undefined);assert.equal(result.default_policy_candidate,false);assert.equal(result.requires_operation,false);assert.doesNotMatch(JSON.stringify(result),/DO_NOT_KEEP/);
});
for(const [statusCode,code] of [[400,'OPEN_INVALID_REQUEST'],[401,'OPEN_AUTH_DENIED'],[403,'OPEN_AUTH_DENIED'],[429,'OPEN_RATE_LIMITED'],[500,'OPEN_HTTP_UNCONFIRMED'],[503,'OPEN_HTTP_UNCONFIRMED'],[302,'OPEN_HTTP_UNCONFIRMED']])test('HTTP '+statusCode+' cannot impersonate a successful open',()=>{
 const result=run({statusCode,headers:{secret:'DO_NOT_KEEP'},body:{status:'OPEN',packageId,revision:1,source:'DO_NOT_KEEP'}});
 assert.equal(diagnostic(result).code,code);assert.equal(result.packageId,undefined);assert.equal(result.routing_owner_confirmed,false);assert.equal(result.default_policy_candidate,false);assert.doesNotMatch(JSON.stringify(result),/DO_NOT_KEEP/);
});
for(const error of [{error:{code:'ETIMEDOUT',message:'DO_NOT_KEEP'}},{error:{code:'ESOCKETTIMEDOUT',message:'DO_NOT_KEEP'}},{code:'ECONNABORTED',message:'DO_NOT_KEEP'}])test('structured timeout remains unconfirmed '+JSON.stringify(error.code??error.error.code),()=>{
 const result=run(error);assert.equal(diagnostic(result).code,'OPEN_TIMEOUT');assert.equal(diagnostic(result).httpStatus,null);assert.equal(result.packageId,undefined);assert.equal(result.default_policy_candidate,false);assert.doesNotMatch(JSON.stringify(result),/DO_NOT_KEEP/);
});
test('exception text is not parsed, copied or treated as authoritative diagnosis',()=>{
 for(const raw of [{error:'ETIMEDOUT https://private.invalid/?token=DO_NOT_KEEP'},{error:{message:'ETIMEDOUT DO_NOT_KEEP'}},null,{status:'OPEN',packageId,revision:1}]){
  const result=run(raw);assert.equal(diagnostic(result).code,'OPEN_TRANSPORT_UNCONFIRMED');assert.equal(result.packageId,undefined);assert.doesNotMatch(JSON.stringify(result),/DO_NOT_KEEP/);
 }
});
test('malformed success contracts stay closed before policy or owner registration',()=>{
 for(const body of [null,[],{},'OPEN',{status:'OPEN',packageId},{status:'OPEN',packageId,revision:0},{status:'OPEN',packageId:other+'x',revision:1},{status:'OPEN',packageId,revision:1,state:'CANCELLED'},{status:'OPEN_REPLAY',packageId},{status:'OPEN_REPLAY',packageId,state:'unexpected'},{status:'ALREADY_OPEN',packageId,state:'CANCELLED'}]){
  const result=run(envelope(body));assert.equal(diagnostic(result).code,'OPEN_RESPONSE_INVALID');assert.equal(result.packageId,undefined);assert.equal(result.default_policy_candidate,false);assert.equal(result.requires_operation,false);
 }
});
test('the shared HTTP envelope leaves all successful non-OPEN paths unchanged',()=>{
 const cases=[
  [{package_operation:'REOPEN',storage_body:{packageId}},{status:'OPEN_REPLAY',packageId,revision:4}],
  [{package_operation:'BLOCKED_LIST'},{status:'BLOCKED_LIST',packages:[],more:false}],
  [{package_operation:'STATUS'},{status:'OPEN',packageId,revision:4}],
  [{package_operation:'CONTENT',kind:'TEXT',text:'Original article',mode_attested:false},{status:'OPEN',packageId,revision:4}],
  [{package_operation:'CONTENT',kind:'TEXT',text:'/literal',content_mode_command:'/literal',mode_attested:true},{status:'OPEN',packageId,revision:4}],
  [{package_operation:'SEAL'},{status:'OPEN',packageId,revision:4}],
  [{package_operation:'SELECT',selection_action:'CREATE',selection_mode:'LITERAL',selection_destination:'TODOS',mode_attested:true},{status:'OPEN',packageId,revision:4,recovery:true}],
  [{package_operation:'CONFIRM',confirmation_action:'CREATE',confirmation_revision:4,confirmation_hash:'c'.repeat(64),mode_attested:true},{status:'OPEN',packageId,revision:4,recovery:true}],
 ];
 for(const [extra,body] of cases){const context={...intent,...extra};const result=run(envelope(body),context);assert.deepEqual(result,base(body,context));assert.equal(result.storage_diagnostic,undefined);}
});
test('shared HTTP failure never consumes a success-looking body for other operations',()=>{
 const context={...intent,package_operation:'CONTENT',kind:'TEXT',text:'Original article',mode_attested:false};
 const result=run({statusCode:503,body:{status:'OPEN',packageId,revision:4}},context);assert.equal(result.requires_operation,false);assert.equal(result.next_action,undefined);assert.equal(result.storage_diagnostic,undefined);
});
test('diagnostic serialization rejects added fields, raw errors and forged codes',()=>{
 const valid={operation:'OPEN',httpStatus:200,code:'OPEN_CONFIRMED'};assert.equal(json(valid),JSON.stringify(valid));
 for(const invalid of [{...valid,token:'DO_NOT_KEEP'},{...valid,code:'DO_NOT_KEEP'},{...valid,operation:'STATUS'},{...valid,httpStatus:'200'},{...valid,httpStatus:600},[],null])assert.equal(json(invalid),null);
});

const receiptSource="const input=$('Resolver paquete Telegram').first().json;const out={status:'RECEIPT_CONFIRMED',mode:input.mode,kind:input.kind,work_event_sent:null};return [{json:out}];";
function receipt(input){return new Function('$',patchPackageOpeningReceipt(receiptSource))(()=>({first:()=>({json:input})}))[0].json;}
test('receipt keeps Telegram ACK and storage diagnostic as independent facts',()=>{
 const result=run(envelope({status:'QUOTA_EXCEEDED'}));const stored=receipt(result);assert.equal(stored.status,'RECEIPT_CONFIRMED');assert.equal(stored.mode,'PACKAGE_STORAGE');assert.equal(JSON.parse(stored.storage_diagnostic).code,'OPEN_QUOTA_EXCEEDED');
});
test('only a valid bounded OPEN diagnostic reaches existing receipt table',()=>{
 for(const input of [{...intent,storage_diagnostic:'DO_NOT_KEEP'},{...intent,storage_diagnostic:JSON.stringify({operation:'OPEN',httpStatus:200,code:'OPEN_CONFIRMED',token:'DO_NOT_KEEP'})},{...intent,storage_diagnostic:'x'.repeat(193)},{...intent,package_operation:'STATUS',storage_diagnostic:json({operation:'OPEN',httpStatus:200,code:'OPEN_CONFIRMED'})}])assert.equal(receipt(input).storage_diagnostic,null);
});

function fixture(){return {nodes:[
 {name:names.http,type:'n8n-nodes-base.httpRequest',credentials:{httpHeaderAuth:{id:'QA-existing'}},retryOnFail:false,onError:'continueRegularOutput',parameters:{method:'POST',url:'={{ existing_url }}',options:{timeout:30000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json'}}}}},
 {name:names.resolve,type:'n8n-nodes-base.code',parameters:{mode:'runOnceForAllItems',jsCode:original}},
 {name:names.result,type:'n8n-nodes-base.code',parameters:{jsCode:receiptSource}},
 {name:names.record,type:'n8n-nodes-base.dataTable',parameters:{operation:'upsert',dataTableId:{value:'QA-existing-table'},filters:{conditions:[{keyName:'receipt_id'}]},columns:{mappingMode:'defineBelow',value:{status:'={{ $json.status }}'},schema:[{id:'status',type:'string'}]}}},
 ...Array.from({length:48},(_,i)=>({name:'Other '+i,type:'n8n-nodes-base.noOp',parameters:{}})),
 ],connections:{[names.http]:{main:[[{node:names.resolve,type:'main',index:0}]]}}};}
test('builder changes only four existing parameters; graph, credentials, retries, timeout and ACK mapping stay intact',()=>{
 const graph=fixture(),before=structuredClone(graph),ops=build(graph);assert.deepEqual(graph,before);assert.equal(ops.length,4);assert.ok(ops.every(x=>x.type==='updateNodeParameters'));assert.deepEqual(ops.map(x=>x.nodeName),Object.values(names));
 const http=ops[0].parameters;assert.equal(http.url,before.nodes[0].parameters.url);assert.equal(http.options.timeout,30000);assert.equal(http.options.redirect.redirect.followRedirects,false);assert.deepEqual(http.options.response.response,{responseFormat:'json',fullResponse:true,neverError:true});
 const record=ops[3].parameters;assert.deepEqual(record.dataTableId,before.nodes[3].parameters.dataTableId);assert.deepEqual(record.filters,before.nodes[3].parameters.filters);assert.equal(record.columns.value.status,'={{ $json.status }}');assert.equal(record.columns.value.storage_diagnostic,'={{ $json.storage_diagnostic ?? null }}');assert.equal(record.columns.schema.at(-1).id,'storage_diagnostic');
});
test('builder fails before mutation for divergent/already-patched graphs or missing anchors',()=>{
 for(const mutate of [g=>g.nodes.pop(),g=>g.nodes[0].parameters.options.timeout=60000,g=>g.nodes[0].parameters.options.response.response.fullResponse=true,g=>g.nodes[0].retryOnFail=true,g=>g.nodes[1].parameters.jsCode='return []',g=>g.nodes[2].parameters.jsCode='return []',g=>g.nodes[3].parameters.columns.schema.push({id:'storage_diagnostic',type:'string'})]){const graph=fixture();mutate(graph);assert.throws(()=>build(graph));}
 assert.throws(()=>patchPackageOpeningResolver(patched));assert.throws(()=>patchPackageOpeningReceipt(patchPackageOpeningReceipt(receiptSource)));
});
