import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createMotorAttemptStore} from '../../tools/telegram/guard-recovery-candidate/motor-attempt-store.mjs';
const packageId='tg_'+'a'.repeat(40), eventId='evt_'+'b'.repeat(48), token='c'.repeat(64), previewHash='d'.repeat(64), revision=20;
const input={packageId,eventId,token,previewHash,revision,action:'CREATE',contentMode:'EDITORIAL',destination:'AMBOS'};
let state='AWAITING_DECISION', attempt='RUNNING', decision={package_id:packageId,revision,preview_hash:previewHash,action:'CREATE',content_mode:'EDITORIAL',destination:'AMBOS'}, updated=0;
const c={async beginTransaction(){},async commit(){},async rollback(){},release(){},async execute(sql){if(sql.startsWith('SELECT id FROM opmx_tg_quota'))return [[{id:1}]];if(sql.startsWith('SELECT state,revision FROM opmx_tg_packages'))return [[{state:'READY',revision}]];if(sql.startsWith('SELECT state,event_id,token_hash FROM opmx_tg_motor'))return [[{state:attempt,event_id:eventId,token_hash:createHash('sha256').update(token).digest('hex')}]];if(sql.startsWith('SELECT state FROM opmx_tg_publication_fence'))return [[{state}]];if(sql.startsWith('UPDATE opmx_tg_publication_fence')){assert.equal(state,'AWAITING_DECISION');state='READY_TO_WRITE';updated++;return [{affectedRows:1}]};throw Error('Unexpected query '+sql)}};
const store=createMotorAttemptStore({pool:{async getConnection(){return c}},readDecision:async()=>decision});
assert.equal((await store.acknowledgeDecision(input)).status,'DECISION_ACKNOWLEDGED');assert.equal(updated,1);
assert.equal((await store.acknowledgeDecision(input)).replayed,true);assert.equal(updated,1);
assert.equal((await store.acknowledgeDecision({...input,previewHash:'e'.repeat(64)})).status,'DECISION_MISMATCH');
assert.equal((await store.acknowledgeDecision({...input,token:'e'.repeat(64)})).status,'ATTEMPT_NOT_AUTHORIZED');
for(const s of ['WRITING','RECONCILING','RECOVERY_FENCED']){state=s;assert.equal((await store.acknowledgeDecision(input)).status,'DECISION_ACK_NOT_PERMITTED')}
state='READY_TO_WRITE';attempt='BLOCKED';assert.equal((await store.acknowledgeDecision(input)).status,'ATTEMPT_NOT_AUTHORIZED');
attempt='RUNNING';decision={...decision,content_mode:'LITERAL'};assert.equal((await store.acknowledgeDecision({...input,contentMode:'LITERAL'})).status,'LITERAL_ENFORCEMENT_UNCONFIRMED');
console.log('ACK inicial y repetición exacta; rechazos por token, decisión, escritura, bloqueo y literal verificados');
