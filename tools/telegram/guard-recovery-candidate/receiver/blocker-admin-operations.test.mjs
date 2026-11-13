import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fixture from './fixtures/blocker-admin-baseline.mjs';
import {blockerAdminBase,buildBlockerAdminOperations,normalizeBlockerAdminTrackingRows,renderBlockerAdminBatch,boundedBlockerAdminPrefix} from './build-blocker-admin-operations.mjs';
import {formatBlockerDiagnosticStage,renderBlockerDiagnostic} from '../../blocker-diagnostic.mjs';
import {preparePublicationReconciliations} from '../publication-alert-persistence.mjs';
import {buildBlockerAdminCodeQa} from './build-blocker-admin-code-qa.mjs';

const now=Date.parse('2026-11-13T04:00:00.000Z'),occurred='2026-11-13T03:59:30.000Z',pkg='tg_'+'a'.repeat(40),request='tg_'+'b'.repeat(64);
const stage=(code,itemOrdinal=0)=>formatBlockerDiagnosticStage(code.startsWith('PUBLISHER_')?'DRAFT_UNCERTAIN':'MEDIA_FAILED',{version:1,code,itemOrdinal});
const row=(options={})=>({id:100,package_id:pkg,revision:8,stage:stage('IMAGE_CREDIT_REQUIRED',2),occurred_at:occurred,...options});
const candidate=(i=0,options={})=>({package_id:'tg_'+(i+1).toString(16).padStart(40,'0'),revision:8,stage:'ALERT_ADMIN_'+(100+i),sourceStage:'MEDIA_FAILED',sourceOccurredAt:occurred,sourceRequestId:request,alreadyAlerted:false,occurred_at:occurred,summary:'BLOQUEO: No se pudo preparar la imagen',origin:'Otra cuenta',blockerDiagnostic:{version:1,code:'IMAGE_CREDIT_REQUIRED',itemOrdinal:2},...options});
const clone=()=>structuredClone(fixture);
class TestDate extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
const run=(source,items)=>new Function('$input','Date',source)({all:()=>items.map(json=>({json}))},TestDate);
const operations=()=>buildBlockerAdminOperations(clone(),blockerAdminBase(fixture));
const prepared=rows=>run(operations()[0].parameters.jsCode,rows);
const selected=context=>run(operations()[1].parameters.jsCode,[context]);
const queue=options=>({id:1,package_id:pkg,revision:8,stage:'QUEUED',chat_id:'123',occurred_at:'2026-11-13T03:59:00.000Z',...options});
const binding={id:2,package_id:pkg,revision:8,stage:'REQUEST_TODOS',request_id:request};
const proof={schema:'opmx.telegram.final-publication-observation.v1',status:'FINAL_PUBLICATION_CONFIRMED',packageId:pkg,revision:8,requestId:request,phase:'PUBLISH',destination:'TODOS',slug:'qa-existing-note',receiptHash:'c'.repeat(64),receiptState:'RECORDED',writeAuthorized:false,retryPermitted:false,writersIdleVerified:true,consistentSnapshot:true,observedAt:'2026-11-13T03:59:59.000Z',targets:['OPURO','OPOL','LIBERAL'].map((destination,i)=>({destination,postId:i+70,slug:'qa-existing-note',status:'publish',cmsVerified:true,ledgerVerified:true}))};

test('only two Code parameters change; previous reconciliation graph and sender remain untouched',()=>{
 const graph=clone(),before=structuredClone(graph),ops=buildBlockerAdminOperations(graph,blockerAdminBase(graph));
 assert.deepEqual(graph,before);assert.equal(ops.length,2);assert(ops.every(o=>o.type==='updateNodeParameters'&&o.replace===true));
 for(let i=0;i<2;i++){
  const old=graph.nodes.find(n=>n.name===ops[i].nodeName).parameters.jsCode,next=ops[i].parameters.jsCode;
  const start='const persistence=(()=>{',end='\n})();';const capture=s=>s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start))+end.length);
  assert.equal(capture(next),capture(old),'publication reconciliation source stays exact');
 }
});
test('builder fails closed after version, source, target type or duplicate-install drift',()=>{
 const base=blockerAdminBase(fixture);
 for(const change of[g=>g.versionId='other',g=>g.nodes.find(n=>n.name==='Seleccionar alertas de administrador').parameters.jsCode+=' ',g=>g.nodes.find(n=>n.name==='Preparar comprobación de alertas').type='other']){const g=clone();change(g);assert.throws(()=>buildBlockerAdminOperations(g,base));}
 const g=clone();for(const o of operations())g.nodes.find(n=>n.name===o.nodeName).parameters=o.parameters;assert.throws(()=>buildBlockerAdminOperations(g,blockerAdminBase(g)),/ALREADY_INSTALLED/);
});
test('normalize carrier before base failure, observation and dedup selection',()=>{
 const inputs=[queue(),binding,row()],before=structuredClone(inputs),[out]=prepared(inputs),b=out.json;
 assert.deepEqual(inputs,before);assert.equal(b.candidates[0].sourceStage,'MEDIA_FAILED');assert.equal(b.candidates[0].stage,'ALERT_ADMIN_100');assert.equal(b.candidates[0].sourceOccurredAt,occurred);assert.equal(b.candidates[0].blockerDiagnostic.code,'IMAGE_CREDIT_REQUIRED');assert.equal(b.candidates[0].blockerDiagnostic.itemOrdinal,2);assert.equal(b.needsObservation,false);assert.equal(b.requestRows[0].request_id,request);
});
test('operator and administrator share cause, field and action with no request JSON or source contents',()=>{
 const [p]=prepared([queue(),binding,row()]),[out]=selected(p.json);const same=renderBlockerDiagnostic({reason:'MEDIA_FAILED',diagnostic:{version:1,code:'IMAGE_CREDIT_REQUIRED',itemOrdinal:2},packageId:pkg,revision:8});
 assert(out.json.text.includes(same.cause));assert(out.json.text.includes(same.field));assert(out.json.text.includes(same.action));assert.match(out.json.text,/Elemento 2/);assert(!out.json.text.includes(request));assert(!JSON.stringify(out.json.alerts).includes('request'));assert.equal(out.json.alerts[0].stage,'ALERT_ADMIN_100');
});
test('legacy MEDIA_FAILED stays nonspecific and does not claim missing credit or generated IA',()=>{
 const [p]=prepared([queue(),row({stage:'MEDIA_FAILED'})]),[out]=selected(p.json);
 assert.match(out.json.text,/no guardó una causa más específica/);assert.doesNotMatch(out.json.text,/Falta un crédito|confirmada como generada|IMAGE_CREDIT_REQUIRED/);assert.doesNotMatch(out.json.text,/Hay resultados de Publisher/);
});
test('unsolicited diagnostic objects on an old stage do not gain authority',()=>{
 const input=row({stage:'MEDIA_FAILED',blockerDiagnostic:{version:1,code:'IMAGE_CREDIT_REQUIRED',itemOrdinal:2}}),normal=normalizeBlockerAdminTrackingRows([input]);
 assert(!Object.hasOwn(normal[0],'blockerDiagnostic'));const [p]=prepared([queue(),input]),[out]=selected(p.json);assert.match(out.json.text,/no guardó una causa más específica/);
});
for(const bad of['DIAG','DIAG|MEDIA_FAILED|IMAGE_CREDIT_REQUIRED|41','DIAG|MEDIA_FAILED|IMAGE_CREDIT_REQUIRED|01','DIAG|DRAFT_UNCERTAIN|IMAGE_CREDIT_REQUIRED|1','DIAG|MEDIA_FAILED|PRIVATE_EXCEPTION_SECRET|0','DIAG|MEDIA_FAILED|IMAGE_CREDIT_REQUIRED|1|raw-secret'])test('malformed carrier stays visible with fixed fallback and never leaks '+bad.slice(0,32),()=>{
 const [p]=prepared([queue(),row({stage:bad,exception:'PRIVATE_EXCEPTION_SECRET',source:'DO_NOT_SEND'})]),b=p.json;assert.equal(b.candidates[0].sourceStage,'INTERNAL_ERROR');assert.equal(b.needsObservation,false);const [out]=selected(b);assert.match(out.json.text,/diagnóstico específico válido/);assert.doesNotMatch(out.json.text,/PRIVATE_EXCEPTION_SECRET|DO_NOT_SEND|DIAG\|/);assert.equal(out.json.alerts[0].stage,'ALERT_ADMIN_100');
});
test('twenty known diagnostics produce a complete prefix within 3800 units and ACK only that prefix',()=>{
 const inputs=Array.from({length:20},(_,i)=>candidate(i)),before=structuredClone(inputs),[out]=renderBlockerAdminBatch('123',inputs);const n=out.json.alerts.length;
 assert.deepEqual(inputs,before);assert(n>0&&n<20);assert(out.json.text.length<=3800);assert.equal((out.json.text.match(/Qué hacer:/g)||[]).length,n);assert.equal((out.json.text.match(/Código:/g)||[]).length,n);assert.deepEqual(out.json.alerts.map(x=>x.stage),inputs.slice(0,n).map(x=>x.stage));assert(!out.json.text.includes(inputs[n].package_id));assert(out.json.text.endsWith('Código: IMAGE_CREDIT_REQUIRED'));assert.deepEqual(Object.keys(out.json.alerts[0]).sort(),['occurred_at','package_id','revision','stage']);
});
test('overflow alerts are selected on the next poll after ACKs for only the delivered prefix',()=>{
 const inputs=[];for(let i=0;i<20;i++){const p='tg_'+(i+1).toString(16).padStart(40,'0');inputs.push(queue({package_id:p,id:i*3+1}),row({id:100+i,package_id:p}));}
 const [first]=prepared(inputs),[sent]=selected(first.json),acked=sent.json.alerts.map((a,i)=>({...a,id:1000+i})),[next]=prepared([...inputs,...acked]);
 assert(next.json.candidates.length>0);assert.equal(next.json.candidates[0].stage,'ALERT_ADMIN_'+(100+acked.length));assert(next.json.candidates.every(c=>!sent.json.alerts.some(a=>a.package_id===c.package_id)));
});
test('Unicode, HTML entity expansion and long complete alerts use JavaScript units',()=>{
 const long='📰 ÁÉÍÓÚ &amp; &lt;foto&gt; '.repeat(40),rendered=Array.from({length:20},(_,i)=>({text:(i+1)+'. '+long+'FIN',uncertain:false,candidate:i}));
 const out=boundedBlockerAdminPrefix(rendered);assert(out.chosen.length>0&&out.chosen.length<20);assert(out.text.length<=3800);assert(out.text.endsWith('FIN'));assert.equal((out.text.match(/FIN/g)||[]).length,out.chosen.length);assert.equal(out.chosen[0].candidate,0);
});
test('uncertainty footer is based only on the delivered prefix, never an excluded candidate',()=>{
 const text='Texto completo. '.repeat(100),a={text,uncertain:false},u={text,uncertain:true};
 const without=boundedBlockerAdminPrefix([a,a,u]);assert.equal(without.chosen.length,2);assert.doesNotMatch(without.text,/Hay resultados de Publisher/);
 const withUncertainty=boundedBlockerAdminPrefix([u,a,a]);assert.equal(withUncertainty.chosen.length,2);assert.match(withUncertainty.text,/Hay resultados de Publisher/);
});
test('new uncertain carrier remains observable after original alert ACK without sending it again',()=>{
 const [p]=prepared([queue(),binding,row({stage:stage('PUBLISHER_RESULT_UNCERTAIN')}),{id:200,package_id:pkg,revision:8,stage:'ALERT_ADMIN_100',occurred_at:occurred}]);
 assert.equal(p.json.needsObservation,true);assert.equal(p.json.candidates[0].sourceStage,'DRAFT_UNCERTAIN');assert.equal(p.json.candidates[0].alreadyAlerted,true);assert.deepEqual(selected(p.json),[]);
});
test('only exact durable final publication suppresses a new uncertainty; semantic media remains visible',()=>{
 const [p]=prepared([queue(),binding,row({stage:stage('PUBLISHER_RESULT_UNCERTAIN')})]),b=p.json;
 const records=preparePublicationReconciliations(b.candidates,[proof],{requestRows:b.requestRows,nowMs:now});assert.equal(records.length,1);const ack={...records[0],id:400};assert.deepEqual(selected({...b,persistedReconciliations:[ack]}),[]);
 const [media]=prepared([queue(),binding,row()]),[visible]=selected({...media.json,persistedReconciliations:[ack]});assert.equal(visible.json.alerts.length,1);assert.match(visible.json.text,/Falta un crédito/);assert.doesNotMatch(visible.json.text,/Hay resultados de Publisher/);
});
test('partial, DRAFT or wrong-request observations cannot silence the new uncertainty',()=>{
 const [p]=prepared([queue(),binding,row({stage:stage('PUBLISHER_RESULT_UNCERTAIN')})]),b=p.json;
 for(const observation of[{...proof,phase:'DRAFT'},{...proof,targets:proof.targets.slice(0,2)},{...proof,requestId:'tg_'+'d'.repeat(64)}]){assert.deepEqual(preparePublicationReconciliations(b.candidates,[observation],{requestRows:b.requestRows,nowMs:now}),[]);assert.equal(selected({...b,persistedReconciliations:[]})[0].json.alerts.length,1);}
});
test('a legacy delay retains its kind and does not claim an editorial failure or publication',()=>{
 const [p]=prepared([queue({occurred_at:'2026-11-13T03:40:00.000Z'}),row({stage:'PROGRESS_IMAGE',occurred_at:'2026-11-13T03:40:30.000Z'})]),[out]=selected(p.json);assert.match(out.json.text,/1\. DEMORA:/);assert.match(out.json.text,/Una demora por sí sola no confirma/);assert.doesNotMatch(out.json.text,/1\. BLOQUEO:|Hay resultados de Publisher/);
});
test('real Code QA embeds exact patched sources and passes without network or prototype adaptations',()=>{
 const code=buildBlockerAdminCodeQa(clone(),blockerAdminBase(fixture));
 for(const o of operations())assert(code.includes(o.parameters.jsCode));
 assert(code.includes(fixture.nodes.find(n=>n.name==='Preparar conciliaciones confirmadas').parameters.jsCode));
 const result=new vm.Script('(function(){\n'+code+'\n})()').runInNewContext({},{timeout:10000})[0].json;
 assert.equal(result.status,'BLOCKER_ADMIN_REAL_CODE_QA_PASSED');assert.equal(result.cases,17);assert.equal(result.checks,52);assert.equal(result.networkCalls,0);assert.equal(result.telegramMessages,0);assert.equal(result.prototypeAdaptations,0);assert.equal(result.changedCodeBodies,2);assert.equal(result.unchangedReconciliationBody,1);
});
