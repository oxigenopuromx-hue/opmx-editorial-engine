import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import fixture from './fixtures/blocker-admin-baseline.mjs';
import {blockerAdminBase,buildBlockerAdminOperations} from './build-blocker-admin-operations.mjs';
import {task29AdminNames,task29CancellationAdminBase,buildTask29CancellationAdminOperations} from './task29-build-cancellation-admin-operations.mjs';
import {task29CancellationScope as scope,task29CancellationStage,task29CancellationProofConfirmed,task29CancellationWasReconciled,prepareTask29CancellationReconciliations,task29CancellationInsertConfirmed} from '../task29-delivery-cancellation-alert.mjs';
import {formatBlockerDiagnosticStage} from '../../blocker-diagnostic.mjs';
import {buildTask29CancellationAdminCodeQa} from './task29-build-cancellation-admin-code-qa.mjs';

const now=Date.parse('2026-11-13T04:00:00.000Z'),source='2026-11-12T01:00:41.397Z';
class TestDate extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}}
const candidate=(extra={})=>({package_id:scope.packageId,revision:scope.revision,sourceStage:'DRAFT_UNCERTAIN',sourceOccurredAt:source,sourceRequestId:null,stage:'ALERT_ADMIN_1637',occurred_at:'2026-11-13T04:00:00.000Z',origin:'Tu cuenta',alreadyAlerted:false,...extra});
const bindings=[{package_id:scope.packageId,revision:scope.revision,stage:'REQUEST_TODOS',request_id:scope.requestId}];
const proof=(extra={})=>({schema:'opmx.destination-cancellation.v1',status:'DELIVERY_CANCELLATION_CONFIRMED',...scope,operationId:scope.operationId,tombstoneHash:'a'.repeat(64),observedAt:'2026-11-13T03:59:59.000Z',cancellationObservedAt:'2026-11-13T03:59:00.000Z',currentCmsVerified:true,mixedOutcome:true,publicationComplete:false,writeAuthorized:false,reopenAuthorized:false,resumeAuthorized:false,retryPermitted:false,processTerminationClaimed:false,telegramAck:'NOT_CHECKED',publicVisibility:'NOT_CHECKED',writesFenced:true,noActiveN8nWriters:true,attemptState:'REVOKED',fenceState:'RECONCILING',results:[{destination:'OPURO',postId:10493,status:'PUBLISHED',wordpressStatus:'publish',slug:scope.slug,originalSlug:scope.slug},{destination:'OPOL',postId:3515,status:'PUBLISHED',wordpressStatus:'publish',slug:scope.slug,originalSlug:scope.slug},{destination:'LIBERAL',postId:393,status:'CANCELLED',wordpressStatus:'trash',slug:scope.slug+'__trashed',originalSlug:scope.slug}],...extra});
const options={requestRows:bindings,nowMs:now};
const graph=()=>{const g=structuredClone(fixture);for(const op of buildBlockerAdminOperations(g,blockerAdminBase(g)))g.nodes.find(n=>n.name===op.nodeName).parameters=op.parameters;const http=g.nodes.find(n=>n.name==='Comprobar publicación final Guard');http.parameters={method:'POST',url:'https://guard.example.test/webhook/opmx-final-publication-observation-v1',authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',jsonBody:'={{ JSON.stringify({packageId:$json.observe.packageId,revision:$json.observe.revision}) }}'};http.credentials={httpHeaderAuth:{id:'test-credential',name:'test credential'}};const helper=['publication-alert-resolution.mjs','publication-alert-persistence.mjs'].map(name=>readFileSync(new URL('../'+name,import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'')).join('\n');g.nodes.find(n=>n.name==='Verificar conciliación registrada').parameters={mode:'runOnceForEachItem',jsCode:'const persistence=(()=>{\n'+helper+'\nreturn {publicationReconciliationInsertConfirmed};\n})();\nconst context=$("Expandir conciliaciones verificadas").item.json,row=$json;\nconst confirmed=persistence.publicationReconciliationInsertConfirmed(context.reconciliation,row);\nreturn {json:{...context,persistedReconciliations:confirmed?[row]:[],persistenceConfirmed:confirmed}};'};return g};
const ops=()=>{const g=graph();return buildTask29CancellationAdminOperations(g,task29CancellationAdminBase(g))};
const code=name=>ops().find(o=>o.nodeName===name)?.parameters.jsCode;
const run=(name,items)=>new Function('$input','Date',code(name))({all:()=>items.map(json=>({json}))},TestDate);
const tracking=(stage='DRAFT_UNCERTAIN',extra=[])=>[{id:1,package_id:scope.packageId,revision:scope.revision,stage:'QUEUED',occurred_at:source,chat_id:'123'},...bindings.map((r,i)=>({...r,id:10+i})),{id:1637,package_id:scope.packageId,revision:scope.revision,stage,occurred_at:source},...extra];

test('exact mixed TRASH proof authorizes a cancellation record, never a publication record',()=>{
 const before=proof(),copy=structuredClone(before);assert.equal(task29CancellationProofConfirmed(candidate(),before,options),true);assert.deepEqual(before,copy);
 const records=prepareTask29CancellationReconciliations([candidate()],[before],options);assert.equal(records.length,1);assert.equal(task29CancellationStage(records[0].stage),'a'.repeat(64));assert.equal(records[0].request_id,scope.requestId);assert(!JSON.stringify(records).includes('PUBLICATION_RECONCILED'));assert(!JSON.stringify(records).includes('PROCESS_COMPLETE'));
});
test('actual DRAFT proof also works but a trash slug never masquerades as draft',()=>{
 const p=proof();p.results[2]={...p.results[2],wordpressStatus:'draft',slug:scope.slug};assert(task29CancellationProofConfirmed(candidate(),p,options));p.results[2].slug+='__trashed';assert(!task29CancellationProofConfirmed(candidate(),p,options));
});
test('no proof suppression before exact durable ACK and old uncertainty remains unchanged',()=>{
 const c=candidate(),before=structuredClone(c),[record]=prepareTask29CancellationReconciliations([c],[proof()],options);
 assert(!task29CancellationWasReconciled(c,[record],options));assert(!task29CancellationInsertConfirmed(record,{id:400}));assert(task29CancellationInsertConfirmed(record,{...record,id:400}));assert(task29CancellationWasReconciled(c,[{...record,id:400}],options));assert.deepEqual(c,before);
});
test('every returned ledger column is required for ACK; failure output never counts',()=>{
 const [record]=prepareTask29CancellationReconciliations([candidate()],[proof()],options);
 for(const changed of[{package_id:'tg_'+'e'.repeat(40)},{revision:11},{request_id:'tg_'+'e'.repeat(64)},{stage:'PUBLICATION_RECONCILED'},{occurred_at:'2026-11-13T03:59:59.000Z'},{id:0},{error:null}])assert(!task29CancellationInsertConfirmed(record,{...record,id:400,...changed}));
});
test('other packages, revisions, requests, semantic diagnostics and progress stay unresolved',()=>{
 const [record]=prepareTask29CancellationReconciliations([candidate()],[proof()],options),ack={...record,id:400};
 for(const change of[{package_id:'tg_'+'e'.repeat(40)},{revision:11},{sourceRequestId:'tg_'+'e'.repeat(64)},{sourceStage:'MEDIA_FAILED'},{sourceStage:'PROGRESS_SUBMIT'}]){assert(!task29CancellationProofConfirmed(candidate(change),proof(),options));assert(!task29CancellationWasReconciled(candidate(change),[ack],options));}
 assert(!task29CancellationProofConfirmed(candidate(),proof(),{...options,requestRows:[...bindings,...bindings]}));
});
test('malformed, stale, ambiguous, unfenced and nonmixed proofs fail closed',()=>{
 const variants=[{schema:'opmx.telegram.final-publication-observation.v1'},{status:'DELIVERY_CANCELLATION_UNCONFIRMED'},{destination:'TODOS'},{postId:394},{requestId:'tg_'+'b'.repeat(64)},{operationId:'short'},{tombstoneHash:'bad'},{currentCmsVerified:false},{mixedOutcome:false},{publicationComplete:true},{writeAuthorized:true},{reopenAuthorized:true},{resumeAuthorized:true},{retryPermitted:true},{processTerminationClaimed:true},{telegramAck:'CONFIRMED'},{publicVisibility:'CONFIRMED'},{writesFenced:false},{noActiveN8nWriters:false},{attemptState:'CLAIMED'},{fenceState:'IDLE'},{observedAt:'2026-11-13T03:55:00.000Z'},{observedAt:'2026-11-13T04:00:06.000Z'},{cancellationObservedAt:'2026-11-13T04:00:00.000Z'},{results:proof().results.slice(0,2)}];
 for(const change of variants)assert(!task29CancellationProofConfirmed(candidate(),proof(change),options),Object.keys(change).join(','));
 assert.deepEqual(prepareTask29CancellationReconciliations([candidate()],[proof(),proof()],options),[]);
});
test('three published, wrong post, reordered targets and mismatched historical slug cannot cancel',()=>{
 for(const mutate of[p=>p.results[2].status='PUBLISHED',p=>p.results[2].wordpressStatus='publish',p=>p.results[2].postId=394,p=>p.results[0].postId=10494,p=>p.results.reverse(),p=>p.results[2].originalSlug='other',p=>p.results[0].slug='other']){const p=proof();mutate(p);assert(!task29CancellationProofConfirmed(candidate(),p,options));}
});
test('conflicting durable tombstone hashes never outvote an existing identity',()=>{
 const [record]=prepareTask29CancellationReconciliations([candidate()],[proof()],options),a={...record,id:400},b={...record,id:401,stage:'DELIVERY_CANCELLED_RECONCILED|'+'b'.repeat(64)};
 assert(!task29CancellationWasReconciled(candidate(),[a,b],options));assert.deepEqual(prepareTask29CancellationReconciliations([candidate()],[proof()],{...options,reconciliationRows:[b]}),[]);
});
test('builder changes four Code bodies and adds two read nodes; no sender, table, claim or publication observer changes',()=>{
 const g=graph(),before=structuredClone(g),operations=buildTask29CancellationAdminOperations(g,task29CancellationAdminBase(g));assert.deepEqual(g,before);assert.equal(operations.length,10);assert.equal(operations.filter(o=>o.type==='updateNodeParameters').length,4);assert.equal(operations.filter(o=>o.type==='addNode').length,2);assert(operations.filter(o=>o.type==='addNode').every(o=>['n8n-nodes-base.httpRequest','n8n-nodes-base.code'].includes(o.node.type)));
 assert(!operations.some(o=>['Notificar administrador','Registrar alertas confirmadas','Registrar publicación conciliada','Comprobar publicación final Guard'].includes(o.nodeName)));
 const added=operations.find(o=>o.node?.type==='n8n-nodes-base.httpRequest').node;assert.equal(new URL(added.parameters.url).origin,'https://guard.example.test');assert.deepEqual(added.credentials,g.nodes.find(n=>n.name==='Comprobar publicación final Guard').credentials);assert.equal(added.parameters.jsonBody,g.nodes.find(n=>n.name==='Comprobar publicación final Guard').parameters.jsonBody);
 for(const op of operations.filter(o=>o.type==='updateNodeParameters')){const old=g.nodes.find(n=>n.name===op.nodeName).parameters.jsCode,start='const persistence=(()=>{',end='\n})();';const capture=s=>s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start))+end.length);assert.equal(capture(op.parameters.jsCode),capture(old),'original #30 resolver remains exact');}
});
test('rebase, cross-origin URL, unexpected graph and duplicate patches fail closed',()=>{
 const g=graph(),expected=task29CancellationAdminBase(g);g.nodes[0].name+='x';assert.throws(()=>buildTask29CancellationAdminOperations(g,expected),/REBASE/);
 for(const observerPath of['https://attacker.example/webhook/steal','//attacker.example/webhook/steal','/webhook/allowed?secret=x','/webhook/short']){const g=graph();assert.throws(()=>buildTask29CancellationAdminOperations(g,task29CancellationAdminBase(g),{observerPath}),/URL_INVALID/);}
});
test('real Code path keeps raw proof visible until ledger insert ACK then suppresses only exact uncertainty',()=>{
 const [prepared]=run(task29AdminNames.prepare,tracking()),context={...prepared.json,cancellationObservation:proof()};
 assert.equal(run(task29AdminNames.select,[context])[0].json.alerts.length,1);
 const [records]=run(task29AdminNames.prepareRecords,[context]);assert.equal(records.json.reconciliationRecords.length,1);const record=records.json.reconciliationRecords[0];assert.match(record.stage,/^DELIVERY_CANCELLED_RECONCILED\|/);
 const verify=new Function('$json','$','Date',code(task29AdminNames.verify));
 const original={...records.json,reconciliation:record};const failed=verify({id:400},()=>({item:{json:original}}),TestDate),ack=verify({...record,id:400},()=>({item:{json:original}}),TestDate);
 assert.equal(failed.json.persistenceConfirmed,false);assert.equal(run(task29AdminNames.select,[failed.json])[0].json.alerts.length,1);assert.equal(ack.json.persistenceConfirmed,true);assert.deepEqual(run(task29AdminNames.select,[ack.json]),[]);
 assert.deepEqual(run(task29AdminNames.prepare,tracking('DRAFT_UNCERTAIN',[{...record,id:400}])),[]);
 const [media]=run(task29AdminNames.prepare,tracking(formatBlockerDiagnosticStage('MEDIA_FAILED',{version:1,code:'IMAGE_CREDIT_REQUIRED',itemOrdinal:2}),[{...record,id:400}]));const [visible]=run(task29AdminNames.select,[media.json]);assert.match(visible.json.text,/Falta un crédito/);assert.equal(visible.json.alerts.length,1);
});
test('already-alerted uncertainty is still observed and reconciled without duplicate administrator message',()=>{
 const [prepared]=run(task29AdminNames.prepare,tracking('DRAFT_UNCERTAIN',[{id:1638,package_id:scope.packageId,revision:scope.revision,stage:'ALERT_ADMIN_1637',occurred_at:source}]));
 assert(prepared.json.needsObservation);assert(prepared.json.candidates[0].alreadyAlerted);const [records]=run(task29AdminNames.prepareRecords,[{...prepared.json,cancellationObservation:proof()}]);assert.equal(records.json.reconciliationRecords.length,1);assert.deepEqual(run(task29AdminNames.select,[records.json]),[]);
});
test('malformed cancellation marker is excluded from source selection but never suppresses uncertainty',()=>{
 const [prepared]=run(task29AdminNames.prepare,tracking('DRAFT_UNCERTAIN',[{id:4000,package_id:scope.packageId,revision:scope.revision,stage:'DELIVERY_CANCELLED_RECONCILED|invalid',occurred_at:'2026-11-13T03:59:59.000Z',request_id:scope.requestId}]));assert.equal(prepared.json.candidates[0].sourceStage,'DRAFT_UNCERTAIN');assert.equal(prepared.json.reconciliationRows.length,0);
});
test('real-Code QA runs exact patched bodies in a native VM with no I/O or prototype adaptations',()=>{
 const g=graph(),code=buildTask29CancellationAdminCodeQa(g,task29CancellationAdminBase(g));
 for(const op of buildTask29CancellationAdminOperations(g,task29CancellationAdminBase(g)).filter(o=>o.type==='updateNodeParameters'))assert(code.includes(op.parameters.jsCode));
 const result=new vm.Script('(function(){\n'+code+'\n})()').runInNewContext({},{timeout:10000})[0].json;
 assert.equal(result.status,'TASK29_ADMIN_REAL_CODE_QA_PASSED');assert(result.cases>=10);assert(result.checks>=40);assert.equal(result.changedCodeBodies,4);assert.equal(result.newCodeBodies,1);assert.equal(result.networkCalls,0);assert.equal(result.tableWrites,0);assert.equal(result.telegramMessages,0);assert.equal(result.prototypeAdaptations,0);
});
