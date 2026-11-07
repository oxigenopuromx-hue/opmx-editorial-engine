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
