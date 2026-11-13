import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildUnacknowledgedRecoveryMcpOperations as build} from './receiver/build-unacknowledged-recovery-mcp-operations.mjs';
import {writerGraphFingerprint} from './writer-release-contract.mjs';

const protocolSource=await readFile(new URL('./motor-unacknowledged-recovery-protocol.mjs',import.meta.url),'utf8');
const ownerSource=await readFile(new URL('./mcp-owner-routing.js',import.meta.url),'utf8');
const tool='recuperar_intento_sin_decision_telegram_opmx',packageId='tg_'+'a'.repeat(40);
function fixture(){
 const code=(name,jsCode)=>({name,type:'n8n-nodes-base.code',typeVersion:2,parameters:{jsCode}});
 const nodes=[code('Resolver identidad de solicitud',ownerSource),code('Protocolo MCP archivos',"return [{json:{httpStatus:200,response:{jsonrpc:'2.0',id:1,result:{tools:[{name:'existing_tool'}]}}}}];"),{name:'Gestionar intento Motor guard',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,retryOnFail:false,onError:'continueRegularOutput',credentials:{httpHeaderAuth:{id:'existing-guard'}},parameters:{method:'POST',authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',url:'={{ ["start","block","complete","decision"].includes($json.request.action) ? "https://publisher.oxigenopuro.com.mx/v1/telegram/attempts/" + $json.request.action : "" }}',jsonBody:'={{ JSON.stringify($json.request.body) }}'}},code('Resultado intento Motor MCP','return [{json:{existing:true}}];')];
 while(nodes.length<155)nodes.push(code('Unrelated '+nodes.length,'return $input.all();'));
 const active={sameAsDraft:false,nodes,connections:{'Protocolo MCP archivos':{main:[[{node:'Gestionar intento Motor guard',type:'main',index:0}]]}}};
 return {id:'bnzVMNkZuGO1GQCZ',active:true,activeVersionId:'active',versionId:'draft',nodes:[code('Older draft','return [];')],connections:{},settings:{saveManualExecutions:false,saveDataErrorExecution:'none',saveDataSuccessExecution:'none'},activeVersion:active};
}
const compile=w=>build({workflow:w,expectedActiveVersion:'active',expectedDraftVersion:'draft',expectedActiveGraphHash:writerGraphFingerprint(w.activeVersion),protocolSource});
test('changes exactly four active parameters and preserves unrelated graph, settings and old draft',()=>{
 const w=fixture(),before=structuredClone(w),r=compile(w);assert.deepEqual(w,before);assert.equal(r.operations.length,4);assert.ok(r.operations.every(x=>x.type==='updateNodeParameters'));assert.equal(r.candidate.nodes.length,155);assert.deepEqual(r.candidate.connections,w.activeVersion.connections);assert.deepEqual(r.candidate.nodes.slice(4),w.activeVersion.nodes.slice(4));assert.deepEqual(r.originalDraft,{nodes:w.nodes,connections:w.connections,nodeGroups:[],settings:w.settings});assert.notEqual(r.candidateGraphHash,r.baseGraphHash);
 assert.deepEqual(r.candidate.nodes[2].credentials,w.activeVersion.nodes[2].credentials);assert.equal(r.candidate.nodes[2].retryOnFail,false);assert.match(r.candidate.nodes[2].parameters.url,/recover-unacknowledged/);
});
test('administrative recovery retains subscriber identity while ordinary reads keep original owner routing',()=>{
 const r=compile(fixture()),source=r.operations[0].parameters.jsCode;
 const run=name=>new Function('$','$input',source)(()=>({first:()=>({json:{body:{method:'tools/call',params:{name,arguments:{package_id:packageId}}}}})}),{all:()=>[{json:{package_id:packageId,stage:'ROUTING',chat_id:'777'}}]})[0].json;
 assert.deepEqual(run(tool).identity,{owner:'255516723',chat:'255516723'});assert.deepEqual(run('leer_paquete_telegram_opmx').identity,{owner:'777',chat:'777'});
});
test('wrapped catalog and formatter preserve old behavior and scope recovery capability to its event',()=>{
 const r=compile(fixture()),protocol=r.operations[1].parameters.jsCode,format=r.operations[3].parameters.jsCode;
 const args={package_id:packageId,revision:12,event_id:'evt_'+'b'.repeat(48),preview_hash:'c'.repeat(64)};
 const run=message=>new Function('$input','$',protocol)({first:()=>({json:{identity:{owner:'255516723',chat:'255516723'},envelope:{body:message}}})},()=>{})[0].json;
 assert.deepEqual(run({method:'tools/list'}).response.result.tools.map(t=>t.name),['existing_tool',tool]);
 const request=run({jsonrpc:'2.0',id:9,method:'tools/call',params:{name:tool,arguments:args}}).request;
 const output=new Function('$input','$',format)({first:()=>({json:{status:'UNACKNOWLEDGED_ATTEMPT_RECOVERED',eventId:args.event_id,token:'d'.repeat(64),retryPermitted:false}})},()=>({first:()=>({json:{request}})}))[0].json;
 assert.equal(output.response.result.structuredContent.status,'UNACKNOWLEDGED_ATTEMPT_RECOVERED');
 assert.deepEqual(new Function('$input','$',format)({first:()=>({json:{}})},()=>({first:()=>({json:{request:{action:'start'}}})})),[{json:{existing:true}}]);
});
test('refuses a stale version, wrong graph, existing adapter, changed routing or retained executions',()=>{
 for(const mutate of [w=>w.versionId='changed',w=>w.activeVersionId='changed',w=>w.activeVersion.nodes.pop(),w=>w.settings.saveDataSuccessExecution='all',w=>w.settings.saveManualExecutions=true,w=>w.activeVersion.nodes[2].retryOnFail=true,w=>w.activeVersion.nodes[0].parameters.jsCode+='\n'+tool,w=>w.activeVersion.nodes[2].parameters.url='https://elsewhere.invalid']){const w=fixture();mutate(w);assert.throws(()=>compile(w),/RECOVERY_MCP_/)}
 const w=fixture();assert.throws(()=>build({workflow:w,expectedActiveVersion:'active',expectedDraftVersion:'draft',expectedActiveGraphHash:'0'.repeat(64),protocolSource}),/GRAPH_UNCONFIRMED/);
});
