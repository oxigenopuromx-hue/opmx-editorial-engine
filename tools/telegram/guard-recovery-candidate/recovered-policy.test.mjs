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
test('a recovered editor can request an image without changing the original destination',()=>{
 for(const text of ['/imagen generar','Genera una imagen del evento\nDetalle editorial']){
  const input=fixture();input.items[3]=item(4,prefix+text,admin);
  const result=resolveRecoveredPolicy(input);assert.equal(result.destination,'OPURO,LIBERAL');assert.equal(result.mode,'PUBLISH');
 }
});
test('image-like commands cannot introduce a new destination',()=>{
 for(const text of ['/publicar TODOS','/imagen generar extra','/borrador LIBERAL']){
  const input=fixture();input.items[3]=item(4,prefix+text,admin);
  assert.throws(()=>resolveRecoveredPolicy(input),/RECOVERY_POLICY_UNCONFIRMED/);
 }
});

test('MySQL reader binds the exact READY revision, snapshot and closure',async()=>{
 const {readRecoveredPolicyInTransaction}=await import('./recovered-policy-mysql.mjs');
 const f=fixture(),queries=[];
 const connection={async execute(sql,args){
  queries.push({sql,args});
  if(sql.startsWith('SELECT owner_key,state'))return [[{owner_key:owner,state:'READY',revision:12}]];
  if(sql.startsWith('SELECT snapshot_revision'))return [[{snapshot_revision:7,actor_key:admin,close_item_id:f.closure.closeItemId,close_receipt_key:f.closure.closeReceiptKey}]];
  if(sql.startsWith('SELECT owner_key,snapshot_json'))return [[{owner_key:owner,snapshot_json:JSON.stringify(f.snapshot)}]];
  if(sql.startsWith('SELECT i.item_id'))return [f.items.map(x=>({item_id:x.itemId,owner_key:x.ownerKey,receipt_key:x.receiptKey,fingerprint:x.fingerprint,kind:x.kind,state:x.state,text_content:x.text,attachment_json:null,reserved_bytes:x.reservedBytes,content_bytes:x.contentBytes,sha256:x.sha256,actor_key:x.actorKey??null}))];
  throw Error('unexpected SQL');
 }};
 const out=await readRecoveredPolicyInTransaction(connection,pkg,12);assert.equal(out.destination,'OPURO,LIBERAL');
 assert.deepEqual(queries.map(q=>q.args),[[pkg],[pkg,12],[pkg,7],[pkg]]);
 assert.ok(queries.every(q=>q.sql.endsWith('FOR UPDATE')));
});
test('MySQL reader rejects stale revisions before reading policy',async()=>{
 const {readRecoveredPolicyInTransaction}=await import('./recovered-policy-mysql.mjs');let count=0;
 const connection={async execute(){count++;return [[{owner_key:owner,state:'READY',revision:13}]]}};
 await assert.rejects(()=>readRecoveredPolicyInTransaction(connection,pkg,12),/RECOVERY_POLICY_UNCONFIRMED/);assert.equal(count,1);
});
