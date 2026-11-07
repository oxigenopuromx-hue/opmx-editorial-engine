import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {attestedControl} from './original-destination-policy.mjs';
import {chooseMotorPolicy} from './motor-policy.mjs';
const id='tg_'+'a'.repeat(40),revision=12;
function make(){
 const texts=[attestedControl('/nuevo',id,100,101),'Fuente inicial',attestedControl('/publicar OPOL,LIBERAL',id,102),attestedControl('/listo',id,103),'Aclaración',attestedControl('/listo',id,100)];
 const sources=[],items=texts.map((text,i)=>{const bytes=Buffer.from(text),item_id='ti_'+String(i+1).repeat(40);sources.push({item_id,stream:'text',bytes});return {item_id,kind:'TEXT',state:'STORED',text_bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}});
 return {inventory:{status:'PACKAGE_FOUND',package_id:id,revision,state:'READY',items,recovered_policy:{mode:'PUBLISH',authorized:true,explicit:true,authorization:'DIRECT_MODE_COMMAND',destination:'OPOL,LIBERAL',control_item_ids:[items[0].item_id,items[2].item_id,items[3].item_id,items[5].item_id]}},sources};
}
test('Motor accepts authenticated recovery while message IDs overlap across chats',()=>{
 const {inventory,sources}=make();const p=chooseMotorPolicy(inventory,sources,{packageId:id,revision});assert.equal(p.destination,'OPOL,LIBERAL');assert.equal(p.control_item_ids.length,4);
});
test('Motor rejects incomplete or altered recovery data',()=>{
 for(const mutate of [x=>x.inventory.revision=11,x=>x.sources[4].bytes=Buffer.from('alterado'),x=>x.inventory.recovered_policy.control_item_ids.pop(),x=>x.inventory.recovered_policy.destination='LIBERAL,OPOL',x=>x.inventory.recovered_policy.authorized=false,x=>x.inventory.items.push({...x.inventory.items[4]})]){const x=make();mutate(x);assert.throws(()=>chooseMotorPolicy(x.inventory,x.sources,{packageId:id,revision}),/RECOVERED_POLICY_UNCONFIRMED/);}
});
test('ordinary packages keep their existing selector behavior',()=>{
 const x=make();delete x.inventory.recovered_policy;x.inventory.items=x.inventory.items.slice(0,4);x.sources=x.sources.slice(0,4);
 assert.equal(chooseMotorPolicy(x.inventory,x.sources,{packageId:id,revision}).destination,'OPOL,LIBERAL');
});
test('ordinary decisions exactly match the current pinned Motor selector',async()=>{
 const {chooseTelegramMode}=await import('./original-destination-policy.mjs');
 for(const command of [null,'/publicar OPURO','/publicar OPOL,LIBERAL','/publicar OPURO,OPOL','/borrador LIBERAL']){
  const texts=[attestedControl('/nuevo',id,10,11),'texto editorial',...(command?[attestedControl(command,id,12)]:[]),attestedControl('/listo',id,20)];
  const sources=[],items=texts.map((s,i)=>{const bytes=Buffer.from(s),item_id='ti_'+String(i+1).repeat(40);sources.push({item_id,stream:'text',bytes});return {item_id,kind:'TEXT',state:'STORED',text_bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}});
  const inventory={status:'PACKAGE_FOUND',package_id:id,revision,state:'READY',items};
  assert.deepEqual(chooseMotorPolicy(inventory,sources,{packageId:id,revision}),chooseTelegramMode(inventory,sources));
 }
});
