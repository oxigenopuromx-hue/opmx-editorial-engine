import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRecoveryMysqlAdapter,recoverySchema} from './reopen-mysql-adapter.mjs';
import {createReopenService} from './reopen-service.mjs';
const id='tg_'+'a'.repeat(40), key=createHash('sha256').update('opmx:telegram:v1:123:123').digest('hex');
const req={owner:'123',chat:'123',packageId:id,receiptId:'telegram-123-1-2'};
function setup({barrier=false,missingRevision=false,failAt=''}={}){
  const calls=[];
  const c={async beginTransaction(){calls.push('BEGIN')},async commit(){calls.push('COMMIT')},async rollback(){calls.push('ROLLBACK')},release(){calls.push('RELEASE')},async execute(sql,args){
    calls.push({sql,args});if(failAt&&sql.includes(failAt))throw Error('FAULT');
    if(sql.includes('FROM opmx_tg_quota'))return [[{id:1}]];
    if(sql.includes('FROM opmx_tg_packages'))return [[{package_id:id,owner_key:key,state:'READY',revision:7}]];
    if(sql.includes('FROM opmx_tg_sessions')||sql.includes('FROM opmx_tg_recovery_leases'))return [[]];
    if(sql.includes('FROM opmx_tg_items'))return [[{item_id:'ti_1',owner_key:key,receipt_key:'r',fingerprint:'f',kind:'TEXT',state:'STORED',text_content:'source',attachment_json:null,reserved_bytes:6,content_bytes:6,sha256:'hash'}]];
    if(sql.startsWith('UPDATE'))return [{affectedRows:1}];
    if(sql.startsWith('INSERT'))return [{affectedRows:1}];
    throw Error('UNEXPECTED_QUERY');
  }};
  const options=barrier?{lockTrustedSafetyBarrier:async()=>({id:'b',packageId:id,revision:7,terminalBlocked:true,noActiveAttempts:true,noPublicationSideEffects:true,writesFenced:true}),captureTrustedRevision:async()=>({packageId:id,revision:7,ownerKey:key,requestId:'req-7',destinations:['OPURO','OPOL','LIBERAL'],authorization:{mode:'PUBLISH',authorized:true},controls:['control-1'],results:[{destination:'OPURO',status:'BLOCKED'},{destination:'OPOL',status:'BLOCKED'},{destination:'LIBERAL',status:'BLOCKED'}]})}:{};
  if(missingRevision)delete options.captureTrustedRevision;
  return {calls,service:createReopenService({db:createRecoveryMysqlAdapter({async getConnection(){return c}},options)})};
}
test('adapter refuses to reopen without a server-owned evidence provider',async()=>{const {calls,service}=setup();assert.equal((await service(req)).status,'RECONCILIATION_REQUIRED');assert.ok(calls.includes('COMMIT'));assert.equal(calls.filter(c=>typeof c==='object'&&/^(INSERT|UPDATE)/.test(c.sql)).length,0);});
test('a barrier alone cannot reopen when trusted prior metadata is unavailable',async()=>{const {calls,service}=setup({barrier:true,missingRevision:true});assert.equal((await service(req)).status,'RECONCILIATION_REQUIRED');assert.equal(calls.filter(c=>typeof c==='object'&&/^(INSERT|UPDATE)/.test(c.sql)).length,0);});
test('trusted provider drives parameterized snapshot and state writes within one transaction',async()=>{const {calls,service}=setup({barrier:true});assert.equal((await service(req)).status,'OPEN');const snapshot=calls.find(c=>c.sql?.startsWith('INSERT INTO opmx_tg_revision_snapshots'));assert.equal(snapshot.args[0],id);const saved=JSON.parse(snapshot.args[3]);assert.equal(saved.items[0].text,'source');assert.equal(saved.prior.requestId,'req-7');assert.deepEqual(saved.prior.destinations,['OPURO','OPOL','LIBERAL']);assert.equal(saved.prior.authorization.mode,'PUBLISH');assert.equal(saved.prior.results.length,3);assert.ok(calls.some(c=>c.sql?.includes("state='READY'")));assert.ok(calls.includes('COMMIT'));assert.equal(calls.at(-1),'RELEASE');});
test('a failed session insert rolls the transaction back',async()=>{const {calls,service}=setup({barrier:true,failAt:'INSERT INTO opmx_tg_sessions'});await assert.rejects(service(req),/FAULT/);assert.ok(calls.includes('ROLLBACK'));assert.ok(!calls.includes('COMMIT'));assert.equal(calls.at(-1),'RELEASE');});
test('schema is returned explicitly and caller cannot mutate the stored copy',()=>{const first=recoverySchema();assert.equal(first.length,4);first.pop();assert.equal(recoverySchema().length,4);});
