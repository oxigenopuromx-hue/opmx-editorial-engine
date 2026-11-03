import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareDraftHandoff} from './draft-handoff.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const pkg='tg_'+'a'.repeat(40), file='ti_'+'b'.repeat(40), text='ti_'+'c'.repeat(40);
function example(){
 const photo=Buffer.from('foto'), caption=Buffer.from('hero'), words=Buffer.from('fuente');
 return {revision:5,destination:'AMBOS',inventory:{package_id:pkg,state:'READY',revision:5,items:[
  {item_id:file,kind:'FILE',state:'STORED',original_bytes:photo.length,text_bytes:caption.length,sha256:hash(photo)},
  {item_id:text,kind:'TEXT',state:'STORED',text_bytes:words.length,sha256:hash(words)}]},sources:[
  {item_id:file,stream:'original',bytes:photo},{item_id:file,stream:'text',bytes:caption,verified_sha256:hash(caption)},
  {item_id:text,stream:'text',bytes:words}]};
}
test('una solicitud es estable y no autoriza publicación',()=>{let a=example(), x=prepareDraftHandoff(a);assert.deepEqual(x,prepareDraftHandoff(example()));assert.equal(x.publication,false);assert.notEqual(x.request_id,prepareDraftHandoff({...a,destination:'OPURO'}).request_id)});
test('bloquea revisiones, estados y fuentes incompletas o alteradas',()=>{
 let x=example();assert.throws(()=>prepareDraftHandoff({...x,revision:4}));
 x=example();x.inventory.state='OPEN';assert.throws(()=>prepareDraftHandoff(x));
 x=example();x.sources.pop();assert.throws(()=>prepareDraftHandoff(x));
 x=example();x.sources[0].bytes=Buffer.from('fota');assert.throws(()=>prepareDraftHandoff(x));
 x=example();x.sources[1].verified_sha256='0'.repeat(64);assert.throws(()=>prepareDraftHandoff(x));
 x=example();x.sources[2].item_id=file;assert.throws(()=>prepareDraftHandoff(x));
});
