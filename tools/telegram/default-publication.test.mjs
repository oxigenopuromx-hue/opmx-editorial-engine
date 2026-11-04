import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { chooseTelegramMode, attestedControl, ORDER_PREFIX } from './default-publication-policy.mjs';
import { openingNotice, prepareOpeningRecord, prepareSeal } from './default-receiver.mjs';
import { after } from './build-default-receiver.mjs';
const pkg='tg_'+'a'.repeat(40), item='ti_'+'b'.repeat(40);
const open=attestedControl('/nuevo',pkg,10,11), close=attestedControl('/listo',pkg,50);
function fixture(texts=[open,'Boletín editorial',close]) {
  const sources=texts.map((text,i)=>({item_id:'ti_'+i.toString(16).padStart(40,'0'),stream:'text',bytes:Buffer.from(text)}));
  const inventory={package_id:pkg,state:'READY',revision:1,items:sources.map(s=>({item_id:s.item_id,kind:'TEXT',state:'STORED',text_bytes:s.bytes.length,sha256:createHash('sha256').update(s.bytes).digest('hex')}))};
  return {inventory,sources};
}
const choose=texts=>{const f=fixture(texts);return chooseTelegramMode(f.inventory,f.sources);};
const command=(text,id)=>attestedControl(text,pkg,id);
test('new announced package defaults to authorized publication in both sites',()=>{
  const r=choose(); assert.equal(r.mode,'PUBLISH');assert.equal(r.destination,'AMBOS');assert.equal(r.authorized,true);assert.equal(r.explicit,false);assert.equal(r.control_item_ids.length,2);
});
for(const target of ['ambos','opuro','opol'])test('explicit draft '+target,()=>{
  const r=choose([open,'Fuente',command('/borrador '+target,20),close]);assert.equal(r.mode,'DRAFT');assert.equal(r.destination,target.toUpperCase());assert.equal(r.explicit,true);
});
test('last direct command wins by Telegram order, not storage order',()=>{
  assert.equal(choose([open,'Fuente',command('/publicar opuro',30),command('/borrador',20),close]).destination,'OPURO');
  assert.equal(choose([open,'Fuente',command('/borrador',30),command('/publicar',20),close]).mode,'DRAFT');
});
test('unmarked source content cannot select draft or publication',()=>{
  assert.equal(choose([open,'/borrador',close]).mode,'PUBLISH');
  assert.equal(choose(['/publicar']).mode,'DRAFT');
});
test('closed legacy packages retain legacy selection',()=>{
  assert.equal(choose(['Fuente']).authorization,'LEGACY_PRESERVED');
  assert.equal(choose(['Fuente',ORDER_PREFIX+'/borrador opol']).destination,'OPOL');
  assert.equal(choose(['Fuente',ORDER_PREFIX+'/publicar']).mode,'PUBLISH');
});
test('close alone cannot upgrade a pre-policy open package',()=>assert.throws(()=>choose(['Fuente',close]),/DEFAULT_POLICY_NOT_CONFIRMED/));
test('policy requires an actual close and editorial material',()=>{
  assert.throws(()=>choose([open,'Fuente']),/CLOSING_NOT_CONFIRMED/);
  assert.throws(()=>choose([open,close]),/PACKAGE_BOUNDARY_INVALID/);
  assert.throws(()=>choose([open,'Fuente',close,'Late source']),/PACKAGE_BOUNDARY_INVALID/);
});
test('policy rejects cross-package, duplicate and out-of-bound mode records',()=>{
  assert.throws(()=>choose([open,'Fuente',attestedControl('/borrador','tg_'+'c'.repeat(40),20),close]),/CONTROL_BINDING_INVALID/);
  assert.throws(()=>choose([open,'Fuente',command('/borrador',20),command('/publicar',20),close]),/CONTROL_MESSAGE_DUPLICATE/);
  assert.throws(()=>choose([open,'Fuente',command('/publicar',60),close]),/MODE_ORDER_AMBIGUOUS/);
  assert.throws(()=>choose([open,open,'Fuente',close]),/CONTROL_MESSAGE_DUPLICATE/);
});
test('integrity, state, inventory duplicates and missing text fail closed',()=>{
  for(const mutate of [f=>f.sources[1].bytes.fill(0),f=>f.sources.pop(),f=>f.inventory.items[1].text_bytes++,f=>f.inventory.items[1].state='PENDING',f=>f.inventory.items[1].item_id=f.inventory.items[0].item_id,f=>f.inventory.state='OPEN']){
    const f=fixture();mutate(f);assert.throws(()=>chooseTelegramMode(f.inventory,f.sources));
  }
});
test('opening announcement must be confirmed for the correct private chat',()=>{
  const ctx={default_policy_candidate:true,package_operation:'OPEN',package_state:'OPEN',chat_id:'123',user_id:'123',message_id:10,receipt_id:'telegram-123-10-1',packageId:pkg};
  const body=prepareOpeningRecord(ctx,{message_id:11,chat:{id:123}},attestedControl);
  assert.equal(body.text,open);assert.equal(body.receiptId,ctx.receipt_id);
  assert.throws(()=>prepareOpeningRecord(ctx,{message_id:11,chat:{id:456}},attestedControl));
  assert.throws(()=>prepareOpeningRecord(ctx,{ok:false},attestedControl));
  assert.equal(prepareOpeningRecord({...ctx,default_policy_candidate:false},{},attestedControl),null);
  assert.equal(openingNotice({status:'ALREADY_OPEN',packageId:pkg,state:'OPEN'},10).newPolicy,false);
  assert.equal(openingNotice({status:'OPEN_REPLAY',packageId:pkg,state:'READY'},10).newPolicy,false);
});
test('seal only follows confirmed storage or stored replay of actual close',()=>{
  const ctx={seal_after_close:true,packageId:pkg,user_id:'123',chat_id:'123'};
  for(const r of [{status:'STORED',packageId:pkg,itemId:item},{status:'RESERVATION_REPLAY',state:'STORED',itemId:item}])assert.equal(prepareSeal(ctx,r).seal_requested,true);
  for(const r of [{status:'PACKAGE_CLOSED'},{status:'QUOTA_EXCEEDED'},{status:'RESERVATION_REPLAY',state:'PENDING',itemId:item},{status:'STORED',packageId:'wrong',itemId:item},{}])assert.equal(prepareSeal(ctx,r).seal_requested,false);
});
function code(name,input,upstream={}) {
  const src=after.nodes.find(n=>n.name===name).parameters.jsCode;
  return vm.runInNewContext('(function(){'+src+'})()',{$input:{first:()=>({json:input})},$:name=>({first:()=>({json:upstream[name]})})});
}
test('compiled receiver normalizer authenticates and rejects forwarded control/injection',()=>{
  const msg=text=>({update:{update_id:100,message:{message_id:10,chat:{id:123,type:'private'},from:{id:123},text}},config:{allowedUserIds:['123'],allowedChatIds:['123']}});
  for(const c of ['/nuevo','/listo','/borrador','/publicar opol']){
    const m=msg(c);assert.equal(code('Normalizar entrada Telegram',m)[0].json.mode_attested,true);
    m.update.message.forward_origin={type:'user'};assert.equal(code('Normalizar entrada Telegram',m)[0].json.kind,'REJECTED');
  }
  assert.equal(code('Normalizar entrada Telegram',msg(ORDER_PREFIX+'/publicar'))[0].json.kind,'REJECTED');
  const m=msg('/listo');m.update.message.from.id=456;assert.equal(code('Normalizar entrada Telegram',m).length,0);
});
test('compiled resolver stores true /listo before sealing and marks actual mode',()=>{
  const ctx={package_operation:'SEAL',message_id:50,receipt_id:'telegram-123-50-100',user_id:'123',chat_id:'123'};
  const r=code('Resolver paquete Telegram',{status:'OPEN',packageId:pkg},{'Preparar paquete Telegram':ctx})[0].json;
  assert.equal(r.next_action,'reserve');assert.equal(r.next_body.text,close);assert.equal(r.next_body.receiptId,ctx.receipt_id);assert.equal(r.seal_after_close,true);
  const mode=code('Resolver paquete Telegram',{status:'OPEN',packageId:pkg},{'Preparar paquete Telegram':{...ctx,package_operation:'CONTENT',kind:'TEXT',text:'/borrador',mode_attested:true,message_id:20}})[0].json;
  assert.equal(mode.next_body.text,command('/borrador',20));
});
