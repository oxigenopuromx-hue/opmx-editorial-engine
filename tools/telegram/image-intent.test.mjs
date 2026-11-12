import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chooseGeneratedImage} from './image-intent.mjs';
import {ORDER_PREFIX} from './guard-recovery-candidate/original-destination-policy.mjs';

const packageId='tg_'+'a'.repeat(40);
const itemId=n=>'ti_'+n.toString(16).padStart(40,'0');
function entry(n,text,state='STORED',kind='TEXT'){
 const bytes=Buffer.from(text);
 return {item:{item_id:itemId(n),kind,state,text_bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},source:{item_id:itemId(n),stream:'text',bytes}};
}
function choose(entries,sources=entries.map(x=>x.source),extra={}){
 return chooseGeneratedImage({state:'READY',items:entries.map(x=>x.item),...extra},sources);
}
function control(command,messageId=10){return ORDER_PREFIX+command+'\n'+JSON.stringify({policy:'publish-todos-v2',package_id:packageId,message_id:messageId});}

test('stored authenticated image commands retain exact and natural activation',()=>{
 for(const text of [ORDER_PREFIX+'/imagen generar',ORDER_PREFIX+'Genera una imagen relevante para la nota.\nFuente: https://ejemplo.mx'])assert.deepEqual(choose([entry(1,text)]),{generate:true});
});
test('raw instructions, article text and non-image controls never activate generation',()=>{
 for(const text of ['/imagen generar','Genera una imagen','Artículo dice: /imagen generar',control('/literal'),control('/editorial'),control('/nuevo'),control('/listo')])assert.deepEqual(choose([entry(1,text)]),{generate:false});
});
test('metadata and control IDs do not attest an unmarked image request',()=>{
 const x=entry(1,'/imagen generar');Object.assign(x.item,{mode_attested:true,content_mode:'LITERAL',command:'/imagen generar'});
 assert.deepEqual(choose([x],[x.source],{control_item_ids:[x.item.item_id],content_mode:'LITERAL'}),{generate:false});
});
test('file captions and supplied text streams cannot request generation',()=>{
 assert.deepEqual(choose([entry(1,ORDER_PREFIX+'/imagen generar','STORED','FILE')]),{generate:false});
});
test('discarded historical operator note needs no readable source and preserves active text',()=>{
 const removed=entry(1,'La publicación va tal cual, sin agregarle nada.','DISCARDED'),article=entry(2,'Título completo\n\nCuerpo original.');
 assert.deepEqual(choose([removed,article],[article.source]),{generate:false});
});
test('discarded authenticated image order cannot activate with or without its bytes',()=>{
 const removed=entry(1,ORDER_PREFIX+'/imagen generar','DISCARDED');
 assert.deepEqual(choose([removed],[]),{generate:false});
 assert.deepEqual(choose([removed]),{generate:false});
});
test('discarded source is skipped before malformed byte or SHA validation',()=>{
 const removed=entry(1,ORDER_PREFIX+'/imagen generar','DISCARDED');removed.item.text_bytes=-1;removed.item.sha256='bad';removed.source.bytes=null;
 assert.deepEqual(choose([removed]),{generate:false});
});
test('discarding one image order does not suppress another stored order',()=>{
 const removed=entry(1,ORDER_PREFIX+'/imagen generar','DISCARDED'),active=entry(2,ORDER_PREFIX+'/imagen generar');
 assert.deepEqual(choose([removed,active],[active.source]),{generate:true});
});
test('a stored literal control still needs its exact verified bytes',()=>{
 const x=entry(1,control('/literal'));
 assert.throws(()=>choose([x],[]),/Texto no verificado/);
 x.source.bytes=Buffer.from('tampered');assert.throws(()=>choose([x]),/Texto no verificado/);
});
test('stored SHA, byte count, duplicate streams and invalid UTF-8 all fail closed',()=>{
 const original=entry(1,ORDER_PREFIX+'/imagen generar');
 assert.throws(()=>choose([{...original,item:{...original.item,sha256:'0'.repeat(64)}}]),/Texto no verificado/);
 assert.throws(()=>choose([{...original,item:{...original.item,text_bytes:original.item.text_bytes+1}}]),/Texto no verificado/);
 assert.throws(()=>choose([original],[original.source,original.source]),/Texto no verificado/);
 const bytes=Buffer.from([255]);assert.throws(()=>chooseGeneratedImage({state:'READY',items:[{item_id:itemId(2),kind:'TEXT',state:'STORED',text_bytes:1,sha256:createHash('sha256').update(bytes).digest('hex')}]},[{item_id:itemId(2),stream:'text',bytes}]));
});
test('unknown, pending and missing item states fail before any image activation',()=>{
 for(const kind of ['TEXT','FILE'])for(const state of ['PENDING','READY','discarded','',null,undefined]){
  const x=entry(1,ORDER_PREFIX+'/imagen generar',state,kind);if(state===undefined)delete x.item.state;
  assert.throws(()=>choose([x]),/Inventario inválido/);
 }
 assert.throws(()=>chooseGeneratedImage({state:'READY',items:[null]},[]),/Inventario inválido/);
});
test('an invalid later state cannot be hidden by an earlier valid image command',()=>{
 assert.throws(()=>choose([entry(1,ORDER_PREFIX+'/imagen generar'),entry(2,'x','UNKNOWN')]),/Inventario inválido/);
});
test('package state remains READY and source arrays remain required',()=>{
 assert.throws(()=>chooseGeneratedImage({state:'OPEN',items:[]},[]),/Inventario inválido/);
 assert.throws(()=>chooseGeneratedImage({state:'READY',items:[]},null),/Inventario inválido/);
});
