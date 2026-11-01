import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reserveDirectPublication} from './direct-claim.mjs';

const input={requestId:'request_1234567890',fingerprint:'a'.repeat(64),slug:'prueba-editorial',destinations:['OPURO','OPOL']};
function mock(failAt) { const events=[];let n=0;const c={async beginTransaction(){events.push('begin')},async execute(sql,args){events.push({sql,args});if(++n===failAt)throw Object.assign(new Error(),{code:'ER_DUP_ENTRY'})},async commit(){events.push('commit')},async rollback(){events.push('rollback')},release(){events.push('release')}};return {events,pool:{async getConnection(){return c}}}; }
test('reserva ambos destinos antes de confirmar transacción',async()=>{let m=mock();assert.deepEqual(await reserveDirectPublication(m.pool,input),{status:'claimed'});assert.equal(m.events.filter(x=>x.sql?.includes('opmx_mcp_targets')).length,2);assert.deepEqual(m.events.slice(-2),['commit','release']);});
test('conflicto en segundo destino revierte toda la reserva',async()=>{let m=mock(3);assert.equal((await reserveDirectPublication(m.pool,input)).status,'conflict_or_replay');assert.deepEqual(m.events.slice(-2),['rollback','release']);});
test('valida entrada antes de tocar la base',async()=>{let m=mock();await assert.rejects(reserveDirectPublication(m.pool,{...input,slug:'../mal'}));assert.equal(m.events.length,0);});
