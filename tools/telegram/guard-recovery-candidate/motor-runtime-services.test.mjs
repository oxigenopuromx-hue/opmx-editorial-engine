import test from 'node:test';import assert from 'node:assert/strict';
import {prepareMotorRuntimeServices} from './motor-runtime-services.mjs';
test('attempt and receipt schemas initialize before the service becomes available',async()=>{
 const statements=[];let transactions=0;const c={release(){},async execute(sql){statements.push(sql);return [[]]},async beginTransaction(){transactions++;throw Error('unexpected transaction')}};
 const services=await prepareMotorRuntimeServices({pool:{getConnection:async()=>c},secret:'a'.repeat(64)});assert.equal(statements.length,2);assert.ok(statements.every(s=>s.startsWith('CREATE TABLE IF NOT EXISTS')));assert.equal(transactions,0);assert.equal(typeof services.telegramAttempts.complete,'function');assert.equal(typeof services.telegramWriterReceipts.report,'function');assert.equal(typeof services.initializeMotorAttempt,'function');assert.equal(services.telegramRecovery,undefined);
});
test('failed schema initialization never returns partially active attempt hooks',async()=>{await assert.rejects(()=>prepareMotorRuntimeServices({pool:{getConnection:async()=>({release(){},async execute(){throw Error('SCHEMA_FAILED')}})},secret:'a'.repeat(64)}),/SCHEMA_FAILED/)});
