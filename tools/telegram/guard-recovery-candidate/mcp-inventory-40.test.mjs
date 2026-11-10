import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const reader=await readFile(new URL('./mcp-inventory-40-reader.js',import.meta.url),'utf8');
const protocol=await readFile(new URL('./mcp-inventory-40-protocol.js',import.meta.url),'utf8');
const packageId='tg_'+'a'.repeat(40);
test('reader accepts up to forty items and rejects a larger inventory',()=>{
 const request={id:1,action:'manifest',body:{packageId}},$=()=>({first:()=>({json:{request}})});
 const item={item_id:'ti_'+'b'.repeat(40),kind:'TEXT',state:'STORED',text_content:'fuente',content_bytes:6,sha256:'a'.repeat(64)};
 function read(n){const result={status:'FOUND',packageId,state:'READY',revision:7,items:Array.from({length:n},()=>item)};return new Function('$','$input',reader)($,{first:()=>({json:result})})[0].json.response.result.structuredContent.status;}
 assert.equal(read(20),'PACKAGE_FOUND');assert.equal(read(40),'PACKAGE_FOUND');assert.equal(read(41),'SOURCE_NOT_CONFIRMED');
});
test('published event catalog advertises the same maximum',()=>{
 const input={first:()=>({json:{identity:{owner:'123',chat:'123'},envelope:{body:{jsonrpc:'2.0',id:1,method:'events/list',params:{}}}}})};
 const result=new Function('$input',protocol)(input)[0].json.response.result;
 assert.equal(result.events[0].payloadSchema.properties.item_count.maximum,40);
});
test('candidate reader passes only complete, attributable recovery decisions',async()=>{
 const source=await readFile(new URL('./mcp-recovered-policy-reader-candidate.js',import.meta.url),'utf8');
 const request={id:1,action:'manifest',body:{packageId}},$=()=>({first:()=>({json:{request}})}),itemId='ti_'+'b'.repeat(40);
 const item={item_id:itemId,kind:'TEXT',state:'STORED',text_content:'control',content_bytes:7,sha256:'a'.repeat(64)};
 const result={status:'FOUND',packageId,state:'READY',revision:9,items:[item],recoveredPolicy:{mode:'PUBLISH',authorized:true,explicit:true,authorization:'DIRECT_MODE_COMMAND',destination:'OPURO,LIBERAL',control_item_ids:[itemId]}};
 function read(){return new Function('$','$input',source)($,{first:()=>({json:result})})[0].json.response.result.structuredContent;}
 assert.equal(read().recovered_policy.destination,'OPURO,LIBERAL');
 result.confirmedCorrection={package_id:packageId,revision:9,action:'CREATE',content_mode:'LITERAL',destination:'OPURO',preview_hash:'c'.repeat(64)};
 assert.equal(read().confirmed_correction.destination,'OPURO');
 result.confirmedCorrection.revision=8;assert.equal(read().status,'SOURCE_NOT_CONFIRMED');result.confirmedCorrection.revision=9;
 delete result.recoveredPolicy;assert.equal(read().status,'SOURCE_NOT_CONFIRMED');
 result.recoveredPolicy={mode:'PUBLISH',authorized:true,explicit:true,authorization:'DIRECT_MODE_COMMAND',destination:'OPURO,LIBERAL',control_item_ids:[itemId]};
 result.recoveredPolicy.control_item_ids=['ti_'+'c'.repeat(40)];assert.equal(read().status,'SOURCE_NOT_CONFIRMED');
});
test('preview event is separately catalogued and routed without enabling publication',()=>{
 function invoke(message){const input={first:()=>({json:{identity:{owner:'123',chat:'123'},envelope:{body:{jsonrpc:'2.0',id:7,...message}}}})};return new Function('$input',protocol)(input)[0].json}
 const catalog=invoke({method:'events/list',params:{}}).response.result.events,ready=catalog.find(e=>e.name==='opmx.package.ready'),preview=catalog.find(e=>e.name==='opmx.package.preview');
 assert.deepEqual(ready.payloadSchema.properties.state.enum,['READY']);assert.deepEqual(preview.payloadSchema.properties.state.enum,['OPEN']);
 const params={name:'opmx.package.preview',arguments:{queue_id:'telegram-editorial'},delivery:{mode:'webhook',url:'https://chatgpt.com/callback',secret:'whsec_example'}};
 const route=invoke({method:'events/subscribe',params});assert.equal(route.route,'telegram-events');assert.equal(route.request.body.params.name,'opmx.package.preview');
});
