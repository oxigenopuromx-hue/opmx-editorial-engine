import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildIssue18QuotaReceiverOperations as build,patchIssue18OpenQuotaResolver,patchIssue18QuotaConfirmation,issue18QuotaReceiverNodes as names} from './build-issue18-quota-receiver-operations.mjs';
import {patchPackageOpeningResolver} from './build-package-opening-diagnostic-operations.mjs';
import {diagnosePackageQuotaFailure} from '../package-quota-diagnostic.mjs';

const resolver=patchPackageOpeningResolver(await readFile(new URL('./resolve-candidate.js',import.meta.url),'utf8'));
const confirm=await readFile(new URL('./confirm-candidate.js',import.meta.url),'utf8');
const pkg='tg_'+'a'.repeat(40),receipt='telegram-123-2-3';
const execute=(source,context,result)=>new Function('$','$input',source)(()=>({first:()=>({json:context})}),{first:()=>({json:result})})[0].json;
function graph(){return {nodes:[{name:names.resolve,type:'n8n-nodes-base.code',parameters:{mode:'runOnceForAllItems',jsCode:resolver}},{name:names.confirm,type:'n8n-nodes-base.code',parameters:{mode:'runOnceForAllItems',jsCode:confirm}},...Array.from({length:50},(_,i)=>({name:'Other '+i,type:'other',parameters:{}}))],connections:{}}}

test('quota diagnostic patch preserves attested /listo routing, body and identity for the atomic builder',()=>{
 const context={user_id:'123',chat_id:'123',message_id:2,receipt_id:receipt,package_operation:'SEAL',kind:'TEXT',text:'/listo',mode_attested:true},session={status:'OPEN',packageId:pkg,revision:5};
 const raw={statusCode:200,body:session},before=execute(resolver,context,raw),after=execute(patchIssue18OpenQuotaResolver(resolver),context,raw);
 assert.equal(after.next_action,'reserve');assert.equal(after.next_url,'https://publisher.oxigenopuro.com.mx/v1/telegram/packages/reserve');assert.deepEqual(after,before);
});
test('normal materials still use reserve and unrelated routes remain unchanged',()=>{
 for(const context of [{package_operation:'ADD',kind:'TEXT',text:'Nueva fuente',mode_attested:false},{package_operation:'STATUS'}]){
  const input={user_id:'123',chat_id:'123',message_id:2,receipt_id:receipt,...context},session={status:'OPEN',packageId:pkg,revision:5};
  const raw={statusCode:200,body:session};assert.deepEqual(execute(patchIssue18OpenQuotaResolver(resolver),input,raw),execute(resolver,input,raw));
 }
});
test('OPEN quota diagnostic explains global count without announcing storage or a new package',()=>{
 const context={user_id:'123',chat_id:'123',message_id:2,receipt_id:receipt,package_operation:'OPEN'},diagnostic=diagnosePackageQuotaFailure({operation:'OPEN',quota:{package_count:1000}}),raw={statusCode:200,body:{status:'QUOTA_EXCEEDED',quotaDiagnostic:diagnostic}},patched=patchIssue18OpenQuotaResolver(resolver);
 const result=execute(patched,context,raw);assert.match(result.reply_text,/No se abrió otro paquete/);assert.match(result.reply_text,/1000\/1000/);assert.equal(result.default_policy_candidate,false);assert.equal(result.routing_owner_confirmed,false);assert.equal(result.packageId,undefined);
 assert.deepEqual(execute(patched,context,{statusCode:200,body:{status:'QUOTA_EXCEEDED'}}),execute(resolver,context,{statusCode:200,body:{status:'QUOTA_EXCEEDED'}}));
});
test('Receiver displays the safe typed quota explanation and keeps legacy fallback',()=>{
 const context={kind:'TEXT',text:'Nueva fuente'},diagnostic=diagnosePackageQuotaFailure({operation:'OPEN',quota:{package_count:1000}}),patched=patchIssue18QuotaConfirmation(confirm);
 assert.match(execute(patched,context,{status:'QUOTA_EXCEEDED',quotaDiagnostic:diagnostic}).reply_text,/límite global de paquetes guardados/);
 assert.equal(execute(patched,context,{status:'QUOTA_EXCEEDED'}).reply_text,execute(confirm,context,{status:'QUOTA_EXCEEDED'}).reply_text);
 const injected={...diagnostic,code:'SECRET'};assert.equal(execute(patched,context,{status:'QUOTA_EXCEEDED',quotaDiagnostic:injected}).reply_text.includes('SECRET'),false);
});
test('builder changes only two Code parameters and preserves every other parameter',()=>{
 const source=graph(),before=structuredClone(source),operations=build(source);assert.deepEqual(source,before);assert.equal(operations.length,2);
 assert.deepEqual(operations.map(x=>x.nodeName),[names.resolve,names.confirm]);assert(operations.every(x=>x.type==='updateNodeParameters'&&x.replace===true&&x.parameters.mode==='runOnceForAllItems'));
});
test('builder refuses stale node counts, ambiguous nodes, changed opening wrapper and duplicate installation',()=>{
 for(const mutate of [x=>x.nodes.pop(),x=>x.nodes[2].name=names.resolve,x=>x.nodes[0].parameters.jsCode=resolver.replace('const reply=replies[diagnostic.code]??','const reply=changed??'),x=>x.nodes[1].parameters.jsCode=patchIssue18QuotaConfirmation(confirm)]){
  const source=graph();mutate(source);assert.throws(()=>build(source));
 }
});
