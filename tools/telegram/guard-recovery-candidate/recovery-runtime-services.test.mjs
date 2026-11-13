import test from 'node:test';import assert from 'node:assert/strict';
import {prepareRecoveryRuntimeServices} from './recovery-runtime-services.mjs';
const secret='a'.repeat(64),id='tg_'+'b'.repeat(40),owner='123456';
function fixture(){const sql=[];const c={async execute(q){sql.push(q);return [q.startsWith('SELECT id FROM opmx_tg_quota')?[{id:1}]:[]]},async beginTransaction(){sql.push('BEGIN')},async commit(){sql.push('COMMIT')},async rollback(){sql.push('ROLLBACK')},release(){}};const events={async initialize(){},async enqueue(){throw Error('NO_EVENT_EXPECTED')},async run(){},start(){throw Error('NO_SECOND_CONSUMER')},stop(){}};return {sql,pool:{getConnection:async()=>c},events,reviews:{async run(){}}}}
test('recovery composition installs only required schemas outside a request transaction',async()=>{
 const f=fixture(),s=await prepareRecoveryRuntimeServices({...f,secret,adminUserIds:[owner],readWordPress:async()=>{throw Error('NO_CMS_READ_EXPECTED')}});
 assert.deepEqual(f.sql.filter(q=>q.startsWith('CREATE TABLE')).map(s=>s.match(/CREATE TABLE IF NOT EXISTS ([a-z0-9_]+)/)?.[1]).sort(),['opmx_tg_confirmed_decisions_v1','opmx_tg_update_claims_v1','opmx_tg_update_payloads_v1','opmx_tg_update_deliveries_v1','opmx_tg_literal_payloads_v1','opmx_tg_editorial_placements_v1'].sort());assert.equal(f.sql.includes('BEGIN'),false);assert.equal(typeof s.telegramRecovery,'function');assert.equal(typeof s.telegramUpdateDeliveries.consume,'function');assert.equal(typeof s.telegramAttempts.complete,'function');
});
test('unknown package and job cannot reopen, stage, update or enqueue',async()=>{
 const f=fixture(),s=await prepareRecoveryRuntimeServices({...f,secret,adminUserIds:[owner],readWordPress:async()=>{throw Error('NO_CMS_READ_EXPECTED')}});f.sql.length=0;
 assert.equal((await s.telegramRecovery({owner,chat:owner,packageId:id,receiptId:'telegram-123456-2-2'})).status,'NOT_FOUND');
 assert.equal((await s.telegramAttempts.start({owner,chat:owner,packageId:id,revision:2})).status,'ATTEMPT_NOT_REGISTERED');
 assert.equal((await s.telegramUpdateDeliveries.consume({jobId:'uj_'+'e'.repeat(48),token:'f'.repeat(64)})).status,'UPDATE_DELIVERY_UNCONFIRMED');
 assert.equal((await s.telegramUpdateExecutor.execute({owner,chat:owner,packageId:id,revision:2,destination:'OPURO',previewHash:'f'.repeat(64)})).status,'UPDATE_NOT_READY');
 assert.equal(f.sql.some(q=>/^(INSERT|UPDATE|DELETE)/.test(q)),false);
});
