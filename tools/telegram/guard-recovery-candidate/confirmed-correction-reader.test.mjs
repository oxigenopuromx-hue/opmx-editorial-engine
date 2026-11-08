import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildCorrectionPreview} from './correction-preview.mjs';
import {readConfirmedCorrectionInTransaction,readVerifiedUpdateDecisionInTransaction} from './confirmed-correction-reader.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex'),packageId='tg_'+'a'.repeat(40),ownerKey=hash('opmx:telegram:v1:123:123'),eventId='evt_'+'b'.repeat(48),previewReceipt='telegram-123-10-100';
function fixture(editor='123'){
 const actorKey=hash(`opmx:telegram:v1:${editor}:${editor}`),closeReceipt=`telegram-${editor}-10-100`;
 const item={itemId:'ti_'+'d'.repeat(40),kind:'TEXT',state:'STORED',sha256:hash('texto'),text:'texto'};
 const preview=buildCorrectionPreview({packageId,revision:10,ownerKey,actorKey,authorizedEditorKey:actorKey,baseRevision:7,before:[item],after:[item],action:'CREATE',mode:'LITERAL',destination:'OPOL,LIBERAL',verifiedPosts:{}});
 const state={preview,pack:{owner_key:ownerKey,state:'READY',revision:11},event:{event_id:eventId},closure:{snapshot_revision:7,actor_key:actorKey,close_receipt_key:hash(closeReceipt)}};
 const connection={async execute(sql){
  if(sql.startsWith('SELECT owner_key,state,revision'))return [[state.pack]];
  if(sql.startsWith('SELECT preview_hash,decision_json'))return state.decisionMissing?[[]]:[[{preview_hash:state.preview.previewHash,decision_json:JSON.stringify(state.preview)}]];
  if(sql.startsWith('SELECT owner_key,preview_receipt'))return [[{owner_key:actorKey,preview_receipt:closeReceipt,confirmation_receipt:state.confirmation??`telegram-${editor}-11-101`,state:state.status??'CONFIRMED',event_id:eventId,preview_json:state.mismatch?'{}':JSON.stringify(state.preview)}]];
  if(sql.startsWith('SELECT event_id FROM opmx_tg_events'))return state.noEvent?[[]]:[[state.event]];
  if(sql.startsWith('SELECT snapshot_revision'))return [[state.closure]];
  throw Error('unexpected SQL');
 }};return {state,connection};
}
test('returns the confirmed mode and canonical destinations bound to the ready revision and outbox',async()=>{
 const f=fixture(),out=await readConfirmedCorrectionInTransaction(f.connection,packageId,11);assert.equal(out.content_mode,'LITERAL');assert.equal(out.destination,'OPOL,LIBERAL');assert.equal(out.action,'CREATE');
});
test('reads an administrator confirmation only if closure and receipt bind the editor',async()=>{
 const f=fixture('456');assert.equal((await readConfirmedCorrectionInTransaction(f.connection,packageId,11)).content_mode,'LITERAL');
 f.state.closure.actor_key=ownerKey;await assert.rejects(()=>readConfirmedCorrectionInTransaction(f.connection,packageId,11),/CONFIRMED_CORRECTION_UNCONFIRMED/);
});
test('unconfirmed, stale, mismatched or unbound decisions fail closed',async()=>{
 for(const mutate of [x=>x.pack.revision=12,x=>x.noEvent=true,x=>x.status='PREVIEWED',x=>x.mismatch=true,x=>x.confirmation='telegram-123-9-90',x=>x.closure.close_receipt_key=hash('other'),x=>x.preview.destination='TODOS']){
  const f=fixture();mutate(f.state);await assert.rejects(()=>readConfirmedCorrectionInTransaction(f.connection,packageId,11),/CONFIRMED_CORRECTION_UNCONFIRMED/);
 }
});
test('an ordinary recovery has no confirmed correction',async()=>{const f=fixture();f.state.decisionMissing=true;assert.equal(await readConfirmedCorrectionInTransaction(f.connection,packageId,11),null)});
test('a confirmed update exposes only the exact destination IDs to the guarded update path',async()=>{
 const f=fixture(),old=f.state.preview,item=old.materials[0];
 f.state.preview=buildCorrectionPreview({packageId,revision:10,ownerKey,actorKey:old.actorKey,authorizedEditorKey:old.actorKey,baseRevision:7,before:[item],after:[item],action:'UPDATE',mode:'LITERAL',destination:'OPOL,LIBERAL',verifiedPosts:{OPOL:123,LIBERAL:456}});
 const result=await readVerifiedUpdateDecisionInTransaction(f.connection,{packageId,revision:11});assert.deepEqual(result.posts,[{destination:'OPOL',postId:123},{destination:'LIBERAL',postId:456}]);assert.equal(result.action,'UPDATE');assert.equal(result.previewHash,f.state.preview.previewHash);
 await assert.rejects(()=>readConfirmedCorrectionInTransaction(f.connection,packageId,11),/CONFIRMED_CORRECTION_UNCONFIRMED/);
 f.state.preview.posts[0].postId=789;await assert.rejects(()=>readVerifiedUpdateDecisionInTransaction(f.connection,{packageId,revision:11}),/CONFIRMED_CORRECTION_UNCONFIRMED/);
});
