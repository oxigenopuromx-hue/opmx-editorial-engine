import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRevisionCapture} from './revision-capture.mjs';
import {readRecoveredPolicyInTransaction} from './recovered-policy-mysql.mjs';
import {attestedControl} from './original-destination-policy.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const packageId='tg_'+'a'.repeat(40),owner='b'.repeat(64),actor=hash('opmx:telegram:v1:12345:12345');
const id=n=>'ti_'+n.toString(16).padStart(40,'0');
const blocked=destinations=>destinations.map(destination=>({destination,status:'BLOCKED',publicationVerdict:'NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'}));
function item(n,text,actorKey=null,receipt='old-'+n){return {itemId:id(n),ownerKey:owner,receiptKey:hash(receipt),fingerprint:hash('fingerprint-'+n),kind:'TEXT',state:'STORED',text,reservedBytes:Buffer.byteLength(text),contentBytes:Buffer.byteLength(text),sha256:hash(text),attachment:null,actorKey};}
function recoveredFixture(){
 const items=[item(1,attestedControl('/nuevo',packageId,100,101)),item(2,'Texto editorial original.'),item(3,attestedControl('/publicar TODOS',packageId,102)),item(4,attestedControl('/listo',packageId,103))];
 const prior={packageId,revision:7,ownerKey:owner,destinations:['OPURO','OPOL','LIBERAL'],authorization:{mode:'PUBLISH',authorized:true,explicit:true,authorization:'DIRECT_MODE_COMMAND'},controls:[id(1),id(3),id(4)],contentMode:'EDITORIAL',contentControlItemIds:[]};
 const f={revision:10,items,snapshot:{prior,items:structuredClone(items)},closures:[],decisions:[],preview:null,queries:[],captured:[],counter:5};
 f.close=()=>{
  const n=f.counter++,receipt=`telegram-12345-${50+n}-${100+n}`;
  const close=item(n,attestedControl('/listo',packageId,50+n),actor,receipt);f.items.push(close);f.receipt=receipt;
  f.closures=[{package_id:packageId,revision:f.revision,snapshot_revision:f.snapshot.prior.revision,actor_key:actor,close_item_id:close.itemId,close_receipt_key:hash(receipt)}];
  f.eventId='evt_'+hash('event-'+f.revision).slice(0,48);
 };
 f.correct=mode=>{
  const content={packageId,revision:f.revision-1,ownerKey:owner,actorKey:actor,baseRevision:f.snapshot.prior.revision,action:'CREATE',mode,destination:'TODOS',posts:['OPURO','OPOL','LIBERAL'].map(destination=>({destination,postId:null}))};
  const previewHash=hash(JSON.stringify(content)),decision={...content,previewHash},encoded=JSON.stringify(decision);
  f.decisions=[{preview_hash:previewHash,decision_json:encoded}];
  const parts=f.receipt.split('-');parts[2]=String(Number(parts[2])+1);parts[3]=String(Number(parts[3])+1);
  f.preview={owner_key:actor,preview_receipt:f.receipt,confirmation_receipt:parts.join('-'),state:'CONFIRMED',event_id:f.eventId,preview_json:encoded};
  return previewHash;
 };
 const rows=x=>[structuredClone(x)];
 f.connection={async execute(sql,args){
  f.queries.push({sql,args});assert.ok(sql.endsWith('FOR UPDATE'),'capture reads must hold locks');
  if(sql.startsWith('SELECT package_id FROM opmx_tg_recovery_closures_v1'))return rows(f.closures);
  if(sql.startsWith('SELECT owner_key,state,revision FROM opmx_tg_packages_v1'))return rows([{owner_key:owner,state:'READY',revision:f.revision}]);
  if(sql.startsWith('SELECT snapshot_revision,actor_key'))return rows(f.closures);
  if(sql.startsWith('SELECT owner_key,snapshot_json'))return rows([{owner_key:owner,snapshot_json:JSON.stringify(f.snapshot)}]);
  if(sql.startsWith('SELECT i.item_id'))return rows(f.items.map(i=>({item_id:i.itemId,owner_key:i.ownerKey,receipt_key:i.receiptKey,fingerprint:i.fingerprint,kind:i.kind,state:i.state,text_content:i.text,attachment_json:null,reserved_bytes:i.reservedBytes,content_bytes:i.contentBytes,sha256:i.sha256,actor_key:i.actorKey})));
  if(sql.startsWith('SELECT decision_json FROM opmx_tg_confirmed_decisions_v1')||sql.startsWith('SELECT preview_hash,decision_json FROM opmx_tg_confirmed_decisions_v1'))return rows(f.decisions);
  if(sql.startsWith('SELECT owner_key,preview_receipt,confirmation_receipt,state,event_id,preview_json'))return rows(f.preview?[f.preview]:[]);
  if(sql.startsWith('SELECT event_id FROM opmx_tg_events_v1'))return rows([{event_id:f.eventId}]);
  throw Error('Unexpected query: '+sql);
 }};
 const capture=createRevisionCapture({lockVerifiedBlockedOutcomes:async(c,d)=>{assert.equal(c,f.connection);f.captured.push(structuredClone(d));return blocked(d.destinations)}});
 f.capture=()=>capture(f.connection,packageId,f.revision,owner,f.items);
 f.policy=()=>readRecoveredPolicyInTransaction(f.connection,packageId,f.revision);
 f.advance=prior=>{f.snapshot={prior:structuredClone(prior),items:structuredClone(f.items)};f.revision+=2;f.decisions=[];f.preview=null;f.close()};
 f.close();return f;
}

test('actual confirmed literal correction retains provenance through three captured recoveries',async()=>{
 const f=recoveredFixture(),previewHash=f.correct('LITERAL');
 const first=await f.capture();assert.equal(first.contentMode,'LITERAL');assert.deepEqual(first.contentControlItemIds,[]);assert.equal(first.confirmedPreviewHash,previewHash);assert.equal(first.authorization.mode,'PUBLISH');
 f.advance(first);const inherited=await f.policy();assert.equal(inherited.content_mode,'LITERAL');assert.equal(inherited.content_mode_provenance_hash,previewHash);assert.deepEqual(inherited.content_control_item_ids,[]);
 const second=await f.capture();assert.equal(second.contentMode,'LITERAL');assert.equal(second.confirmedPreviewHash,previewHash);assert.equal(second.revision,12);assert.deepEqual(second.destinations,['OPURO','OPOL','LIBERAL']);
 f.advance(second);const third=await f.capture();assert.equal(third.contentMode,'LITERAL');assert.equal(third.confirmedPreviewHash,previewHash);assert.equal(third.revision,14);assert.equal(third.authorization.authorization,'DIRECT_MODE_COMMAND');assert.equal(f.captured.length,3);
});
test('a later confirmed editorial choice replaces literal provenance and never promotes it again',async()=>{
 const f=recoveredFixture(),literalHash=f.correct('LITERAL'),first=await f.capture();f.advance(first);
 const editorialHash=f.correct('EDITORIAL');assert.notEqual(editorialHash,literalHash);
 const second=await f.capture();assert.equal(second.contentMode,'EDITORIAL');assert.equal(second.confirmedPreviewHash,editorialHash);
 f.advance(second);const third=await f.capture();assert.equal(third.contentMode,'EDITORIAL');assert.equal(third.confirmedPreviewHash,editorialHash);assert.deepEqual(third.contentControlItemIds,[]);
});
test('loss or corruption of confirmed provenance cannot silently preserve inherited literal mode',async()=>{
 for(const mutate of [x=>delete x.confirmedPreviewHash,x=>x.confirmedPreviewHash='bad']){
  const f=recoveredFixture();f.correct('LITERAL');const first=await f.capture();mutate(first);f.advance(first);assert.equal(await f.capture(),null);
 }
});
test('altered retained controls or source records fail the real recovery provider',async()=>{
 const f=recoveredFixture();f.correct('LITERAL');const first=await f.capture();f.advance(first);f.items[1].text+=' Alteración';f.items[1].sha256=hash(f.items[1].text);f.items[1].contentBytes=Buffer.byteLength(f.items[1].text);f.items[1].reservedBytes=f.items[1].contentBytes;assert.equal(await f.capture(),null);
});
test('legacy editorial snapshots without any literal provenance remain editorial across captures',async()=>{
 const f=recoveredFixture();delete f.snapshot.prior.contentMode;delete f.snapshot.prior.contentControlItemIds;
 const first=await f.capture();assert.equal(first.contentMode,'EDITORIAL');assert.deepEqual(first.contentControlItemIds,[]);assert.equal(Object.hasOwn(first,'confirmedPreviewHash'),false);f.advance(first);assert.equal((await f.capture()).contentMode,'EDITORIAL');
});

function injected(policy,correction=null){
 const outcomes=[];const capture=createRevisionCapture({readRecoveredPolicy:async()=>policy,readConfirmedCorrection:async()=>correction,lockVerifiedBlockedOutcomes:async(c,d)=>{outcomes.push(d);return blocked(d.destinations)}});
 return {capture:()=>capture({execute:async()=>[[{package_id:packageId}]]},packageId,8,owner,[]),outcomes};
}
const ordinary={mode:'PUBLISH',authorized:true,explicit:true,authorization:'DIRECT_MODE_COMMAND',destination:'TODOS',control_item_ids:[id(1),id(2)]};
test('authenticated original literal controls remain present in the next capture',async()=>{
 const f=injected({...ordinary,content_mode:'LITERAL',content_control_item_ids:[id(2)]});const p=await f.capture();assert.equal(p.contentMode,'LITERAL');assert.deepEqual(p.contentControlItemIds,[id(2)]);assert.deepEqual(p.controls,[id(1),id(2)]);assert.equal(Object.hasOwn(p,'confirmedPreviewHash'),false);
});
test('explicit editorial mode does not inherit a literal exception merely from source words',async()=>{
 const p=await injected({...ordinary,content_mode:'EDITORIAL',content_control_item_ids:[id(2)]}).capture();assert.equal(p.contentMode,'EDITORIAL');assert.equal(Object.hasOwn(p,'confirmedPreviewHash'),false);
});
test('malformed or missing content provenance fails capture before outcome observation',async()=>{
 for(const extra of [{content_mode:'LITERAL'},{content_mode:'AUTO'},{content_mode:'LITERAL',content_control_item_ids:[id(3)]},{content_mode:'LITERAL',content_control_item_ids:[id(2),id(2)]},{content_mode:'LITERAL',content_control_item_ids:[] ,content_mode_provenance_hash:'bad'},{content_control_item_ids:[id(2)]}]){
  const f=injected({...ordinary,...extra});assert.equal(await f.capture(),null);assert.equal(f.outcomes.length,0);
 }
});
test('a current confirmed override uses its own hash rather than an inherited one',async()=>{
 const inherited='c'.repeat(64),current='d'.repeat(64),f=injected({...ordinary,content_mode:'LITERAL',content_control_item_ids:[],content_mode_provenance_hash:inherited},{package_id:packageId,revision:8,action:'CREATE',destination:'TODOS',content_mode:'EDITORIAL',preview_hash:current});
 const p=await f.capture();assert.equal(p.contentMode,'EDITORIAL');assert.equal(p.confirmedPreviewHash,current);
});
test('a malformed current override cannot be laundered through a valid old provenance hash',async()=>{
 const f=injected({...ordinary,content_mode:'LITERAL',content_control_item_ids:[],content_mode_provenance_hash:'c'.repeat(64)},{package_id:packageId,revision:8,action:'CREATE',destination:'TODOS',content_mode:'EDITORIAL',preview_hash:'bad'});assert.equal(await f.capture(),null);
});
