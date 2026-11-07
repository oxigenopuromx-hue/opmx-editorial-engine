import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCorrectionConfirmationStore} from './correction-confirmation-store.mjs';
const packageId='tg_'+'a'.repeat(40),owner='123',ownerKey=createHash('sha256').update('opmx:telegram:v1:123:123').digest('hex'),revision=10;
const item=n=>({itemId:'ti_'+String(n).repeat(40),kind:'TEXT',state:'STORED',sha256:String(n).repeat(64)});
const eventId='evt_'+'a'.repeat(48);
function fixture({failEnqueue=false}={}){
 let state={pack:{owner_key:ownerKey,state:'OPEN',revision},proposal:null,events:[]},chain=Promise.resolve();
 const pool={async getConnection(){let release,snapshot;const previous=chain;chain=new Promise(r=>release=r);return {
  async beginTransaction(){await previous;snapshot=structuredClone(state)},async commit(){release()},async rollback(){state=snapshot;release()},release(){},
  async execute(sql,args){
   if(sql.startsWith('SELECT id FROM opmx_tg_quota'))return [[{id:1}]];
   if(sql.startsWith('SELECT owner_key,state,revision'))return [[state.pack]];
   if(sql.startsWith('INSERT IGNORE INTO opmx_tg_correction_previews')){if(state.proposal)return [{affectedRows:0}];state.proposal={package_id:args[0],revision:args[1],preview_hash:args[2],owner_key:args[3],preview_receipt:args[4],preview_json:args[5],state:'PREVIEWED',event_id:null};return [{affectedRows:1}]}
   if(sql.startsWith('SELECT owner_key,preview_receipt')){return [state.proposal&&state.proposal.preview_hash===args[2]?[state.proposal]:[]]}
   if(sql.startsWith('UPDATE opmx_tg_correction_previews')){state.proposal.state='CONFIRMED';state.proposal.confirmation_receipt=args[0];state.proposal.event_id=args[1];return [{affectedRows:1}]}
   throw Error('unexpected SQL '+sql);
  }
 }}},facts={baseRevision:8,before:[item(1)],after:[item(1),item(2)],action:'UPDATE',mode:'LITERAL',destination:'OPURO',verifiedPosts:{OPURO:10268}};
 const store=createCorrectionConfirmationStore({pool,loadLockedFacts:async()=>facts,commitConfirmed:async()=>{state.events.push(eventId);if(failEnqueue)throw Error('OUTBOX_FAILED');state.pack.state='READY';state.pack.revision++;return eventId}});
 return {store,get state(){return state}};
}
const request={owner,chat:owner,packageId,revision,receiptId:'telegram-123-10-100'};
test('confirmation commits one existing event and repeat is idempotent',async()=>{
 const f=fixture(),p=await f.store.preview(request),x={...request,receiptId:'telegram-123-11-101',previewHash:p.preview.previewHash,action:'UPDATE'};
 const result=await Promise.all([f.store.confirm(x),f.store.confirm(x)]);
 assert.deepEqual(result.map(x=>x.status).sort(),['CONFIRMED','CONFIRMED_REPLAY']);assert.deepEqual(f.state.events,[eventId]);
});
test('a failure rolls back preview consumption and event together',async()=>{
 const f=fixture({failEnqueue:true}),p=await f.store.preview(request),x={...request,receiptId:'telegram-123-11-101',previewHash:p.preview.previewHash,action:'UPDATE'};
 await assert.rejects(()=>f.store.confirm(x),/OUTBOX_FAILED/);assert.equal(f.state.proposal.state,'PREVIEWED');assert.deepEqual(f.state.events,[]);assert.equal(f.state.pack.state,'OPEN');
});
test('stale revision, earlier message and a different user cannot confirm',async()=>{
 const f=fixture(),p=await f.store.preview(request),x={...request,receiptId:'telegram-123-11-101',previewHash:p.preview.previewHash,action:'UPDATE'};
 assert.equal((await f.store.confirm({...x,receiptId:'telegram-123-9-99'})).status,'CONFIRMATION_NOT_AUTHENTICATED');
 assert.equal((await f.store.confirm({...x,owner:'456',chat:'456',receiptId:'telegram-456-20-200'})).status,'NOT_AVAILABLE');
 f.state.pack.revision=11;assert.equal((await f.store.confirm(x)).status,'NOT_AVAILABLE');assert.deepEqual(f.state.events,[]);
});
