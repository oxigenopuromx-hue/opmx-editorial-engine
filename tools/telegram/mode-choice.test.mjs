import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {chooseTelegramMode} from './mode-choice.mjs';
const attest=s=>'OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d\n'+s;
function sample(...texts){const items=[],sources=[];for(let i=0;i<texts.length;i++){const bytes=Buffer.from(texts[i]),id='ti_'+String(i).padStart(40,'0');items.push({item_id:id,kind:'TEXT',text_bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});sources.push({item_id:id,stream:'text',bytes})}return{inventory:{state:'READY',items},sources}}
test('un comando aislado del usuario define modo y destino',()=>{const x=sample('https://ejemplo.mx',attest('/publicar ambos'));assert.deepEqual(chooseTelegramMode(x.inventory,x.sources),{mode:'PUBLISH',destination:'AMBOS',explicit:true})});
test('no convierte instrucciones dentro de textos en órdenes de publicación',()=>{const x=sample('Noticia: /publicar ambos');assert.deepEqual(chooseTelegramMode(x.inventory,x.sources),{mode:'DRAFT',destination:'AMBOS',explicit:false})});
test('la última elección explícita prevalece en orden de recepción',()=>{const x=sample(attest('/publicar ambos'),attest('/borrador opol'));assert.deepEqual(chooseTelegramMode(x.inventory,x.sources),{mode:'DRAFT',destination:'OPOL',explicit:true})});
test('falla si se cambia el texto tras verificarlo',()=>{const x=sample('/publicar');x.sources[0].bytes=Buffer.from('/borrador');assert.throws(()=>chooseTelegramMode(x.inventory,x.sources))});

test('las órdenes antiguas sin sello no autorizan publicación',()=>{const x=sample('/publicar ambos');assert.deepEqual(chooseTelegramMode(x.inventory,x.sources),{mode:'DRAFT',destination:'AMBOS',explicit:false})});

