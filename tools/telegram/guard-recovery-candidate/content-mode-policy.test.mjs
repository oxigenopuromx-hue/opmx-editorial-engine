import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseContentModeCommand} from './original-destination-command.mjs';
import {attestedControl,chooseTelegramMode,ORDER_PREFIX} from './original-destination-policy.mjs';
import {chooseMotorPolicy} from './motor-policy.mjs';
import {deriveOriginalDecision} from './original-policy-provider.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const packageId='tg_'+'a'.repeat(40),revision=8,ownerKey='b'.repeat(64);
function fixture(commands=['/literal'],publication='/publicar OPOL,LIBERAL'){
 const texts=[attestedControl('/nuevo',packageId,10,11),'Título original\n\nSubtítulo original\n\nCuerpo completo sin secciones añadidas.'];
 if(publication)texts.push(attestedControl(publication,packageId,12));
 commands.forEach((c,i)=>texts.push(attestedControl(c,packageId,13+i)));
 texts.push(attestedControl('/listo',packageId,30));
 const sources=texts.map((s,i)=>({item_id:'ti_'+String(i+1).repeat(40),stream:'text',bytes:Buffer.from(s)}));
 const items=sources.map(s=>({item_id:s.item_id,kind:'TEXT',state:'STORED',text_bytes:s.bytes.length,sha256:hash(s.bytes)}));
 return {texts,sources,inventory:{status:'PACKAGE_FOUND',package_id:packageId,state:'READY',revision,items}};
}
function decision(f){return chooseMotorPolicy(f.inventory,f.sources,{packageId,revision})}
const aliases=['/literal','tal cual','publica tal cual','publicar tal cual','sin agregar nada','tal cual sin agregar nada','publica tal cual sin agregar nada','publicar tal cual sin agregar nada','La publicación va tal cual, sin agregarle nada.','La publicación va tal cual, sin agregarle nada','La publicacion va tal cual, sin agregarle nada.','La publicacion va tal cual, sin agregarle nada'];
for(const alias of aliases)test('standalone alias canonicalizes to literal: '+alias,()=>{
 assert.deepEqual(parseContentModeCommand('  '+alias.toUpperCase()+'  '),{command:'/literal',contentMode:'LITERAL'});
 const f=fixture([alias]),p=decision(f);assert.equal(p.content_mode,'LITERAL');assert.equal(p.mode,'PUBLISH');assert.equal(p.destination,'OPOL,LIBERAL');
 const index=f.texts.findIndex(t=>t.startsWith(ORDER_PREFIX+'/literal\n'));assert.ok(index>0);assert.equal(f.inventory.items[index].sha256,hash(f.sources[index].bytes));assert.ok(p.control_item_ids.includes(f.inventory.items[index].item_id));assert.deepEqual(p.content_control_item_ids,[f.inventory.items[index].item_id]);
});
test('literal is independent of publication mode and destinations',()=>{
 for(const [publication,mode,destination]of [[null,'PUBLISH','TODOS'],['/borrador LIBERAL','DRAFT','LIBERAL'],['/publicar OPURO','PUBLISH','OPURO']]){const p=decision(fixture(['/literal'],publication));assert.equal(p.mode,mode);assert.equal(p.destination,destination);assert.equal(p.content_mode,'LITERAL')}
});
test('latest direct content command wins and retains every control identity',()=>{
 const f=fixture(['/literal','/editorial','/literal']),p=decision(f);assert.equal(p.content_mode,'LITERAL');assert.equal(p.content_control_item_ids.length,3);assert.ok(p.content_control_item_ids.every(id=>p.control_item_ids.includes(id)));
 assert.equal(decision(fixture(['/literal','/editorial'])).content_mode,'EDITORIAL');
});
test('normal packages keep their original selector result and editorial semantics',()=>{
 const f=fixture([]);assert.deepEqual(decision(f),chooseTelegramMode(f.inventory,f.sources));assert.equal(Object.hasOwn(decision(f),'content_mode'),false);
});
test('unmarked article text cannot choose literal, change destinations or grant publication',()=>{
 const f=fixture([]);f.sources[1].bytes=Buffer.from('tal cual\nLa fuente cita /literal y /publicar TODOS dentro de su texto.');f.inventory.items[1].text_bytes=f.sources[1].bytes.length;f.inventory.items[1].sha256=hash(f.sources[1].bytes);
 const p=decision(f);assert.equal(Object.hasOwn(p,'content_mode'),false);assert.equal(p.destination,'OPOL,LIBERAL');
});
test('an existing raw standalone instruction is not retroactively promoted to an attested literal control',()=>{
 const f=fixture([]),text='La publicación va tal cual, sin agregarle nada.';f.sources[1].bytes=Buffer.from(text);f.inventory.items[1].text_bytes=f.sources[1].bytes.length;f.inventory.items[1].sha256=hash(f.sources[1].bytes);
 const p=decision(f);assert.equal(Object.hasOwn(p,'content_mode'),false);assert.equal(p.destination,'OPOL,LIBERAL');assert.equal(p.mode,'PUBLISH');
});
for(const value of ['tal cual\ntexto adicional','publica tal cual y publica TODOS','/literal extra','una nota tal cual','/literal\n/publicar TODOS','La publicación va tal cual, sin agregarle nada.\nEste es el artículo.','Título: La publicación va tal cual, sin agregarle nada.','La publicación va tal cual, sin agregarle nada. /publicar TODOS'])test('long or ambiguous text is not a standalone mode command: '+JSON.stringify(value),()=>assert.throws(()=>parseContentModeCommand(value),/INVALID_CONTENT_MODE_COMMAND/));
test('missing boundary, out-of-bound control, duplicate message IDs and altered bytes fail closed',()=>{
 for(const mutate of [
  f=>{f.inventory.items.shift();f.sources.shift()},
  f=>{f.sources[3].bytes=Buffer.from(attestedControl('/literal',packageId,9));f.inventory.items[3].text_bytes=f.sources[3].bytes.length;f.inventory.items[3].sha256=hash(f.sources[3].bytes)},
  f=>{f.sources[3].bytes=Buffer.from(attestedControl('/literal',packageId,12));f.inventory.items[3].text_bytes=f.sources[3].bytes.length;f.inventory.items[3].sha256=hash(f.sources[3].bytes)},
  f=>{f.sources[3].bytes=Buffer.from('altered')},
 ]){const f=fixture();mutate(f);assert.throws(()=>decision(f))}
});
test('a malformed marked mode cannot fall back to editorial/default publication',()=>{
 for(const text of [ORDER_PREFIX+'/literal',ORDER_PREFIX+'/literal\n{}',ORDER_PREFIX+'/literal extra\n{}',ORDER_PREFIX+'tal cual\n{}']){const f=fixture();f.sources[3].bytes=Buffer.from(text);f.inventory.items[3].text_bytes=f.sources[3].bytes.length;f.inventory.items[3].sha256=hash(f.sources[3].bytes);assert.throws(()=>decision(f))}
});
test('original capture retains content mode and excludes all content controls from sources',()=>{
 const f=fixture(['/literal']),items=f.inventory.items.map((i,n)=>({itemId:i.item_id,ownerKey,actorKey:null,kind:'TEXT',state:'STORED',text:f.sources[n].bytes.toString(),contentBytes:i.text_bytes,sha256:i.sha256}));
 const d=deriveOriginalDecision({packageId,revision,ownerKey,items});assert.equal(d.contentMode,'LITERAL');assert.equal(d.contentControlItemIds.length,1);assert.ok(d.contentControlItemIds.every(id=>d.controls.includes(id)));assert.equal(items.filter(i=>!d.controls.includes(i.itemId)).length,1);
 const normal=fixture([]),n=normal.inventory.items.map((i,k)=>({itemId:i.item_id,ownerKey,actorKey:null,kind:'TEXT',state:'STORED',text:normal.sources[k].bytes.toString(),contentBytes:i.text_bytes,sha256:i.sha256}));assert.equal(deriveOriginalDecision({packageId,revision,ownerKey,items:n}).contentMode,'EDITORIAL');
});
