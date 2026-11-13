import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {preparePublisherSubmission,finishPublisherSubmission,preparePublisherSubmissionReport,publicPublisherSubmissionResult} from '../publisher-submission-adapter.mjs';
import {buildPublisherSubmissionOperations as build,publisherSubmissionNames as n} from './build-publisher-submission-operations.mjs';
import {capturedMcpReaderCode} from './fixtures/mcp-files-reader-protocol.mjs';

const id='tg_'+'a'.repeat(40),requestId='tg_'+'b'.repeat(64),revision=8,fingerprint='c'.repeat(64),receipt='d'.repeat(64),submission='e'.repeat(64),identity={owner:'12345',chat:'12345'};
const request={id:'synthetic-qa',operation:'publicar_nota_opmx',request_id:requestId,destino:'TODOS',confirmar_publicacion:'PUBLICAR'};
const payload={request_id:requestId,CREAR_EN:'TODOS',PUBLICAR:false,master:{SEO:{SLUG:'qa-example'},CONTROL_EDITORIAL:{ESTADO:'LISTO'}},hero_file:{base64:'synthetic-hero'},featured_file:{base64:'synthetic-featured'}};
const prepare=()=>{const p=preparePublisherSubmission(request,payload,identity,'999');p.body.fingerprint=fingerprint;return p};
const ack=(status='SUBMISSION_RECORDED')=>({statusCode:200,body:{status,packageId:id,revision,requestId,phase:'PUBLISH',destination:'TODOS',slug:'qa-example',fingerprint,submissionHash:submission,retryPermitted:false,writeAuthorized:false}});
const result=()=>({schema:'opmx.publisher-submission-result.v1',status:'WRITER_RESULT_CONFIRMED',packageId:id,revision,requestId,phase:'PUBLISH',destination:'TODOS',slug:'qa-example',submissionHash:submission,telegramNotice:'SENT',currentCmsState:'NOT_CHECKED',publicVisibility:'NOT_CHECKED',historical:true,receiptHash:receipt,targets:['OPURO','OPOL','LIBERAL'].map((destination,i)=>({destination,postId:100+i,slug:'qa-example',status:'publish'})),retryPermitted:false,writeAuthorized:false});
const node=(name,type='n8n-nodes-base.code',parameters={jsCode:'return $input.all();'})=>({name,type,typeVersion:2,position:[0,0],parameters});
function graph(){return {nodes:[node('Entregar paquete sin enlaces'),node('Publisher protegido existente','n8n-nodes-base.executeWorkflow',{options:{waitForSubWorkflow:true}}),node('Responder MCP','n8n-nodes-base.respondToWebhook',{respondWith:'json',responseBody:'={{ $json.response }}',options:{responseCode:'={{ $json.httpStatus }}',enableStreaming:false}}),node('Formatear fuente privada MCP','n8n-nodes-base.code',{jsCode:capturedMcpReaderCode}),{...node('Gestionar intento Motor guard','n8n-nodes-base.httpRequest',{}),credentials:{httpHeaderAuth:{id:'qa-existing',name:'Existing QA guard'}}},node('Synchronous result'),node('Background result')],connections:{'Entregar paquete sin enlaces':{main:[[{node:'Publisher protegido existente',type:'main',index:0}]]},'Synchronous result':{main:[[{node:'Responder MCP',type:'main',index:0}]]},'Background result':{main:[[{node:'Responder MCP',type:'main',index:0}]]}}};}
const code=(ops,name)=>ops.find(x=>x.type==='addNode'&&x.node.name===name)?.node.parameters.jsCode??ops.find(x=>x.type==='updateNodeParameters'&&x.nodeName===name)?.parameters.jsCode;
const plain=x=>JSON.parse(JSON.stringify(x));
async function run(code,json,lookup={}){const $=name=>{if(!Object.hasOwn(lookup,name))throw Error('not executed');return {first:()=>({json:lookup[name]})}};return await vm.runInNewContext('(async function(){'+code+'})()',{Buffer,$,$input:{first:()=>({json}),all:()=>[{json}]},$json:json,$execution:{id:'999'}});}

test('only canonical Telegram deliveries use early acceptance; manual delivery remains synchronous',()=>{
 const x=preparePublisherSubmission({...request,request_id:'manual_0123456789'},payload,null,'999');assert.equal(x.submissionRequired,false);assert.equal(x.payload,payload);
 const p=prepare();assert.equal(p.body.phase,'PUBLISH');assert.equal(p.body.executionId,'999');assert.equal(p.payload,payload);
 const draft=preparePublisherSubmission({...request,operation:'preparar_borrador_opmx'},payload,identity,'999');assert.equal(draft.body.phase,'DRAFT');
});
for(const [name,patch] of Object.entries({identity:{identity:null},wrongChat:{identity:{owner:'12345',chat:'99999'}},wrongPayload:{payload:{...payload,request_id:'tg_'+'f'.repeat(64)}},wrongDestination:{payload:{...payload,CREAR_EN:'OPOL'}},wrongOperation:{request:{...request,operation:'validar_archivos_opmx'}},noAuthorization:{request:{...request,confirmar_publicacion:null}},wrongExecution:{execution:'not-an-execution'}}))test('acceptance preparation rejects '+name,()=>assert.throws(()=>preparePublisherSubmission(patch.request??request,patch.payload??payload,Object.hasOwn(patch,'identity')?patch.identity:identity,patch.execution??'999')));
test('a verified new durable acceptance responds pending and permits exactly its original continuation',()=>{
 const x=finishPublisherSubmission(prepare(),ack(),request);assert.equal(x.continueWriter,true);assert.equal(x.submissionAccepted,true);assert.equal(x.response.response.result.structuredContent.status,'PUBLISH_SUBMITTED');assert.equal(x.response.response.result.structuredContent.result_pending,true);assert.equal(x.response.response.result.structuredContent.retryPermitted,false);assert.equal(x.response.response.result.structuredContent.writeAuthorized,false);assert.equal('targets' in x.response.response.result.structuredContent,false);
 assert.equal(JSON.stringify(x.response).includes('synthetic-hero'),false);assert.equal(JSON.stringify(x.response).includes('12345'),false);
});
test('a durable replay is acknowledged without running the writer',()=>{const x=finishPublisherSubmission(prepare(),ack('SUBMISSION_REPLAY'),request);assert.equal(x.submissionAccepted,true);assert.equal(x.continueWriter,false)});
test('only an explicit verified historical compatibility decision preserves synchronous delivery',()=>{
 const r=ack('SUBMISSION_SYNC_REQUIRED');r.body.legacyHistorical=true;delete r.body.submissionHash;
 const x=finishPublisherSubmission(prepare(),r,request);assert.equal(x.submissionAccepted,false);assert.equal(x.earlyResponse,false);assert.equal(x.synchronousLegacy,true);assert.equal(x.continueWriter,true);assert.equal(x.response,undefined);
 for(const patch of [{statusCode:503},{body:{...r.body,legacyHistorical:false}},{error:'timeout'}]){const y=finishPublisherSubmission(prepare(),{...r,...patch},request);assert.equal(y.continueWriter,false);assert.equal(y.earlyResponse,true)}
});
for(const [name,patch] of Object.entries({HTTP503:{statusCode:503},wrongRequest:{body:{requestId:'tg_'+'0'.repeat(64)}},wrongPhase:{body:{phase:'DRAFT'}},wrongDestination:{body:{destination:'OPOL'}},wrongSlug:{body:{slug:'other'}},wrongFingerprint:{body:{fingerprint:'0'.repeat(64)}},noHash:{body:{submissionHash:null}},notDurable:{body:{status:'PENDING'}},retryAllowed:{body:{retryPermitted:true}},writePermission:{body:{writeAuthorized:true}},transport:{error:'timeout'}}))test('unconfirmed acceptance never continues: '+name,()=>{
 const r=ack();Object.assign(r,patch);if(patch.body)r.body={...ack().body,...patch.body};const x=finishPublisherSubmission(prepare(),r,request);assert.equal(x.submissionAccepted,false);assert.equal(x.continueWriter,false);assert.equal(x.response.response.result.structuredContent.status,'SUBMISSION_UNCONFIRMED');
});
test('final reporting preserves exact request/execution/fingerprint and records the right notice only',()=>{
 const ctx=finishPublisherSubmission(prepare(),ack(),request),response={httpStatus:200,response:{result:{structuredContent:{status:'SUCCESS',telegram_publication_notice:'SENT',telegram_draft_notice:'UNCERTAIN'}}}};
 assert.deepEqual(preparePublisherSubmissionReport(response,ctx).body,{requestId,executionId:'999',fingerprint,outcome:'SUCCESS',telegramNotice:'SENT'});
 assert.equal(preparePublisherSubmissionReport(response,null).reportRequired,false);assert.equal(preparePublisherSubmissionReport(response,finishPublisherSubmission(prepare(),ack('SUBMISSION_REPLAY'),request)).reportRequired,false);
});
test('historical receipt is bounded and does not claim current CMS, visibility, URLs or renewed permission',()=>{
 const r=publicPublisherSubmissionResult(result(),id,revision);assert.equal(r.status,'WRITER_RESULT_CONFIRMED');assert.equal(r.phase,'PUBLISH');assert.equal(r.historical,true);assert.equal(r.current_cms_state,'NOT_CHECKED');assert.equal(r.public_visibility,'NOT_CHECKED');assert.equal(r.telegram_notice,'SENT');assert.equal(r.receipt_hash,receipt);assert.equal(JSON.stringify(r).includes('https:'),false);assert.equal(r.retryPermitted,false);assert.equal(r.write_authorized,false);
});
for(const [name,patch] of Object.entries({wrongPackage:{packageId:'tg_'+'f'.repeat(40)},wrongRevision:{revision:9},noReceipt:{receiptHash:null},nonHistorical:{historical:false},wrongPhaseTargets:{phase:'DRAFT'},wrongIds:{targets:[]},currentClaim:{currentCmsState:'publish'},retry:{retryPermitted:true},write:{writeAuthorized:true},wrongTarget:{targets:[{destination:'OPURO',postId:0}]}}))test('reader rejects malformed historical result: '+name,()=>assert.equal(publicPublisherSubmissionResult({...result(),...patch},id,revision).status,'SUBMISSION_UNCONFIRMED'));
test('pending and uncertain results never acquire confirmed receipt or target fields',()=>{
 for(const status of ['SUBMISSION_PENDING','SUBMISSION_UNCERTAIN']){const r=publicPublisherSubmissionResult({...result(),status},id,revision);assert.equal(r.status,status);assert.equal('receipt_hash' in r,false);assert.equal('targets' in r,false)}
});
test('builder keeps the original writer and guard identity, inserting one acceptance before it',()=>{
 const g=graph(),before=structuredClone(g),ops=build(g);assert.deepEqual(g,before);assert.equal(ops.filter(x=>x.type==='addNode').length,14);assert.equal(ops.some(x=>x.type==='updateNodeParameters'&&x.nodeName==='Publisher protegido existente'),false);
 for(const x of ops.filter(x=>x.type==='addNode'&&x.node.type==='n8n-nodes-base.httpRequest')){assert.deepEqual(x.node.credentials,g.nodes.find(x=>x.name==='Gestionar intento Motor guard').credentials);assert.equal(x.node.parameters.options.timeout,30000);assert.equal(x.node.parameters.options.redirect.redirect.followRedirects,false)}
 assert.equal(ops.filter(x=>x.type==='setNodeSettings').every(x=>x.settings.retryOnFail===false),true);assert.equal(ops.some(x=>x.type==='addNode'&&/telegram|executeWorkflow/.test(x.node.type)),false);
 for(const x of ops.filter(x=>x.type==='addNode'&&x.node.type==='n8n-nodes-base.code'))new vm.Script('(async function(){'+x.node.parameters.jsCode+'})');
});
test('early responder is followed by continuation and replay has no continuation edge',()=>{
 const ops=build(graph());assert.equal(ops.some(x=>x.type==='addConnection'&&x.source===n.respond&&x.target===n.continue),true);assert.equal(ops.some(x=>x.type==='addConnection'&&x.source===n.continue&&x.sourceIndex===1),false);
 assert.equal(ops.some(x=>x.type==='addConnection'&&x.source===n.verify&&x.target===n.early),true);assert.equal(ops.some(x=>x.type==='addConnection'&&x.source===n.early&&x.sourceIndex===1&&x.target===n.payload),true);
 assert.equal(ops.filter(x=>x.type==='removeConnection'&&x.target==='Responder MCP').length,2);assert.equal(ops.some(x=>x.type==='addConnection'&&x.source===n.reportHttp&&x.target===n.done),true);
});
test('actual reader formatter retains existing inventory and adds the verified historical result',async()=>{
 const ops=build(graph()),json={status:'FOUND',packageId:id,revision,state:'READY',items:[],publisherResult:result()},lookup={'Protocolo MCP archivos':{request:{id:'qa',action:'manifest',body:{packageId:id}}}};
 const old=(await run(capturedMcpReaderCode,json,lookup))[0].json.response.result.structuredContent;
 const next=plain((await run(code(ops,'Formatear fuente privada MCP'),json,lookup))[0].json.response.result.structuredContent);
 const {publisher_result,...inventory}=next;assert.deepEqual(inventory,plain(old));assert.equal(publisher_result.status,'WRITER_RESULT_CONFIRMED');assert.equal(publisher_result.receipt_hash,receipt);
});
test('actual reader still refuses foreign manifests before exposing any historical result',async()=>{
 const ops=build(graph()),json={status:'FOUND',packageId:'tg_'+'f'.repeat(40),revision,state:'READY',items:[],publisherResult:result()},lookup={'Protocolo MCP archivos':{request:{id:'qa',action:'manifest',body:{packageId:id}}}};
 const next=(await run(code(ops,'Formatear fuente privada MCP'),json,lookup))[0].json.response.result.structuredContent;assert.equal(next.status,'SOURCE_NOT_CONFIRMED');assert.equal('publisher_result' in next,false);
});
test('embedded final adapter preserves synchronous results and writes no final response for accepted background work',async()=>{
 const ops=build(graph()),response={httpStatus:200,response:{result:{structuredContent:{status:'SUCCESS',telegram_publication_notice:'SENT'}}}};
 const sync=(await run(code(ops,n.report),response))[0].json;assert.equal(sync.reportRequired,false);assert.deepEqual(plain(sync.response),response);
 const async=(await run(code(ops,n.report),response,{[n.verify]:finishPublisherSubmission(prepare(),ack(),request)}))[0].json;assert.equal(async.reportRequired,true);assert.equal(async.body.telegramNotice,'SENT');assert.deepEqual(plain(await run(code(ops,n.done),{})),[]);
});
test('changed graph, duplicate installation or unrecognized reader fail before operations',()=>{
 const g=graph();g.connections['Entregar paquete sin enlaces'].main[0]=[];assert.throws(()=>build(g));const h=graph();h.nodes.push(node(n.begin));assert.throws(()=>build(h));const j=graph();j.nodes.find(x=>x.name==='Formatear fuente privada MCP').parameters.jsCode='return []';assert.throws(()=>build(j));
});
