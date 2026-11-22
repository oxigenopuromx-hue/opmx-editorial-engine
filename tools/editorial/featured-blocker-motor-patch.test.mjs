import test from 'node:test';import assert from 'node:assert/strict';import {patchMotorFeaturedBlockers as patch} from './featured-blocker-motor-patch.mjs';
const text='before\nPara comunicar el bloqueo usa la MISMA herramienta informar_revision_telegram_opmx, blah\nPUBLISHER_REJECTED_BEFORE_WRITE requiere una respuesta explícita blah\n46 PUBLISHER_PERMISSION_DENIED_LIBERAL\nafter';
test('preserves encoding and only inserts evidence-based mapping',()=>{const out=patch(text,'a'.repeat(40));assert.match(out,/1099511627776/);assert.match(out,/featuredDiagnosticFromPreflight/);assert.ok(out.endsWith('after'))});
test('rejects changed prompt or unpinned code',()=>{assert.throws(()=>patch('missing','a'.repeat(40)),/CHANGED/);assert.throws(()=>patch(text,'main'),/INVALID/)});
