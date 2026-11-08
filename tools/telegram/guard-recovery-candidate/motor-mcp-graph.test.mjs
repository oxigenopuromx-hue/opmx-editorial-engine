import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {buildMotorMcpOperations} from './receiver/build-motor-mcp-operations.mjs';
const attemptProtocol=await readFile(new URL('./motor-attempt-protocol.mjs',import.meta.url),'utf8');
const baseProtocol="const resolved=$input.first().json;return [{json:{httpStatus:200,response:{jsonrpc:'2.0',id:1,result:{tools:[]}}}}];";
const ownerCode="const privateTools=new Set(['informar_bloqueo_telegram_opmx']);return [];",guardCredential={id:'guard',name:'guard'};
const scripts={baseProtocol,ownerRouting:'return [];',attemptProtocol};
function fixture(){const nodes=[{name:'Protocolo MCP archivos',type:'n8n-nodes-base.code',parameters:{jsCode:baseProtocol}},{name:'Resolver identidad de solicitud',type:'n8n-nodes-base.code',parameters:{jsCode:ownerCode}},{name:'Publicación — Guard OPURO',type:'n8n-nodes-base.httpRequest',parameters:{},credentials:{httpHeaderAuth:guardCredential}},{name:'Responder MCP',type:'n8n-nodes-base.respondToWebhook',parameters:{}}];const connections={'¿Notificación MCP?':{main:[[{node:'Aceptar notificación'}],[{node:'¿Informar bloqueo Telegram?'}]]}};return {id:'bnzVMNkZuGO1GQCZ',active:true,activeVersionId:'active',versionId:'draft',nodes,connections,activeVersion:{sameAsDraft:false,nodes:structuredClone(nodes),connections:structuredClone(connections)}};}
const build=w=>buildMotorMcpOperations({workflow:w,expectedActiveVersion:'active',expectedDraftVersion:'draft',scripts,guardCredential});
test('wraps the existing MCP protocol and routes attempt calls without adding triggers',()=>{
 const result=build(fixture()),op=result.operations.find(x=>x.nodeName==='Protocolo MCP archivos');assert.ok(result.operations.filter(x=>x.type==='addNode').every(x=>!x.node.type.includes('Trigger')));
 const run=message=>new Function('$input','$',op.parameters.jsCode)({first:()=>({json:{identity:{owner:'123',chat:'123'},envelope:{body:message}}})},()=>{})[0].json;
 const catalog=run({jsonrpc:'2.0',id:1,method:'tools/list'});assert.ok(catalog.response.result.tools.some(x=>x.name==='iniciar_intento_telegram_opmx'));
 const request=run({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'iniciar_intento_telegram_opmx',arguments:{package_id:'tg_'+'a'.repeat(40),revision:7}}});assert.equal(request.route,'telegram-attempt');assert.equal(request.request.body.owner,'123');
});
test('refuses draft drift, version drift, duplicate nodes and missing credentials',()=>{
 for(const mutate of [w=>w.versionId='other',w=>w.nodes[0].parameters.jsCode+='changed',w=>w.nodes.push({name:'¿Gestionar intento Motor?'}),w=>w.nodes[2].credentials.httpHeaderAuth.id='other']){const w=fixture();mutate(w);assert.throws(()=>build(w),/MCP_(VERSION_UNCONFIRMED|GRAPH_CHANGED)/)}
});
