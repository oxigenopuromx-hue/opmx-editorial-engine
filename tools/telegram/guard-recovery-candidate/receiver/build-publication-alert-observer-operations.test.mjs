import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildPublicationAlertObserverOperations as build,alertObserverNames as names} from './build-publication-alert-observer-operations.mjs';

// All identities, correlations and receipts below are isolated synthetic QA
// fixtures. This test never calls n8n, Guard, Telegram or WordPress.
const now=Date.parse('2026-11-12T17:00:00Z'),packageId='tg_'+'a'.repeat(40),other='tg_'+'b'.repeat(40),requestId='tg_'+'c'.repeat(64),slug='qa-note';
const fixtureCode=`const rows=$input.all().map(x=>x.json),notices=[];for(const last of rows){if(!['DRAFT_UNCERTAIN','SOURCE_UNAVAILABLE'].includes(last.stage)||rows.some(x=>x.stage==='ALERT_ADMIN_'+last.id&&x.package_id===last.package_id))continue;notices.push({package_id:last.package_id,revision:last.revision,stage:'ALERT_ADMIN_'+last.id,occurred_at:new Date().toISOString(),summary:last.stage,origin:'Synthetic account'});}const batch=notices.slice(0,20);if(!batch.length)return [];return [{json:{chat_id:'12345',text:'Synthetic',alerts:batch}}];`;
const graph={nodes:[{name:names.read,type:'n8n-nodes-base.dataTable',position:[224,0]},{name:names.select,type:'n8n-nodes-base.code',position:[448,0],parameters:{mode:'runOnceForAllItems',jsCode:fixtureCode}},{name:'Notificar administrador',type:'n8n-nodes-base.telegram'}],connections:{[names.read]:{main:[[{node:names.select,type:'main',index:0}]]},[names.select]:{main:[[{node:'Notificar administrador',type:'main',index:0}]]}}};
const credential={id:'qa-header-existing',name:'Synthetic existing Header Auth'};
const operations=build(graph,{credential});
const nodes=Object.fromEntries(operations.filter(x=>x.type==='addNode').map(x=>[x.node.name,x.node]));
const render=operations.find(x=>x.type==='updateNodeParameters').parameters.jsCode;
function evaluate(code,items,extra={}){class FakeDate extends Date{constructor(...x){super(...(x.length?x:[now]))}static now(){return now}}const input={all:()=>items,first:()=>items[0]};return vm.runInNewContext('(function(){'+code+'})()',{Date:FakeDate,$input:input,...extra});}
const run=(name,items,extra)=>evaluate(nodes[name].parameters.jsCode,items,extra);
const row=(p=packageId,id=10,stage='DRAFT_UNCERTAIN')=>({json:{id,package_id:p,revision:8,stage,occurred_at:'2026-11-12T16:59:30Z'}});
const binding=(p=packageId)=>({json:{id:5,package_id:p,revision:8,stage:'REQUEST_TODOS',request_id:requestId}});
const proof=(p=packageId)=>({schema:'opmx.telegram.final-publication-observation.v1',status:'FINAL_PUBLICATION_CONFIRMED',packageId:p,revision:8,requestId,phase:'PUBLISH',destination:'TODOS',slug,receiptState:'RECORDED',receiptHash:'d'.repeat(64),observedAt:'2026-11-12T16:59:59Z',writersIdleVerified:true,consistentSnapshot:true,writeAuthorized:false,retryPermitted:false,targets:['OPURO','OPOL','LIBERAL'].map((destination,i)=>({destination,postId:10+i,slug,status:'publish',cmsVerified:true,ledgerVerified:true}))});
const plain=x=>JSON.parse(JSON.stringify(x));
function attach(context,response){return run(names.attach,[],{$json:Object.hasOwn(response,'statusCode')?response:{statusCode:200,body:response},$:name=>{assert.equal(name,names.expand);return {item:{json:context}}}});}

test('adds five bounded nodes, no Merge or extra sender, preserving the original graph',()=>{
 const before=plain(graph);assert.deepEqual(build(graph,{credential}),operations);assert.deepEqual(graph,before);
 assert.equal(Object.keys(nodes).length,5);assert.equal(Object.values(nodes).some(n=>/merge|telegram|executeWorkflow/.test(n.type)),false);
 assert.equal(nodes[names.attach].parameters.mode,'runOnceForEachItem');assert.match(nodes[names.attach].parameters.jsCode,/\.item\.json/);assert.doesNotMatch(nodes[names.attach].parameters.jsCode,/\.first\(/);
 assert.deepEqual(operations.find(x=>x.type==='setNodeSettings').settings,{retryOnFail:false,onError:'continueRegularOutput'});
 const http=nodes[names.http];assert.equal(http.parameters.method,'POST');assert.equal(http.parameters.url,'https://publisher.oxigenopuro.com.mx/v1/telegram/publications/observe-final');assert.deepEqual(http.credentials,{httpHeaderAuth:credential});assert.equal(http.parameters.options.timeout,30000);assert.equal(http.parameters.options.redirect.redirect.followRedirects,false);assert.equal(http.parameters.options.response.response.fullResponse,true);assert.equal(http.parameters.options.batching.batch.batchSize,1);
 const body=vm.runInNewContext(http.parameters.jsonBody.slice(3,-3),{$json:{observe:{packageId,revision:8,requestId:'must-not-send'}}});assert.deepEqual(JSON.parse(body),{packageId,revision:8});
});
test('single batch routes only uncertain candidates through HTTP and retains other failures',()=>{
 const inputs=[row(),binding(),row(other,11,'SOURCE_UNAVAILABLE')];
 const prepared=run(names.prepare,inputs);assert.equal(prepared.length,1);assert.equal(prepared[0].json.needsObservation,true);assert.equal(prepared[0].json.candidates.length,2);
 const expanded=run(names.expand,prepared);assert.equal(expanded.length,1);assert.deepEqual(plain(expanded[0].json.observe),{packageId,revision:8});assert.deepEqual(plain(expanded[0].pairedItem),{item:0});
 const attached=attach(expanded[0].json,proof());const result=evaluate(render,[attached]);assert.equal(result.length,1);assert.equal(result[0].json.alerts.length,1);assert.equal(result[0].json.alerts[0].package_id,other);assert.equal(result[0].json.chat_id,'12345');assert.match(result[0].json.text,/1\. SOURCE_UNAVAILABLE/);assert.equal(result[0].json.alerts[0].sourceStage,undefined);assert.equal(result[0].json.text.includes('\n\n'),true);assert.equal(result[0].json.text.includes('\\n'),false);
});
test('all resolved candidates yield no Telegram batch',()=>{
 const prepared=run(names.prepare,[row(),binding()]),expanded=run(names.expand,prepared);
 assert.deepEqual(plain(evaluate(render,[attach(expanded[0].json,proof())])),[]);
});
test('no uncertain candidate bypasses HTTP with one complete batch',()=>{
 const prepared=run(names.prepare,[row(packageId,10,'SOURCE_UNAVAILABLE'),row(other,11,'SOURCE_UNAVAILABLE')]);
 assert.equal(prepared.length,1);assert.equal(prepared[0].json.needsObservation,false);assert.equal(run(names.expand,prepared).length,0);
 const result=evaluate(render,prepared);assert.equal(result.length,1);assert.equal(result[0].json.alerts.length,2);
});
test('empty or already alerted groups do not start observation or Telegram',()=>{
 assert.deepEqual(plain(run(names.prepare,[])),[]);
 assert.deepEqual(plain(run(names.prepare,[row(),row(packageId,12,'ALERT_ADMIN_10')])),[]);
});
for(const [name,response] of [['timeout',{error:'Timeout'}],['partial',{...proof(),status:'PARTIAL_SUCCESS'}],['DRAFT',{...proof(),phase:'DRAFT'}],['no receipt',{...proof(),receiptHash:undefined}],['HTTP503',{statusCode:503,body:{error:'not_confirmed'}}],['HTTP503 with misleading success body',{statusCode:503,body:proof()}]])test(name+' preserves the original uncertain alert',()=>{
 const prepared=run(names.prepare,[row(),binding()]),expanded=run(names.expand,prepared),result=evaluate(render,[attach(expanded[0].json,response)]);
 assert.equal(result.length,1);assert.equal(result[0].json.alerts.length,1);assert.equal(result[0].json.alerts[0].package_id,packageId);
});
test('mixed multiple HTTP responses stay paired and produce one batch',()=>{
 const prepared=run(names.prepare,[row(),binding(),row(other,11),binding(other)]),expanded=run(names.expand,prepared);assert.equal(expanded.length,2);
 const attached=expanded.map((x,i)=>attach(x.json,i===0?proof():{status:'RECONCILIATION_REQUIRED'})),result=evaluate(render,attached);
 assert.equal(result.length,1);assert.equal(result[0].json.alerts.length,1);assert.equal(result[0].json.alerts[0].package_id,other);
});
test('cross-assigned package proof and missing correlation never suppress',()=>{
 const prepared=run(names.prepare,[row()]),expanded=run(names.expand,prepared);assert.equal(evaluate(render,[attach(expanded[0].json,proof())])[0].json.alerts.length,1);
 assert.equal(evaluate(render,[attach(expanded[0].json,proof(other))])[0].json.alerts.length,1);
});
test('swapped HTTP responses are rejected against each paired request',()=>{
 const prepared=run(names.prepare,[row(),binding(),row(other,11),binding(other)]),expanded=run(names.expand,prepared);
 const attached=[attach(expanded[0].json,proof(other)),attach(expanded[1].json,proof())];
 assert.equal(attached.every(x=>x.json.observation===null),true);assert.equal(evaluate(render,attached)[0].json.alerts.length,2);
});
test('batch cap remains20 and a mixed batch never needs both branches',()=>{
 const inputs=Array.from({length:25},(_,i)=>row('tg_'+i.toString(16).padStart(40,'0'),i+20,i%2?'SOURCE_UNAVAILABLE':'DRAFT_UNCERTAIN'));
 const prepared=run(names.prepare,inputs);assert.equal(prepared.length,1);assert.equal(prepared[0].json.candidates.length,20);assert.equal(run(names.expand,prepared).length,10);
});
test('changed graph or selector shape is rejected before generating edits',()=>{
 assert.throws(()=>build({...graph,nodes:graph.nodes.filter(x=>x.name!==names.select)},{credential}));
 assert.throws(()=>build({...graph,connections:{}},{credential}));
 const changed=plain(graph);changed.nodes.find(x=>x.name===names.select).parameters.jsCode='return []';assert.throws(()=>build(changed,{credential}));
 assert.throws(()=>build(graph,{credential:{id:'',name:'none'}}));
});
