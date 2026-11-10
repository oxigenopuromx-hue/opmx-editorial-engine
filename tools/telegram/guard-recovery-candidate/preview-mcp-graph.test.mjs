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
test('two preview parts use their corresponding claims and return no private fields to the Motor',()=>{
 const {names:n,operations:ops}=buildPreviewMcpOperations(args),byName=new Map(ops.filter(x=>x.type==='addNode').map(x=>[x.node.name,x.node]));
 const request={id:7,body:{packageId:'tg_'+'a'.repeat(40),revision:9,owner:'123',chat:'123'}},identity={status:'READY',owner:'456',chat:'456',packageId:request.body.packageId,revision:9,previewHash:'b'.repeat(64)};
 const prior=[1,2].map(part=>({status:'SEND_READY',identity,claim:{status:'PART_CLAIMED',part,parts:2,token:String(part).repeat(64)}}));
 const ack=byName.get(n.ack).parameters.jsCode;
 for(let i=0;i<2;i++){const input={first:()=>({json:{chat:{id:456},message_id:101+i}})},lookup=()=>({first:(branch,run)=>({json:prior[run]})});const output=new Function('$input','$','$runIndex',ack)(input,lookup,i)[0].json;assert.equal(output.status,'ACK_READY');assert.equal(output.body.part,i+1);assert.equal(output.body.token,String(i+1).repeat(64))}
 const output=new Function('$input','$',byName.get(n.done).parameters.jsCode)({},()=>({first:()=>({json:{request}})}))[0].json.response.result.structuredContent;
 assert.deepEqual(output,{status:'PREVIEW_DELIVERED',package_id:request.body.packageId,revision:9,confirmation_required:true,retryPermitted:false});assert.equal(JSON.stringify(output).includes('456'),false);
});
