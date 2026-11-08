import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createBlockedList} from './blocked-list.mjs';
const pkg='tg_'+'a'.repeat(40),hash=x=>createHash('sha256').update(x).digest('hex');
function setup(rows=[{package_id:pkg,revision:7}]){let calls=[];const pool={async getConnection(){return {async execute(sql,args){calls.push({sql,args});return [rows]},release(){}}}};return {calls,list:createBlockedList({pool,adminUserIds:['456']})}}
test('operator list is scoped to the authenticated owner and returns identifiers only',async()=>{
 const f=setup(),out=await f.list({owner:'123',chat:'123'});
 assert.deepEqual(out,{status:'BLOCKED_LIST',packages:[{packageId:pkg,revision:7}],more:false});
 assert.ok(f.calls[0].sql.includes('p.owner_key=?'));assert.deepEqual(f.calls[0].args,[hash('opmx:telegram:v1:123:123')]);
});
test('configured administrator can list without an owner filter',async()=>{
 const f=setup();assert.equal((await f.list({owner:'456',chat:'456'})).status,'BLOCKED_LIST');assert.ok(!f.calls[0].sql.includes('p.owner_key=?'));assert.deepEqual(f.calls[0].args,[]);
});
test('spoofed identity, extra filters and malformed database results fail closed',async()=>{
 const f=setup();assert.equal((await f.list({owner:'123',chat:'456'})).status,'INVALID_REQUEST');
 assert.equal((await f.list({owner:'123',chat:'123',admin:true})).status,'INVALID_REQUEST');assert.equal(f.calls.length,0);
 await assert.rejects(()=>setup([{package_id:'bad',revision:1}]).list({owner:'123',chat:'123'}),/BLOCKED_LIST_UNCONFIRMED/);
});
