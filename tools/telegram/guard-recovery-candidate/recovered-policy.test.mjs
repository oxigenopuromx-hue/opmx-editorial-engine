import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolveRecoveredPolicy} from './recovered-policy.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const pkg='tg_'+'a'.repeat(40),owner='b'.repeat(64),admin='c'.repeat(64);
const id=n=>'ti_'+String(n).repeat(40);
const prefix='OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d\n';
function item(n,text,actor){return {itemId:id(n),ownerKey:owner,receiptKey:hash('receipt-'+n),fingerprint:hash('fingerprint-'+n),kind:'TEXT',state:'STORED',text,reservedBytes:Buffer.byteLength(text),contentBytes:Buffer.byteLength(text),sha256:hash(text),attachment:null,...(actor?{actorKey:actor}:{})};}
function fixture(){
 const oldOpen=item(1,prefix+'/nuevo\n'+JSON.stringify({policy:'publish-todos-v2',package_id:pkg,message_id:100,notice_message_id:101}));
 const material=item(2,'Original');
 const oldClose=item(3,prefix+'/listo\n'+JSON.stringify({policy:'publish-todos-v2',package_id:pkg,message_id:102}));
 const add=item(4,'Aclaración',admin);
 // 100 is also the prior operator's opening ID, but belongs to another chat.
 const close=item(5,prefix+'/listo\n'+JSON.stringify({policy:'publish-todos-v2',package_id:pkg,message_id:100}),admin);
 const prior={packageId:pkg,ownerKey:owner,revision:7,destinations:['OPURO','LIBERAL'],authorization:{mode:'PUBLISH',authorized:true,explicit:true,authorization:'DIRECT_MODE_COMMAND'},controls:[oldOpen.itemId,oldClose.itemId]};
 return {packageId:pkg,revision:12,snapshot:{prior,items:[oldOpen,material,oldClose]},closure:{packageId:pkg,revision:12,snapshotRevision:7,actorKey:admin,closeItemId:close.itemId,closeReceiptKey:close.receiptKey},items:[structuredClone(oldOpen),structuredClone(material),structuredClone(oldClose),add,close]};
}
test('administrator close in another chat preserves original authorized destinations',()=>{
 const result=resolveRecoveredPolicy(fixture());
 assert.deepEqual(result,{mode:'PUBLISH',authorized:true,explicit:true,authorization:'DIRECT_MODE_COMMAND',destination:'OPURO,LIBERAL',control_item_ids:[id(1),id(3),id(5)]});
});
test('modified originals, unauthenticated decisions, and changed destinations fail closed',()=>{
 for(const modify of [x=>x.items[1].text='alterado',x=>x.snapshot.prior.authorization.authorized=false,x=>x.snapshot.prior.destinations=['UNKNOWN'],x=>x.items[3].actorKey=owner,x=>x.closure.closeReceiptKey=hash('wrong'),x=>x.items.reverse()]){
  const input=fixture();modify(input);assert.throws(()=>resolveRecoveredPolicy(input),/RECOVERY_POLICY_UNCONFIRMED/);
 }
});
test('new controls cannot silently replace the preserved publication decision',()=>{
 const input=fixture();input.items[3]=item(4,prefix+'/publicar TODOS',admin);
 assert.throws(()=>resolveRecoveredPolicy(input),/RECOVERY_POLICY_UNCONFIRMED/);
});
