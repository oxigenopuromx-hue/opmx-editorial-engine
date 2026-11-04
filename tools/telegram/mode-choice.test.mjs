import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chooseTelegramMode} from './mode-choice.mjs';
const attest = s => 'OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d\n' + s;
function sample(...texts) {
  const sources = [], items = texts.map((text, i) => { const bytes = Buffer.from(text); const id = 'ti_' + String(i).padStart(40, '0'); sources.push({item_id:id, stream:'text', bytes}); return {item_id:id, kind:'TEXT', text_bytes:bytes.length, sha256:createHash('sha256').update(bytes).digest('hex')}; });
  return { inventory:{state:'READY',items}, sources };
}
const choose = (...x) => { const s=sample(...x); return chooseTelegramMode(s.inventory,s.sources); };
test('nuevo y listo acreditados aplican publicación en ambos',()=>assert.deepEqual(choose(attest('/nuevo'),'nota',attest('/listo')),{mode:'PUBLISH',destination:'AMBOS',explicit:true}));
test('una elección de borrador prevalece sobre el cierre',()=>assert.deepEqual(choose(attest('/nuevo'),attest('/borrador opol'),attest('/listo')),{mode:'DRAFT',destination:'OPOL',explicit:true}));
test('destino explícito prevalece',()=>assert.deepEqual(choose(attest('/nuevo'),attest('/publicar opuro'),attest('/listo')),{mode:'PUBLISH',destination:'OPURO',explicit:true}));
test('paquetes antiguos no se publican por defecto',()=>assert.deepEqual(choose('nota',attest('/listo')),{mode:'DRAFT',destination:'AMBOS',explicit:false}));
test('sin cierre acreditado no se publica por defecto',()=>assert.deepEqual(choose(attest('/nuevo'),'nota','/listo'),{mode:'DRAFT',destination:'AMBOS',explicit:false}));
test('texto después del cierre no autoriza el valor predeterminado',()=>assert.deepEqual(choose(attest('/nuevo'),attest('/listo'),'nota'),{mode:'DRAFT',destination:'AMBOS',explicit:false}));
test('órdenes antiguas no acreditadas no autorizan',()=>assert.deepEqual(choose('/publicar ambos'),{mode:'DRAFT',destination:'AMBOS',explicit:false}));
test('detecta texto alterado',()=>{const s=sample(attest('/nuevo'),attest('/listo'));s.sources[1].bytes=Buffer.from('/borrador');assert.throws(()=>chooseTelegramMode(s.inventory,s.sources));});
