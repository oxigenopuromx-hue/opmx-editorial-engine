import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assembleTelegramSource} from './assemble-source.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const id={packageId:'tg_'+'a'.repeat(40),itemId:'ti_'+'b'.repeat(40),stream:'original'};
const raw=Buffer.from('México y datos de prueba');
const build=()=>[raw.subarray(0,2),raw.subarray(2)].map((b,i)=>({status:'SOURCE_CHUNK',package_id:id.packageId,item_id:id.itemId,stream:id.stream,offset:i?2:0,bytes:b.length,total_bytes:raw.length,sha256:hash(raw),chunk_sha256:hash(b),content_base64:b.toString('base64'),next_offset:(i?2:0)+b.length,eof:i===1}));
test('reassembles raw bytes including split UTF8 and validates full original',()=>{
 assert.deepEqual(assembleTelegramSource(build(),{...id,sha256:hash(raw)}),raw);
});
test('rejects mixed identities, changed bytes, missing tail and false hash',()=>{
 const fixtures=[()=>{const c=build();c[1].item_id='ti_'+'c'.repeat(40);return c;},()=>{const c=build();c[1].content_base64='YWJj';return c;},()=>build().slice(0,1),()=>{const c=build();c[1].sha256='a'.repeat(64);return c;}];
 for(const f of fixtures)assert.throws(()=>assembleTelegramSource(f(),id));
 assert.throws(()=>assembleTelegramSource(build(),{...id,sha256:'a'.repeat(64)}));
});
