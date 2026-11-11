import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {attestedControl} from './original-destination-policy.mjs';import {chooseMotorPolicy} from './motor-policy.mjs';
const reader=await readFile(new URL('./mcp-recovered-policy-reader-candidate.js',import.meta.url),'utf8');
test('Guard confirmed UPDATE survives the MCP adapter and authorizes only the same post in the Motor selector',()=>{
 const packageId='tg_'+'a'.repeat(40),revision=20,texts=[attestedControl('/borrador OPURO',packageId,100),'Fuente de prueba',attestedControl('/listo',packageId,101)];
 const items=texts.map((text_content,i)=>({item_id:'ti_'+String(i+1).repeat(40),kind:'TEXT',state:'STORED',text_content,content_bytes:Buffer.byteLength(text_content),sha256:createHash('sha256').update(text_content).digest('hex')}));
 const raw={status:'FOUND',packageId,revision,state:'READY',items,recoveredPolicy:{mode:'DRAFT',authorized:true,explicit:true,authorization:'DIRECT_MODE_COMMAND',destination:'OPURO',control_item_ids:[items[0].item_id,items[2].item_id]},confirmedCorrection:{package_id:packageId,revision,action:'UPDATE',destination:'OPURO',content_mode:'LITERAL',preview_hash:'c'.repeat(64),posts:[{destination:'OPURO',post_id:10428}]}};
 const request={id:1,action:'manifest',body:{packageId}},$=()=>({first:()=>({json:{request}})}),inventory=new Function('$','$input',reader)($,{first:()=>({json:raw})})[0].json.response.result.structuredContent;
 assert.equal(inventory.confirmed_correction.action,'UPDATE');assert.equal(inventory.confirmed_correction.posts[0].post_id,10428);
 const sources=items.map(i=>({item_id:i.item_id,stream:'text',bytes:Buffer.from(i.text_content)})),policy=chooseMotorPolicy(inventory,sources,{packageId,revision});
 assert.equal(policy.mode,'UPDATE');assert.equal(policy.action,'UPDATE');assert.equal(policy.content_mode,'LITERAL');assert.deepEqual(policy.posts,[{destination:'OPURO',post_id:10428}]);assert.equal(policy.confirmed_preview_hash,raw.confirmedCorrection.preview_hash);
});
