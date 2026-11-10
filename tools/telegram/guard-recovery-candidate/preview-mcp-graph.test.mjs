import test from 'node:test';import assert from 'node:assert/strict';import {buildPreviewMcpOperations} from './receiver/build-preview-mcp-operations.mjs';
const args={guardCredential:{id:'g',name:'guard'},telegramCredential:{id:'t',name:'telegram'}};
test('preview delivery is routed through the guarded materializer and acknowledgements',()=>{
 const {names:n,operations:ops}=buildPreviewMcpOperations(args),nodes=ops.filter(x=>x.type==='addNode').map(x=>x.node),edges=ops.filter(x=>x.type==='addConnection');
 assert.equal(nodes.find(x=>x.name===n.materialize).parameters.url.endsWith('/previews/materialize'),true);
 const telegram=nodes.find(x=>x.name===n.telegram);assert.equal(telegram.parameters.chatId,'={{ $json.telegram.chatId }}');assert.equal(telegram.credentials.telegramApi.id,'t');
 assert.ok(edges.some(x=>x.source===n.report&&x.target===n.next));assert.ok(edges.some(x=>x.source===n.done&&x.target==='Responder MCP'));assert.ok(edges.some(x=>x.source===n.fail&&x.target==='Responder MCP'));
 for(const node of nodes.filter(x=>x.type==='n8n-nodes-base.code'))assert.doesNotThrow(()=>new Function('$','$input','$runIndex',node.parameters.jsCode));
 assert.match(nodes.find(x=>x.name===n.ack).parameters.jsCode,/\$runIndex/);
});
test('delivery cannot be installed without existing guard and Telegram credentials',()=>{assert.throws(()=>buildPreviewMcpOperations({...args,telegramCredential:{}}),/PREVIEW_MCP_CREDENTIAL_MISSING/)});
