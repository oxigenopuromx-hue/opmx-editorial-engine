import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./mcp-owner-routing.js',import.meta.url),'utf8'),packageId='tg_'+'a'.repeat(40);
function resolve(rows,name='leer_paquete_telegram_opmx'){const envelope={body:{method:'tools/call',params:{name,arguments:{package_id:packageId}}}};return new Function('$','$input',source)(()=>({first:()=>({json:envelope})}),{all:()=>rows.map(json=>({json}))})[0].json.identity;}
test('administrator closing an operator package leaves reads attributed to the original owner',()=>{
 const rows=[{package_id:packageId,stage:'ROUTING',chat_id:'123'},{package_id:packageId,stage:'QUEUED',chat_id:'456'}];assert.deepEqual(resolve(rows),{owner:'123',chat:'123'});
});
test('conflicting or invalid owner records never select an arbitrary owner',()=>{
 assert.equal(resolve([{package_id:packageId,stage:'ROUTING',chat_id:'123'},{package_id:packageId,stage:'ROUTING',chat_id:'456'}]),null);
 assert.equal(resolve([{package_id:packageId,stage:'ROUTING',chat_id:null},{package_id:packageId,stage:'QUEUED',chat_id:'456'}]),null);
});
test('legacy entries without opening route use the unambiguous queue owner',()=>{
 assert.deepEqual(resolve([{package_id:packageId,stage:'QUEUED',chat_id:'123'}]),{owner:'123',chat:'123'});
});
test('attempt tools resolve the original owner, not the administrator editor',()=>{
 const rows=[{package_id:packageId,stage:'ROUTING',chat_id:'123'},{package_id:packageId,stage:'QUEUED',chat_id:'456'}];
 for(const name of ['iniciar_intento_telegram_opmx','bloquear_intento_telegram_opmx'])assert.deepEqual(resolve(rows,name),{owner:'123',chat:'123'});
});
