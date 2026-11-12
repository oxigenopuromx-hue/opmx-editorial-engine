import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildPublicationAlertPersistenceOperations as build,alertPersistenceNames as n} from './build-publication-alert-persistence-operations.mjs';
import {expectedDraftRequestId} from '../correlation-candidate.mjs';

// This is a self-contained synthetic monitor graph. No administrator IDs,
// credentials, real source text, Telegram or network writes enter these tests.
const now=Date.parse('2026-11-12T23:06:59.000Z'),packageId='tg_'+'a'.repeat(40),other='tg_'+'b'.repeat(40),requestId='tg_'+'c'.repeat(64),otherRequest='tg_'+'e'.repeat(64),revision=23,slug='qa-note';
const selector=`const now=Date.now(),rows=$input.all().map(x=>x.json),groups=new Map();for(const r of rows){const key=r.package_id+':'+r.revision;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}
const notices=[];
for(const entries of groups.values()){
 const stages=entries.filter(x=>x.stage!=='ROUTING'&&!String(x.stage).startsWith('REQUEST_')&&!String(x.stage).startsWith('ALERT_')).sort((a,b)=>a.id-b.id);
 const last=stages.at(-1);if(!last||last.stage==='PROCESS_COMPLETE'||entries.some(x=>x.stage==='ALERT_ADMIN_'+last.id))continue;
 if(!['DRAFT_UNCERTAIN','PUBLISH_UNCERTAIN','SOURCE_UNAVAILABLE','PROGRESS_SUBMIT'].includes(last.stage))continue;
 notices.push({package_id:last.package_id,revision:last.revision,stage:'ALERT_ADMIN_'+last.id,sourceStage:last.stage,sourceOccurredAt:last.occurred_at,occurred_at:new Date(now).toISOString(),summary:last.stage,origin:'Synthetic account'});
}
notices.sort((a,b)=>a.package_id.localeCompare(b.package_id)||a.revision-b.revision);const batch=notices.slice(0,20);if(!batch.length)return [];return [{json:{chat_id:'12345',text:'Synthetic',alerts:batch}}];`;
const oldPrepare='const requestRows=$input.all().map(x=>x.json);\nconst selected=(()=>{\n'+selector+'\n})();\nif(!Array.isArray(selected))throw Error();return selected;';
const table={__rl:true,mode:'id',value:'qa-existing-history'};
const graph={nodes:[{name:n.read,type:'n8n-nodes-base.dataTable',parameters:{dataTableId:table}},{name:n.prepare,type:'n8n-nodes-base.code',parameters:{jsCode:oldPrepare}},{name:n.condition,type:'n8n-nodes-base.if'},{name:n.attach,type:'n8n-nodes-base.code'},{name:n.select,type:'n8n-nodes-base.code',position:[1568,0],parameters:{jsCode:'return []'}},{name:'Registrar alertas confirmadas',type:'n8n-nodes-base.dataTable',parameters:{operation:'insert',dataTableId:table}},{name:'Notificar administrador',type:'n8n-nodes-base.telegram'}],connections:{[n.attach]:{main:[[{node:n.select,type:'main',index:0}]]},[n.condition]:{main:[[{node:'Expandir comprobaciones inciertas',type:'main',index:0}],[{node:n.select,type:'main',index:0}]]}}};
const operations=build(graph),newNodes=Object.fromEntries(operations.filter(o=>o.type==='addNode').map(o=>[o.node.name,o.node])),updated=Object.fromEntries(operations.filter(o=>o.type==='updateNodeParameters').map(o=>[o.nodeName,o.parameters.jsCode]));
const plain=x=>JSON.parse(JSON.stringify(x));
function evaluate(code,items,extra={}){class FakeDate extends Date{constructor(...x){super(...(x.length?x:[now]))}static now(){return now}}return vm.runInNewContext('(function(){'+code+'})()',{Date:FakeDate,$input:{all:()=>items,first:()=>items[0]},...extra});}
const run=(name,items,extra)=>evaluate(newNodes[name]?.parameters.jsCode??updated[name],items,extra);
const row=(p=packageId,id=10,stage='DRAFT_UNCERTAIN',rid=null,rev=revision)=>({json:{id,package_id:p,revision:rev,stage,request_id:rid,occurred_at:'2026-11-12T23:05:50.784Z'}});
const binding=(p=packageId,request=requestId,stage='REQUEST_TODOS',rev=revision)=>row(p,1,stage,request,rev);
const terminal=(p=packageId,request=requestId)=>({json:{...row(p,20,'PUBLICATION_RECONCILED',request).json,occurred_at:'2026-11-12T23:06:58.000Z'}});
const proof=(p=packageId)=>({schema:'opmx.telegram.final-publication-observation.v1',status:'FINAL_PUBLICATION_CONFIRMED',packageId:p,revision,requestId,phase:'PUBLISH',destination:'TODOS',slug,receiptHash:'d'.repeat(64),receiptState:'RECORDED',writeAuthorized:false,retryPermitted:false,writersIdleVerified:true,consistentSnapshot:true,observedAt:'2026-11-12T23:06:55.860Z',targets:['OPURO','OPOL','LIBERAL'].map((destination,i)=>({destination,postId:100+i,slug,status:'publish',cmsVerified:true,ledgerVerified:true}))});
function context(rows,observation){const prepared=run(n.prepare,rows);return prepared.map(x=>({json:{...x.json,observation}}));}
function acknowledge(expanded,index=0,override={}){const expected=expanded[index].json.reconciliation;return run(n.verify,[],{$json:{...expected,id:100+index,chat_id:null,...override},$:name=>{assert.equal(name,n.expand);return {item:{json:expanded[index].json}}}});}

test('upgrades only persistence/candidate paths using existing table, administrator and sender',()=>{
 const before=plain(graph);assert.deepEqual(build(graph),operations);assert.deepEqual(graph,before);assert.equal(Object.keys(newNodes).length,5);
 assert.equal(Object.values(newNodes).some(x=>/telegram|httpRequest|executeWorkflow/.test(x.type)),false);assert.deepEqual(newNodes[n.insert].parameters.dataTableId,table);assert.equal(newNodes[n.insert].parameters.options.optimizeBulk,false);assert.deepEqual(Object.keys(newNodes[n.insert].parameters.columns.value).sort(),['occurred_at','package_id','request_id','revision','stage']);assert.deepEqual(operations.find(x=>x.type==='setNodeSettings').settings,{retryOnFail:false,onError:'continueRegularOutput',alwaysOutputData:true});
 assert.equal(operations.some(o=>o.nodeName==='Notificar administrador'||o.source==='Revisar alertas cada cinco minutos'),false);
});
test('first confirmed publication is inserted and acknowledged before suppression; next Guard failure cannot revive it',()=>{
 const rows=[row(),binding()],batch=run(n.persistence,context(rows,proof()));assert.equal(batch.length,1);assert.equal(batch[0].json.needsPersistence,true);assert.equal(batch[0].json.reconciliationRecords.length,1);
 const expanded=run(n.expand,batch);assert.equal(expanded.length,1);assert.equal(expanded[0].json.reconciliation.stage,'PUBLICATION_RECONCILED');assert.deepEqual(plain(run(n.select,[acknowledge(expanded)])),[]);
 const stored={json:{...expanded[0].json.reconciliation,id:100,chat_id:null}};
 assert.deepEqual(plain(run(n.prepare,[...rows,stored])),[]);
});
test('lost/invalid INSERT acknowledgement retains the original alert even with a fresh Guard proof',()=>{
 const batch=run(n.persistence,context([row(),binding()],proof())),expanded=run(n.expand,batch);
 for(const bad of [{id:undefined},{request_id:otherRequest},{stage:'PROCESS_COMPLETE'},{error:'INSERT outcome unknown'},{revision:24}]){const result=run(n.select,[acknowledge(expanded,0,bad)]);assert.equal(result.length,1);assert.equal(result[0].json.alerts[0].stage,'ALERT_ADMIN_10');}
});
test('later read of an inserted row resolves a lost ACK idempotently',()=>{assert.deepEqual(plain(run(n.prepare,[row(),binding(),terminal(),{json:{...terminal().json,id:21}}])),[]);});
test('SOURCE_UNAVAILABLE remains alertable even if reconciliation is the latest row',()=>{
 const prepared=run(n.prepare,[row(packageId,10,'SOURCE_UNAVAILABLE'),binding(),terminal()]);assert.equal(prepared.length,1);assert.equal(prepared[0].json.needsObservation,false);const batch=run(n.persistence,prepared);assert.equal(batch[0].json.needsPersistence,false);const result=run(n.select,batch);assert.equal(result[0].json.alerts[0].summary,'SOURCE_UNAVAILABLE');
});
test('late progress is suppressed only for a matching publication request',()=>{
 assert.deepEqual(plain(run(n.prepare,[binding(),terminal(),row(packageId,30,'PROGRESS_SUBMIT',requestId)])),[]);
 const prepared=run(n.prepare,[binding(),binding(packageId,otherRequest,'REQUEST_OPURO'),terminal(),row(packageId,30,'PROGRESS_SUBMIT',otherRequest)]);assert.equal(prepared.length,1);assert.equal(prepared[0].json.candidates[0].sourceRequestId,otherRequest);
});
test('another request or revision cannot inherit the prior success',()=>{
 assert.equal(run(n.prepare,[row(packageId,30,'DRAFT_UNCERTAIN',otherRequest),binding(),binding(packageId,otherRequest,'REQUEST_OPURO'),terminal()]).length,1);
 assert.equal(run(n.prepare,[row(packageId,30,'DRAFT_UNCERTAIN',requestId,24),binding(packageId,requestId,'REQUEST_TODOS',24),terminal()]).length,1);
 assert.equal(run(n.prepare,[row(),binding(),binding(packageId,otherRequest,'REQUEST_OPURO'),terminal(),terminal(packageId,otherRequest)]).length,1);
});
test('real seven-binding layout persists and remembers the Guard-selected final request for null legacy rows',()=>{
 const labels=['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'];
 const receiverBindings=labels.map(destination=>binding(packageId,expectedDraftRequestId({packageId,revision,destination}),'REQUEST_'+destination));
 const selected=receiverBindings.at(-1).json.request_id,rows=[row(),...receiverBindings],final={...proof(),requestId:selected};
 const prepared=run(n.prepare,rows),batch=run(n.persistence,[{json:{...prepared[0].json,observation:final}}]);assert.equal(batch[0].json.reconciliationRecords.length,1);assert.equal(batch[0].json.reconciliationRecords[0].request_id,selected);
 const expanded=run(n.expand,batch);assert.deepEqual(plain(run(n.select,[acknowledge(expanded)])),[]);
 const stored={json:{...expanded[0].json.reconciliation,id:100}};assert.deepEqual(plain(run(n.prepare,[...rows,stored])),[]);
 assert.deepEqual(plain(run(n.prepare,[...rows,stored,row(packageId,30,'PROGRESS_SUBMIT',null)])),[]);
 const explicitOther=receiverBindings[0].json.request_id;assert.equal(run(n.prepare,[...receiverBindings,stored,row(packageId,30,'DRAFT_UNCERTAIN',explicitOther)]).length,1);
 assert.equal(run(n.prepare,[...rows,stored,{json:{...stored.json,id:101,request_id:explicitOther}}]).length,1);
});
test('already reconciled revisions do not starve a later real blocker beyond the twenty-row cap',()=>{
 const rows=[];for(let i=0;i<25;i++){const p='tg_'+i.toString(16).padStart(40,'0');rows.push(row(p,10),binding(p),terminal(p));}rows.push(row('tg_'+'f'.repeat(40),10,'SOURCE_UNAVAILABLE'));
 const prepared=run(n.prepare,rows);assert.equal(prepared.length,1);assert.equal(prepared[0].json.candidates.length,1);assert.equal(prepared[0].json.candidates[0].sourceStage,'SOURCE_UNAVAILABLE');
});
test('already sent uncertainty can later reconcile without sending another Telegram message',()=>{
 const rows=[row(),binding(),row(packageId,12,'ALERT_ADMIN_10')],prepared=run(n.prepare,rows);assert.equal(prepared.length,1);assert.equal(prepared[0].json.candidates[0].alreadyAlerted,true);
 const batch=run(n.persistence,[{json:{...prepared[0].json,observation:proof()}}]);assert.equal(batch[0].json.needsPersistence,true);const expanded=run(n.expand,batch);assert.deepEqual(plain(run(n.select,[acknowledge(expanded)])),[]);
});
test('already sent uncertainty stays deduplicated if a later observation or INSERT is unavailable',()=>{
 const rows=[row(),binding(),row(packageId,12,'ALERT_ADMIN_10')],prepared=run(n.prepare,rows);
 const unavailable=run(n.persistence,[{json:{...prepared[0].json,observation:{status:'FINAL_PUBLICATION_UNCONFIRMED'}}}]);assert.equal(unavailable[0].json.needsPersistence,false);assert.deepEqual(plain(run(n.select,unavailable)),[]);
 const confirmed=run(n.persistence,[{json:{...prepared[0].json,observation:proof()}}]),expanded=run(n.expand,confirmed);assert.deepEqual(plain(run(n.select,[acknowledge(expanded,0,{id:undefined})])),[]);
 assert.deepEqual(plain(run(n.prepare,[row(packageId,10,'SOURCE_UNAVAILABLE'),binding(),row(packageId,12,'ALERT_ADMIN_10')])),[]);
});
test('new real blockers precede already alerted uncertainty in the bounded batch',()=>{
 const rows=[];for(let i=0;i<25;i++){const p='tg_'+i.toString(16).padStart(40,'0');rows.push(row(p,10),binding(p),row(p,12,'ALERT_ADMIN_10'));}rows.push(row('tg_'+'f'.repeat(40),10,'SOURCE_UNAVAILABLE'));
 const prepared=run(n.prepare,rows);assert.equal(prepared[0].json.candidates.length,20);assert.equal(prepared[0].json.candidates[0].sourceStage,'SOURCE_UNAVAILABLE');assert.equal(prepared[0].json.candidates[0].alreadyAlerted,false);
});
test('all observation responses are regrouped and one mixed alert batch is rendered',()=>{
 const prepared=run(n.prepare,[row(),binding(),row(other,11),binding(other)]);const contexts=[{json:{...prepared[0].json,observation:proof()}},{json:{...prepared[0].json,observation:{status:'FINAL_PUBLICATION_UNCONFIRMED'}}}];
 const batch=run(n.persistence,contexts);assert.equal(batch.length,1);assert.equal(batch[0].json.reconciliationRecords.length,1);const expanded=run(n.expand,batch),result=run(n.select,[acknowledge(expanded)]);assert.equal(result.length,1);assert.equal(result[0].json.alerts.length,1);assert.equal(result[0].json.alerts[0].package_id,other);
});
test('multiple valid inserts keep correct paired scopes and a single render',()=>{
 const prepared=run(n.prepare,[row(),binding(),row(other,11),binding(other)]);const contexts=[{json:{...prepared[0].json,observation:proof()}},{json:{...prepared[0].json,observation:proof(other)}}];const batch=run(n.persistence,contexts),expanded=run(n.expand,batch);assert.equal(expanded.length,2);assert.deepEqual(plain(run(n.select,[acknowledge(expanded,0),acknowledge(expanded,1)])),[]);
 const mismatched=acknowledge(expanded,0,{package_id:other});assert.equal(run(n.select,[mismatched,acknowledge(expanded,1)])[0].json.alerts[0].package_id,packageId);
});
test('unavailable, partial and stale observations never create rows or claim persistence',()=>{for(const observation of [{status:'FINAL_PUBLICATION_UNCONFIRMED'},{...proof(),phase:'DRAFT'},{...proof(),receiptHash:null},{...proof(),observedAt:'2026-11-12T23:00:00.000Z'}]){const batch=run(n.persistence,context([row(),binding()],observation));assert.equal(batch[0].json.needsPersistence,false);assert.equal(run(n.select,batch)[0].json.alerts.length,1);}});
test('diverging batch context aborts before persisting or sending',()=>{const rows=[row(),binding()],a=context(rows,proof())[0],b={json:{...a.json,chatId:'99999'}};assert.throws(()=>run(n.persistence,[a,b]),/CONTEXT_MISMATCH/);});
test('changed or already installed graphs reject mutation generation',()=>{const changed=plain(graph);changed.connections[n.attach].main[0][0].node='other';assert.throws(()=>build(changed));assert.throws(()=>build({...graph,nodes:[...graph.nodes,newNodes[n.insert]]}));});
