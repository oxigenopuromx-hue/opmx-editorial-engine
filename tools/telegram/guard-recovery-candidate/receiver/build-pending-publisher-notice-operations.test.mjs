import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {pendingPublisherNoticeHeading as heading} from '../pending-publisher-notice.mjs';
import {buildPendingPublisherNoticeOperations as build,patchPendingPublisherHeadingCode as patch,pendingPublisherNoticeNodes as names} from './build-pending-publisher-notice-operations.mjs';

// Synthetic QA fixtures only; no network, Telegram send, CMS or attempt claim.
const messages={PROGRESS_START:'Synthetic progress.',PROGRESS_TEST:'Synthetic test.',PROCESS_COMPLETE:'Synthetic result.',SOURCE_UNAVAILABLE:'Synthetic missing source.',CONTENT_INSUFFICIENT:'Synthetic clarification.',MEDIA_FAILED:'Synthetic image failure.',VALIDATION_FAILED:'Synthetic editorial rejection.',DRAFT_FAILED:'Synthetic Publisher rejection.',DRAFT_UNCERTAIN:'Synthetic uncertain result.',INTERNAL_ERROR:'Synthetic error.'};
const base=String.raw`const MESSAGES=MESSAGES_FIXTURE;
function prepareTelegramFailure(request,manifest){
 if(manifest?.status!=='FOUND'||manifest.packageId!==request?.body?.packageId||manifest.state!=='READY'||Number(manifest.revision)!==request.body.revision)return {send:false,request};
 const b=request.body,msg=MESSAGES[b.reason];if(!msg)return {send:false,request};
 return {send:true,chatId:b.chat,text:\`OPMX · \${b.reason.startsWith('PROGRESS_')?'avance':b.reason==='PROCESS_COMPLETE'?'resultado':'proceso detenido'}\n\n\${msg}\n\nPaquete: \${b.packageId}, versión \${b.revision}.\`,request};
}
return prepareTelegramFailure(request,manifest);`.replaceAll('\\`','`').replaceAll('\\${','${');
const fixed=base.replace("${b.reason.startsWith('PROGRESS_')?'avance':b.reason==='PROCESS_COMPLETE'?'resultado':'proceso detenido'}",'proceso detenido');
const graph={nodes:names.map((name,i)=>({name,type:'n8n-nodes-base.code',parameters:{mode:'runOnceForAllItems',jsCode:i===3?fixed:base}}))};
const request=reason=>({id:'synthetic-qa',body:{chat:'12345',packageId:'tg_'+'a'.repeat(40),revision:8,reason}});
const manifest={status:'FOUND',packageId:'tg_'+'a'.repeat(40),revision:8,state:'READY'};
const run=(code,reason,extra={})=>vm.runInNewContext('(function(){'+code+'})()',{MESSAGES_FIXTURE:messages,request:request(reason),manifest,...extra});
const plain=x=>JSON.parse(JSON.stringify(x));

test('uncertainty gets a pending heading, not a stopped-process assertion',()=>{
 for(const reason of ['DRAFT_UNCERTAIN','PUBLISH_UNCERTAIN'])assert.equal(heading(reason),'resultado pendiente de confirmación');
 assert.equal(heading('SOURCE_UNAVAILABLE'),'proceso detenido');assert.equal(heading('PROGRESS_START','avance'),'avance');assert.equal(heading('PROCESS_COMPLETE','resultado'),'resultado');
});
test('builder changes four code copies only and preserves the supplied graph',()=>{
 const before=plain(graph),ops=build(graph);assert.equal(ops.length,4);assert.deepEqual(graph,before);
 assert.equal(ops.every(o=>o.type==='updateNodeParameters'&&o.replace===false&&Object.keys(o.parameters).join(',')==='jsCode'),true);
 for(const o of ops)new vm.Script('(function(){'+o.parameters.jsCode+'})()');
});
test('draft uncertainty changes only the heading; body, identity and request stay exact',()=>{
 for(const node of graph.nodes){const old=run(node.parameters.jsCode,'DRAFT_UNCERTAIN'),next=run(patch(node.parameters.jsCode),'DRAFT_UNCERTAIN');
  assert.equal(next.text,old.text.replace('OPMX · proceso detenido','OPMX · resultado pendiente de confirmación'));
  assert.equal(next.text.includes('\n\n'),true);assert.equal(next.text.includes('\\n'),false);
  assert.deepEqual(plain({...next,text:old.text}),plain(old));
 }
});
for(const reason of Object.keys(messages).filter(x=>x!=='DRAFT_UNCERTAIN'))test(reason+' keeps the exact previous message and behavior',()=>{
 for(const n of graph.nodes)assert.deepEqual(plain(run(patch(n.parameters.jsCode),reason)),plain(run(n.parameters.jsCode,reason)));
});
test('unsupported publish reason does not acquire permission to send',()=>{
 for(const n of graph.nodes)assert.deepEqual(plain(run(patch(n.parameters.jsCode),'PUBLISH_UNCERTAIN')),plain(run(n.parameters.jsCode,'PUBLISH_UNCERTAIN')));
});
test('if a configured protocol already permits PUBLISH_UNCERTAIN, only its heading changes',()=>{
 const configured={...messages,PUBLISH_UNCERTAIN:'Synthetic publication response pending.'};
 for(const n of graph.nodes){const old=run(n.parameters.jsCode,'PUBLISH_UNCERTAIN',{MESSAGES_FIXTURE:configured}),next=run(patch(n.parameters.jsCode),'PUBLISH_UNCERTAIN',{MESSAGES_FIXTURE:configured});assert.equal(next.text,old.text.replace('OPMX · proceso detenido','OPMX · resultado pendiente de confirmación'));}
});
test('stale or unavailable manifests still prevent sending',()=>{
 for(const m of [{...manifest,revision:9},{...manifest,state:'OPEN'},{...manifest,status:'NOT_FOUND'}])for(const n of graph.nodes)assert.equal(run(patch(n.parameters.jsCode),'DRAFT_UNCERTAIN',{manifest:m}).send,false);
});
test('unknown text, changed source or duplicate helpers are rejected without edits',()=>{
 assert.throws(()=>patch('return []'));
 assert.throws(()=>patch(base+base));assert.throws(()=>patch(patch(base)));
 assert.throws(()=>build({nodes:graph.nodes.slice(1)}));
});
