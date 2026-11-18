import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDuplicateCancellation} from './duplicate-cancellation.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const actor=hash('opmx:telegram:v1:111:111'),pkg='tg_'+'a'.repeat(40);
function fixture(over={}){
 const state={pack:{package_id:pkg,owner_key:actor,state:'OPEN',revision:9},session:{owner_key:actor,package_id:pkg},lease:{actor_key:actor,owner_key:actor,receipt_id:'telegram-111-300-55',opening_revision:9},fence:'RECOVERY_FENCED',attempt:'REVOKED',pending:false,currentEvent:false,audit:null,materials:['sha1','sha2'],...over};let draft,tx=false;
 const c={async beginTransaction(){draft=structuredClone(state);tx=true},async rollback(){tx=false},async commit(){Object.assign(state,draft);tx=false},release(){},async execute(sql,args=[]){let s=draft;if(sql.includes('FROM opmx_tg_quota_v1'))return [[{id:1}]];
 if(sql.includes('FROM opmx_tg_packages_v1'))return [[s.pack]];
 if(sql.includes('SELECT package_id,revision,actor_key,owner_key,receipt_key,reason'))return [s.audit?[s.audit]:[]];
 if(sql.startsWith('SELECT')&&sql.includes('FROM opmx_tg_sessions_v1'))return [s.session&&s.session.owner_key===args[0]?[s.session]:[]];
 if(sql.startsWith('SELECT')&&sql.includes('FROM opmx_tg_recovery_leases_v1'))return [s.lease?[s.lease]:[]];
 if(sql.includes('SELECT state FROM opmx_tg_publication_fence_v1'))return [s.fence?[{state:s.fence}]:[]];
 if(sql.includes('SELECT state FROM opmx_tg_motor_attempts_v1'))return [s.attempt?[{state:s.attempt}]:[]];
 if(sql.includes('FROM opmx_tg_items_v1'))return [s.pending?[{item_id:'pending'}]:[]];
 if(sql.includes('SELECT revision FROM opmx_tg_preview_generation_v1'))return [s.previewJob?[{revision:9}]:[]];
 if(sql.includes('SELECT revision FROM opmx_tg_'))return [s.currentEvent?[{revision:9}]:[]];
 if(sql.startsWith('INSERT INTO opmx_tg_duplicate')){s.audit={package_id:args[0],revision:args[1],actor_key:args[2],owner_key:args[3],receipt_key:args[4],reason:'DUPLICATE'};return [{affectedRows:1}]}
 if(sql.startsWith('UPDATE opmx_tg_packages')){s.pack.state='CANCELLED';return [{affectedRows:1}]}
 if(sql.startsWith('DELETE FROM opmx_tg_sessions')){if(s.failSessionRelease)throw Error('injected session release failure');s.session=null;return [{affectedRows:1}]}
 if(sql.startsWith('DELETE FROM opmx_tg_recovery_leases')){s.lease=null;return [{affectedRows:1}]}
 throw Error(sql)}};
 return {state,run:createDuplicateCancellation({pool:{async getConnection(){return c}}}),get tx(){return tx}};
}
const req={owner:'111',chat:'111',packageId:pkg,revision:9,receiptId:'telegram-111-301-56'};
{
 const f=fixture();let r=await f.run(req);assert.equal(r.status,'CANCELLED');assert.equal(f.state.pack.state,'CANCELLED');assert.equal(f.state.pack.revision,9);assert.equal(f.state.session,null);assert.equal(f.state.lease,null);assert.deepEqual(f.state.materials,['sha1','sha2']);assert.equal(f.state.audit.reason,'DUPLICATE');assert.equal((await f.run(req)).status,'CANCELLED_REPLAY');assert.equal((await f.run({...req,receiptId:'telegram-111-302-57'})).status,'CANCELLATION_CONFLICT');
}
for(const [over,status] of [[{previewJob:true},'RECONCILIATION_REQUIRED'],[{pending:true},'PENDING_RESERVATION'],[{currentEvent:true},'RECONCILIATION_REQUIRED'],[{fence:'WRITING'},'RECONCILIATION_REQUIRED'],[{attempt:'RUNNING'},'RECONCILIATION_REQUIRED'],[{session:null},'NO_EDIT_SESSION']]){const f=fixture(over);assert.equal((await f.run(req)).status,status);assert.equal(f.state.pack.state,'OPEN');assert.equal(f.state.audit,null);assert.deepEqual(f.state.materials,['sha1','sha2'])}
{const f=fixture();assert.equal((await f.run({...req,revision:8})).status,'STALE_REVISION');assert.equal((await f.run({...req,owner:'222'})).status,'INVALID_CANCELLATION');assert.equal((await f.run({...req,receiptId:'telegram-111-299-54'})).status,'NOT_AVAILABLE');assert.equal(f.state.pack.state,'OPEN')}
{const f=fixture({lease:null});assert.equal((await f.run(req)).status,'CANCELLED');assert.equal(f.state.session,null)}
{const f=fixture({failSessionRelease:true});await assert.rejects(f.run(req),/CANCELLATION_UNCONFIRMED/);assert.equal(f.state.pack.state,'OPEN');assert.equal(f.state.audit,null);assert.notEqual(f.state.session,null);assert.notEqual(f.state.lease,null);assert.deepEqual(f.state.materials,['sha1','sha2']);assert.equal(f.tx,false)}
console.log('PASS: transacción simulada, rollback, reapertura cercada, sesión, originales, replay y rechazos');
