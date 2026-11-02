import test from 'node:test';import assert from 'node:assert/strict';
import {classifyFileMcp} from '../mcp-publisher/files-mcp-protocol.mjs';import {classifyTelegramReader} from './mcp-reader.mjs';
import {classifyTelegramEvents,formatTelegramEventResult} from './event-protocol.mjs';import {buildTelegramEventOperations} from './build-mcp-events.mjs';
const identity={owner:'1001',chat:'1001'},route=x=>classifyTelegramEvents(x,identity,y=>classifyTelegramReader(y,identity,classifyFileMcp)),call=(method,params)=>route({body:{jsonrpc:'2.0',id:42,method,params}});
const p={name:'opmx.package.ready',arguments:{queue_id:'telegram-editorial'},delivery:{mode:'webhook',url:'https://callbacks.chatgpt.com/fixture',secret:'whsec_fixture'}};
test('events capability and catalog coexist with all six tools',()=>{
 assert.deepEqual(call('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'test',version:'1'}}).response.result.capabilities.events,{});
 assert.equal(call('tools/list',{}).response.result.tools.length,6);
 const e=call('events/list',{}).response.result.events;assert.equal(e.length,1);assert.deepEqual(e[0].inputSchema.required,['queue_id']);assert.equal(e[0].payloadSchema.additionalProperties,false);assert.equal(call('events/list',{cursor:'unsupported'}).response.error.code,-32602);
});
test('private owner is injected; filter/callback fields never become public arguments or tool results',()=>{
 const r=call('events/subscribe',p);assert.equal(r.route,'telegram-events');assert.equal(r.request.body.owner,'1001');
 for(const bad of [{...p,owner:'2002'},{...p,arguments:{queue_id:'other'}},{...p,cursor:'skip'},{...p,ttlMs:-1},{...p,delivery:{...p.delivery,extra:'x'}}])assert.equal(call('events/subscribe',bad).response.error.code,-32602);
 const clean={...p,delivery:{mode:'webhook',url:p.delivery.url}};assert.equal(call('events/unsubscribe',clean).request.action,'unsubscribe');
 const formatted=formatTelegramEventResult(r.request,{id:'sub_'+'a'.repeat(48),refreshBefore:'2026-11-04T00:00:00Z',cursor:null,truncated:false,secret:'must not leak',url:p.delivery.url});assert.equal(JSON.stringify(formatted).includes('must not leak'),false);assert.equal(JSON.stringify(formatted).includes(p.delivery.url),false);
 assert.equal(formatTelegramEventResult(r.request,{error:{message:'SQL private'}}).response.error.code,-32603);
});
test('generated n8n code runs without imports and preserves graph source readers',()=>{
 const ops=buildTelegramEventOperations({identity,guardCredential:{id:'observed',name:'Existing'}}),code=ops[0].parameters.jsCode;
 const out=new Function('$input',code)({first:()=>({json:{body:{jsonrpc:'2.0',id:1,method:'events/list'}}})});assert.equal(out[0].json.response.result.events.length,1);
 assert.equal(ops.find(x=>x.node?.type==='n8n-nodes-base.httpRequest').node.parameters.options.redirect.redirect.followRedirects,false);
});
