import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBlockedAttemptRecoveryMcpOperations as build} from './receiver/build-blocked-attempt-recovery-mcp-operations.mjs';
import {writerGraphFingerprint} from './writer-release-contract.mjs';

const previousProtocolSource="export const marker='OLD';";
const protocolSource="export const marker='BLOCKED_UNWRITTEN_ATTEMPT_RECOVERED';\nconst pattern='^tg_[a-f0-9]{40}$';";
function fixture(){
 const nodes=['Protocolo MCP archivos','Resultado intento Motor MCP'].map(name=>({name,type:'n8n-nodes-base.code',typeVersion:2,parameters:{jsCode:"const adapter=(()=>{const marker='OLD';return marker;})();return [{json:{adapter}}];"}}));
 nodes.push({name:'Gestionar intento Motor guard',type:'n8n-nodes-base.httpRequest',typeVersion:4.5,retryOnFail:false,credentials:{httpHeaderAuth:{id:'guard-reference'}},parameters:{authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',jsonBody:'={{ JSON.stringify($json.request.body) }}'}});
 while(nodes.length<155)nodes.push({name:'Preserved '+nodes.length,type:'n8n-nodes-base.code',typeVersion:2,parameters:{jsCode:'return $input.all();'}});
 const activeVersion={sameAsDraft:false,nodes,connections:{'Protocolo MCP archivos':{main:[[{node:'Resultado intento Motor MCP',type:'main',index:0}]]}},nodeGroups:[]};
 return {id:'bnzVMNkZuGO1GQCZ',active:true,activeVersionId:'active',versionId:'draft',settings:{saveManualExecutions:false,saveDataSuccessExecution:'none',saveDataErrorExecution:'none'},activeVersion};
}
const args=w=>({workflow:w,expectedActiveVersion:'active',expectedDraftVersion:'draft',expectedGraphHash:writerGraphFingerprint(w.activeVersion),previousProtocolSource,protocolSource});
test('keeps anchored regex literal, scopes internal origin and preserves the remaining graph',()=>{
 const w=fixture(),before=structuredClone(w),result=build(args(w));
 assert.deepEqual(w,before);assert.equal(result.operations.length,3);assert.equal(result.candidate.nodes.length,155);
 assert.deepEqual(result.candidate.connections,w.activeVersion.connections);assert.deepEqual(result.candidate.nodeGroups,w.activeVersion.nodeGroups);
 assert.deepEqual(result.candidate.nodes.slice(3),w.activeVersion.nodes.slice(3));
 for(const op of result.operations.slice(0,2)){assert.ok(op.parameters.jsCode.includes("const pattern='^tg_[a-f0-9]{40}$';"));assert.equal(new Function(op.parameters.jsCode)()[0].json.adapter,'BLOCKED_UNWRITTEN_ATTEMPT_RECOVERED')}
 const expression=result.operations[2].parameters.jsonBody.slice(3,-2),run=new Function('$json','$execution','$workflow','return '+expression);
 const original={packageId:'test'};
 assert.deepEqual(JSON.parse(run({request:{action:'recover-unacknowledged',body:original}},{id:123},{id:'bnzVMNkZuGO1GQCZ'})),{...original,origin:{workflowId:'bnzVMNkZuGO1GQCZ',executionId:'123'}});
 assert.deepEqual(JSON.parse(run({request:{action:'start',body:original}},{id:123},{id:'bnzVMNkZuGO1GQCZ'})),original);
});
test('rejects concurrent version or graph changes, duplicate adapters and retained capabilities',()=>{
 for(const mutate of [w=>w.versionId='other',w=>w.activeVersionId='other',w=>w.settings.saveManualExecutions=true,w=>w.settings.saveDataSuccessExecution='all',w=>w.activeVersion.nodes[0].parameters.jsCode+='const marker=\'OLD\';',w=>w.activeVersion.nodes.pop()]){
  const w=fixture(),a=args(w);mutate(w);assert.throws(()=>build(a),/BLOCKED_RECOVERY_/);
 }
 assert.throws(()=>build({...args(fixture()),protocolSource:previousProtocolSource}),/MODULE_UNCONFIRMED/);
});
