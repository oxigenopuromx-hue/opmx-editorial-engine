import {createHash} from 'node:crypto';
import {buildBlockerAdminOperations,boundedBlockerAdminPrefix} from './build-blocker-admin-operations.mjs';
import {renderBlockerDiagnostic} from '../../blocker-diagnostic.mjs';

// Two changed Code bodies plus the unchanged #30 reconciliation body, copied
// exactly into function literals. Only Date is a local deterministic clock.
// No eval, require, prototype adaptations, network, database or Telegram calls.
export function buildBlockerAdminCodeQa(graph,expected){
 const ops=buildBlockerAdminOperations(graph,expected),codes=Object.fromEntries(ops.map(o=>[o.nodeName,o.parameters.jsCode]));
 const reconciliation=graph.nodes.filter(n=>n.name==='Preparar conciliaciones confirmadas');
 if(reconciliation.length!==1||reconciliation[0].type!=='n8n-nodes-base.code'||typeof reconciliation[0].parameters?.jsCode!=='string')throw Error('BLOCKER_ADMIN_QA_RECONCILIATION_CHANGED');
 codes['Preparar conciliaciones confirmadas']=reconciliation[0].parameters.jsCode;
 const hashes=Object.fromEntries(Object.entries(codes).map(([k,v])=>[k,createHash('sha256').update(v).digest('hex')]));
 const wrap=(name,label)=>`function ${label}(items){const $input={all:()=>items.map(json=>({json}))};const Date=QaDate;\n${codes[name]}\n}\n`;
 const credit=renderBlockerDiagnostic({reason:'MEDIA_FAILED',diagnostic:{version:1,code:'IMAGE_CREDIT_REQUIRED',itemOrdinal:2},packageId:'tg_'+'a'.repeat(40),revision:8});
 return '// Zero-I/O QA. Synthetic rows/proof only; sources are the actual three monitor Code bodies.\n'+
 wrap(ops[0].nodeName,'prepareAdmin')+wrap(ops[1].nodeName,'selectAdmin')+wrap('Preparar conciliaciones confirmadas','reconcileAdmin')+'\n'+boundedBlockerAdminPrefix.toString()+`
const nowMs=Date.parse('2026-11-13T04:00:00.000Z'),occurred='2026-11-13T03:59:30.000Z';
function QaDate(...args){return new Date(...(args.length?args:[nowMs]))}QaDate.now=()=>nowMs;QaDate.parse=Date.parse;
let checks=0;const labels=[];const check=(x,label)=>{checks++;if(!x)throw Error('BLOCKER_ADMIN_CODE_QA_FAILED:'+label)},record=x=>labels.push(x),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const packageId='tg_'+'a'.repeat(40),requestId='tg_'+'b'.repeat(64);
const queue=(p=packageId,id=1)=>({id,package_id:p,revision:8,stage:'QUEUED',chat_id:'456',occurred_at:'2026-11-13T03:59:00.000Z'});
const row=(s,p=packageId,id=100)=>({id,package_id:p,revision:8,stage:s,occurred_at:occurred});
const binding={id:2,package_id:packageId,revision:8,stage:'REQUEST_TODOS',request_id:requestId};
const prepare=(s)=>prepareAdmin([queue(),binding,row(s)])[0].json;
const textOf=b=>selectAdmin([b])[0].json;
{
 const b=prepare('MEDIA_FAILED'),out=textOf(b);check(out.text.includes('no guardó una causa más específica'),'legacy unknown');check(!out.text.includes('Falta un crédito')&&!out.text.includes('confirmada como generada'),'no fabricated credit or IA');check(!out.text.includes('Hay resultados de Publisher'),'semantic footer');record('legacy image cause remains unknown');
}
{
 const b=prepare('DIAG|MEDIA_FAILED|IMAGE_ORIGIN_UNCLEAR|2'),out=textOf(b);check(b.candidates[0].sourceStage==='MEDIA_FAILED'&&b.needsObservation===false,'origin normalized');check(out.text.includes('No quedó claro el origen o tratamiento')&&out.text.includes('No la declares como IA si no lo es'),'origin advice');check(out.text.includes('Elemento 2'),'element ordinal');record('image origin is a separate explicit cause');
}
{
 const b=prepare('DIAG|MEDIA_FAILED|IMAGE_CREDIT_REQUIRED|2'),out=textOf(b),credit=${JSON.stringify(credit)};check(out.text.includes(credit.cause)&&out.text.includes(credit.field)&&out.text.includes(credit.action),'same operator catalog');check(!out.text.includes(requestId)&&!JSON.stringify(out.alerts).includes('request'),'no request JSON');check(equal(Object.keys(out.alerts[0]).sort(),['occurred_at','package_id','revision','stage']),'ACK four columns');record('credit details match operator without raw identifiers');
}
for(const [base,code,site]of[['VALIDATION_FAILED','MASTER_CATEGORY_INVALID_OPURO','OPURO'],['VALIDATION_FAILED','MASTER_CATEGORY_INVALID_OPOL','OPOL'],['VALIDATION_FAILED','MASTER_CATEGORY_INVALID_LIBERAL','LIBERAL'],['DRAFT_FAILED','PUBLISHER_PERMISSION_DENIED_OPURO','OPURO'],['DRAFT_FAILED','PUBLISHER_PERMISSION_DENIED_OPOL','OPOL'],['DRAFT_FAILED','PUBLISHER_PERMISSION_DENIED_LIBERAL','LIBERAL']]){
 const out=textOf(prepare('DIAG|'+base+'|'+code+'|0'));check(out.text.includes(site)&&out.text.includes(code),'explicit site '+code);check(!out.text.includes('Hay resultados de Publisher'),'known rejection is not uncertainty');record('explicit destination '+code);
}
for(const s of['DIAG|MEDIA_FAILED|IMAGE_CREDIT_REQUIRED|41','DIAG|DRAFT_UNCERTAIN|IMAGE_CREDIT_REQUIRED|1','DIAG|MEDIA_FAILED|PRIVATE_EXCEPTION_TOKEN|0']){
 const b=prepare(s),out=textOf(b);check(b.candidates[0].sourceStage==='INTERNAL_ERROR'&&b.needsObservation===false,'invalid carrier is not publication uncertainty');check(out.text.includes('diagnóstico específico válido')&&!out.text.includes('PRIVATE_EXCEPTION_TOKEN')&&!out.text.includes('DIAG|'),'no raw carrier');record('malformed carrier bounded fallback');
}
const proof={schema:'opmx.telegram.final-publication-observation.v1',status:'FINAL_PUBLICATION_CONFIRMED',packageId,revision:8,requestId,phase:'PUBLISH',destination:'TODOS',slug:'qa-existing-note',receiptHash:'c'.repeat(64),receiptState:'RECORDED',writeAuthorized:false,retryPermitted:false,writersIdleVerified:true,consistentSnapshot:true,observedAt:'2026-11-13T03:59:59.000Z',targets:['OPURO','OPOL','LIBERAL'].map((destination,i)=>({destination,postId:70+i,slug:'qa-existing-note',status:'publish',cmsVerified:true,ledgerVerified:true}))};
{
 const b=prepare('DIAG|DRAFT_UNCERTAIN|PUBLISHER_RESULT_UNCERTAIN|0'),p=reconcileAdmin([{...b,observation:proof}])[0].json;check(b.needsObservation===true&&b.candidates[0].sourceStage==='DRAFT_UNCERTAIN','uncertain normalized');check(p.reconciliationRecords.length===1&&p.reconciliationRecords[0].request_id===requestId,'real persistence validates final proof');const ack={...p.reconciliationRecords[0],id:400};check(selectAdmin([{...b,persistedReconciliations:[ack]}]).length===0,'exact proof suppresses uncertainty');const media=textOf({...prepare('DIAG|MEDIA_FAILED|IMAGE_CREDIT_REQUIRED|2'),persistedReconciliations:[ack]});check(media.alerts.length===1&&media.text.includes('Falta un crédito'),'same proof does not silence semantic failure');record('final #30 proof only suppresses publication uncertainty');
 for(const changed of[{...proof,phase:'DRAFT'},{...proof,targets:proof.targets.slice(0,2)},{...proof,requestId:'tg_'+'d'.repeat(64)},{...proof,writersIdleVerified:false},{...proof,receiptHash:null}]){const partial=reconcileAdmin([{...b,observation:changed}])[0].json;check(partial.reconciliationRecords.length===0,'bad proof cannot persist');check(selectAdmin([{...b,persistedReconciliations:[]}])[0].json.alerts.length===1,'bad proof preserves alert');}record('partial draft wrong request busy and missing receipt stay unresolved');
 const already=prepareAdmin([queue(),binding,row('DIAG|DRAFT_UNCERTAIN|PUBLISHER_RESULT_UNCERTAIN|0'),{id:401,package_id:packageId,revision:8,stage:'ALERT_ADMIN_100',occurred_at:occurred}])[0].json;check(already.needsObservation===true&&already.candidates[0].alreadyAlerted===true,'ACK keeps reconciliation observable');check(selectAdmin([already]).length===0,'ACK prevents notification duplicate');record('already alerted uncertainty remains observable without resending');
}
{
 const rows=[];for(let i=0;i<20;i++){const p='tg_'+(i+1).toString(16).padStart(40,'0');rows.push(queue(p,i+1),row('DIAG|MEDIA_FAILED|IMAGE_CREDIT_REQUIRED|2',p,100+i));}const original=JSON.stringify(rows),b=prepareAdmin(rows)[0].json,out=textOf(b),n=out.alerts.length;check(JSON.stringify(rows)===original,'input immutability');check(n>0&&n<20&&out.text.length<=3800,'twenty alerts bounded');check((out.text.match(/Código:/g)||[]).length===n&&out.text.endsWith('Código: IMAGE_CREDIT_REQUIRED'),'complete alerts');check(equal(out.alerts.map(a=>a.stage),b.candidates.slice(0,n).map(a=>a.stage)),'delivered prefix only');check(out.alerts.every(a=>equal(Object.keys(a).sort(),['occurred_at','package_id','revision','stage'])),'bounded ACK columns');const acks=out.alerts.map((a,i)=>({...a,id:1000+i})),next=prepareAdmin([...rows,...acks])[0].json;check(next.candidates.length>0&&next.candidates[0].stage===b.candidates[n].stage,'next poll receives remainder');record('twenty alerts complete prefix ACK and next poll remainder');
}
{
 const long='📰 ÁÉÍÓÚ &amp; &lt;foto&gt; '.repeat(40),items=Array.from({length:20},(_,i)=>({text:(i+1)+'. '+long+'FIN',uncertain:false})),r=boundedBlockerAdminPrefix(items);check(r.chosen.length>0&&r.chosen.length<20&&r.text.length<=3800&&r.text.endsWith('FIN'),'Unicode budget complete');check((r.text.match(/FIN/g)||[]).length===r.chosen.length,'UTF16 unit prefix');const t='Texto completo. '.repeat(100),mixed=boundedBlockerAdminPrefix([{text:t,uncertain:false},{text:t,uncertain:false},{text:t,uncertain:true}]);check(mixed.chosen.length===2&&!mixed.text.includes('Hay resultados de Publisher'),'excluded uncertainty does not add footer');record('Unicode long alerts and prefix-only uncertainty footer');
}
return [{json:{status:'BLOCKER_ADMIN_REAL_CODE_QA_PASSED',cases:labels.length,checks,labels,sourceSha256:${JSON.stringify(hashes)},changedCodeBodies:2,unchangedReconciliationBody:1,syntheticFixturesOnly:true,networkCalls:0,guardMutations:0,cmsWrites:0,telegramMessages:0,prototypeAdaptations:0}}];`;
}
