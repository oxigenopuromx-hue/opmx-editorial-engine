import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRuntimeAdministrativeObserverOperations as build,runtimeAdministrativeObserverNodeNames as names} from './receiver/build-runtime-administrative-observer-operations.mjs';
import {writerGraphFingerprint} from './writer-release-contract.mjs';

const scope={packageId:'tg_'+'a'.repeat(40),revision:12,eventId:'evt_'+'b'.repeat(48),nonce:'obs_'+'c'.repeat(48),startedAt:'2026-11-13T18:00:00.123Z'};
const origin={workflowId:'bnzVMNkZuGO1GQCZ',executionId:'39732'},version='11111111-1111-4111-8111-111111111111';
function fixture(){
 const code=(name,jsCode)=>({id:name,name,type:'n8n-nodes-base.code',typeVersion:2,position:[100,0],parameters:{mode:'runOnceForAllItems',jsCode}});
 const nodes=[code('Validar alcance','return [{json:$input.first().json.body}];'),{id:'read',name:'Leer running',type:'n8n-nodes-base.httpRequest',typeVersion:4.5,position:[200,0],parameters:{authentication:'predefinedCredentialType',nodeCredentialType:'n8nApi',url:'https://n8n.oxigenopuro.com.mx/api/v1/executions?status=running&limit=100&includeData=false'},credentials:{n8nApi:{id:'existing-read-only',name:'Existing read only'}}},code('Observación sin permiso de recuperación',"const scope=$('Validar alcance').first().json;const workflows=$('Workflows').first().json.workflows;const executionPages=$('Pages').first().json.executionPages;return [{json:{schema:'opmx.runtime-observation.v1',scope:{packageId:scope.packageId,revision:scope.revision,eventId:scope.eventId,nonce:scope.nonce},workflows,executionPages,authorizesRecovery:false,motorTerminationVerified:false}}];")];
 while(nodes.length<11)nodes.push(code('Unrelated '+nodes.length,'return $input.all();'));
 return {id:'2HBn1RnSYgyxuHgE',active:true,activeVersionId:'active',versionId:'draft',nodes:[code('Old draft','return [];')],connections:{},settings:{saveManualExecutions:false,saveDataErrorExecution:'none',saveDataSuccessExecution:'none'},activeVersion:{sameAsDraft:false,nodes,connections:{'Validar alcance':{main:[[{node:'Leer versión 0',type:'main',index:0}]]},'Leer running':{main:[[{node:'Old next',type:'main',index:0}]]}}}};
}
const compile=w=>build({workflow:w,expectedActiveVersion:'active',expectedDraftVersion:'draft',expectedActiveGraphHash:writerGraphFingerprint(w.activeVersion)});
function outputs(withOrigin=true){
 const startedAt=scope.startedAt,execution={id:origin.executionId,workflowId:origin.workflowId,workflowVersionId:version,mode:'webhook',status:'running',startedAt,stoppedAt:null};
 return new Map([['Validar alcance',{...scope,...(withOrigin?{nonWritingRecoveryExecution:origin}:{})}],['Workflows',{workflows:[{id:origin.workflowId,activeVersionId:version}]}],['Pages',{executionPages:[{status:'running',complete:true,executions:[{id:origin.executionId,workflowId:origin.workflowId,status:'running',startedAt,stoppedAt:null}]},{status:'waiting',complete:true,executions:[]},{status:'new',complete:true,executions:[]}]}],[names.read,{statusCode:200,body:execution}]]);
}
test('adds only optional IF/GET and two code parameters; preserves all old reads and old draft',()=>{
 const w=fixture(),before=structuredClone(w),r=compile(w);assert.deepEqual(w,before);assert.equal(r.operations.length,9);assert.equal(r.candidate.nodes.length,13);assert.deepEqual(r.candidate.nodes.slice(3,11),w.activeVersion.nodes.slice(3));assert.deepEqual(r.candidate.connections['Leer running'],w.activeVersion.connections['Leer running']);assert.deepEqual(r.originalDraft.nodes,w.nodes);assert.deepEqual(r.originalDraft.settings,w.settings);
 const read=r.candidate.nodes.find(n=>n.name===names.read);assert.deepEqual(read.credentials,w.activeVersion.nodes[1].credentials);assert.equal(read.parameters.method,'GET');assert.equal(read.retryOnFail,false);assert.equal(read.onError,'stopWorkflow');assert.equal(read.parameters.options.redirect.redirect.followRedirects,false);assert.match(read.parameters.url,/api\/v1\/executions\//);assert.match(read.parameters.url,/includeData=true/);
 assert.deepEqual(r.candidate.connections[names.condition].main[1],[{node:'Leer versión 0',type:'main',index:0}]);
});
test('compiled collector returns only metadata proof, preserves raw pages and four-key scope',()=>{
 const r=compile(fixture()),source=r.operations[1].parameters.jsCode,map=outputs();const result=new Function('$',source)(name=>({first:()=>({json:map.get(name)})}))[0].json;
 assert.deepEqual(Object.keys(result.scope).sort(),['eventId','nonce','packageId','revision']);assert.deepEqual(result.executionPages,map.get('Pages').executionPages);assert.equal(result.authorizesRecovery,false);assert.equal(result.motorTerminationVerified,false);assert.equal(result.administrativeExecutionProof.id,origin.executionId);assert.equal(Object.keys(result.administrativeExecutionProof).length,7);
});
test('ordinary collector does not reference unexecuted administrative GET and emits null proof',()=>{
 const r=compile(fixture()),source=r.operations[1].parameters.jsCode,map=outputs(false);const result=new Function('$',source)(name=>{if(name===names.read)throw Error('UNEXECUTED_NODE_WAS_READ');return {first:()=>({json:map.get(name)})}})[0].json;
 assert.equal(result.administrativeExecutionProof,null);assert.deepEqual(result.executionPages,map.get('Pages').executionPages);assert.deepEqual(result.workflows,map.get('Workflows').workflows);
});
test('compiled collector treats 404/missing metadata as null, never synthesized proof',()=>{
 const r=compile(fixture()),source=r.operations[1].parameters.jsCode;for(const response of [{statusCode:404,body:{}},{statusCode:200,body:{id:origin.executionId,workflowId:origin.workflowId}}]){const map=outputs();map.set(names.read,response);const result=new Function('$',source)(name=>({first:()=>({json:map.get(name)})}))[0].json;assert.equal(result.administrativeExecutionProof,null);assert.equal(result.executionPages[0].executions.length,1)}
});
test('refuses stale graph/versions, retained execution data, altered connection or existing wrapper',()=>{
 for(const mutate of [w=>w.versionId='changed',w=>w.activeVersionId='changed',w=>w.activeVersion.nodes.pop(),w=>w.settings.saveDataSuccessExecution='all',w=>w.settings.saveManualExecutions=true,w=>w.activeVersion.connections['Validar alcance'].main[0][0].node='Other',w=>w.activeVersion.nodes[0].parameters.jsCode+='nonWritingRecoveryExecution',w=>w.activeVersion.nodes[2].parameters.jsCode+='administrativeExecutionProof']){const w=fixture();mutate(w);assert.throws(()=>compile(w),/RUNTIME_COLLECTOR_/)}
});
