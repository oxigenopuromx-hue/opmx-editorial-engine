import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {attestedControl,chooseTelegramMode,ORDER_PREFIX} from './destination-policy-candidate.mjs';
const pkg='tg_'+'a'.repeat(40);
const marked=(s,id)=>attestedControl(s,pkg,id,id===10?11:undefined);
function choose(texts) {
 const sources=texts.map((s,i)=>({item_id:'ti_'+i.toString(16).padStart(40,'0'),stream:'text',bytes:Buffer.from(s)}));
 const inventory={package_id:pkg,state:'READY',items:sources.map(s=>({item_id:s.item_id,kind:'TEXT',state:'STORED',text_bytes:s.bytes.length,sha256:createHash('sha256').update(s.bytes).digest('hex')}))};
 return chooseTelegramMode(inventory,sources);
}
const open=marked('/nuevo',10),close=marked('/listo',50);
test('accredited expanded destinations and default preserve intent',()=>{
 for(const [cmd,target,mode] of [['/publicar liberal','LIBERAL','PUBLISH'],['/publicar todos','TODOS','PUBLISH'],['/borrador liberal, opuro','OPURO,LIBERAL','DRAFT'],['/publicar ambos','AMBOS','PUBLISH']]){
  const r=choose([open,'Fuente',marked(cmd,20),close]);assert.equal(r.destination,target);assert.equal(r.mode,mode);assert.equal(r.authorization,'DIRECT_MODE_COMMAND');
 }
 assert.equal(choose([open,'Fuente',close]).destination,'TODOS');
});
test('untrusted content cannot grant selection; latest accredited control wins',()=>{
 assert.equal(choose([open,'/publicar todos',close]).destination,'TODOS');
 const r=choose([open,'Fuente',marked('/publicar todos',20),marked('/borrador liberal',30),close]);assert.equal(r.destination,'LIBERAL');assert.equal(r.mode,'DRAFT');
 assert.equal(choose(['Fuente',ORDER_PREFIX+'/publicar opol']).destination,'OPOL');
});
test('reject invalid destination, forged bindings and late material',()=>{
 for(const s of ['/publicar desconocido','/publicar opuro,,liberal','/publicar liberal\ntexto','/nuevo liberal']) assert.throws(()=>marked(s,20));
 assert.throws(()=>choose([open,'Fuente',attestedControl('/publicar todos','tg_'+'b'.repeat(40),20),close]),/CONTROL_BINDING_INVALID/);
 assert.throws(()=>choose([open,'Fuente',close,'tardío']),/PACKAGE_BOUNDARY_INVALID/);
});

test('older v1 opening retains AMBOS even when closed after upgrade',()=>{
 const old=ORDER_PREFIX+'/nuevo\n'+JSON.stringify({policy:'publish-ambos-v1',package_id:pkg,message_id:10,notice_message_id:11});
 assert.equal(choose([old,'Fuente',close]).destination,'AMBOS');
 assert.equal(choose(['Fuente',ORDER_PREFIX+'/publicar']).destination,'AMBOS');
});
