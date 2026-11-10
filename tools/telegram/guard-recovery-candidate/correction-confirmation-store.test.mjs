import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCorrectionConfirmationStore} from './correction-confirmation-store.mjs';
const packageId='tg_'+'a'.repeat(40),owner='123',ownerKey=createHash('sha256').update('opmx:telegram:v1:123:123').digest('hex'),revision=10;
const item=n=>({itemId:'ti_'+String(n).repeat(40),kind:'TEXT',state:'STORED',sha256:String(n).repeat(64)});
const eventId='evt_'+'a'.repeat(48);
function fixture({failEnqueue=false,editorKey=ownerKey,delivered=true}={}){
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
 const store=createCorrectionConfirmationStore({pool,loadLockedFacts:async(c,x)=>{if(x.actorKey!==editorKey)throw Error('LEASE_INVALID');return {...facts,authorizedEditorKey:editorKey}},verifyPreviewDelivery:async()=>delivered,commitConfirmed:async()=>{state.events.push(eventId);if(failEnqueue)throw Error('OUTBOX_FAILED');state.pack.state='READY';state.pack.revision++;return eventId}});
 return {store,get state(){return state}};
}
const request={owner,chat:owner,packageId,revision,receiptId:'telegram-123-10-100'};
test('confirmation commits one existing event and repeat is idempotent',async()=>{
 const f=fixture(),p=await f.store.preview(request),x={...request,receiptId:'telegram-123-11-101',previewHash:p.preview.previewHash,action:'UPDATE'};
 const result=await Promise.all([f.store.confirm(x),f.store.confirm(x)]);
 assert.deepEqual(result.map(x=>x.status).sort(),['CONFIRMED','CONFIRMED_REPLAY']);assert.deepEqual(f.state.events,[eventId]);
});
test('confirmation cannot enqueue if the complete preview delivery is unconfirmed',async()=>{
 const f=fixture({delivered:false}),p=await f.store.preview(request);
 const result=await f.store.confirm({...request,receiptId:'telegram-123-11-101',previewHash:p.preview.previewHash,action:'UPDATE'});
 assert.equal(result.status,'PREVIEW_DELIVERY_UNCONFIRMED');assert.equal(f.state.proposal.state,'PREVIEWED');assert.deepEqual(f.state.events,[]);
});
test('the leased administrator confirms their own preview without transferring ownership',async()=>{
 const editorKey=createHash('sha256').update('opmx:telegram:v1:456:456').digest('hex'),f=fixture({editorKey});
 const requestAdmin={...request,owner:'456',chat:'456',receiptId:'telegram-456-10-100'};
 const p=await f.store.preview(requestAdmin);assert.equal(p.preview.ownerKey,ownerKey);assert.equal(p.preview.actorKey,editorKey);
 const x={...requestAdmin,receiptId:'telegram-456-11-101',previewHash:p.preview.previewHash,action:'UPDATE'};
 assert.equal((await f.store.confirm({...x,owner:'123',chat:'123',receiptId:'telegram-123-11-101'})).status,'NOT_AVAILABLE');
 assert.equal((await f.store.confirm(x)).status,'CONFIRMED');assert.deepEqual(f.state.events,[eventId]);
});
test('repeating preview returns the same complete content for review',async()=>{
 const f=fixture(),a=await f.store.preview(request),b=await f.store.preview({...request,receiptId:'telegram-123-11-101'});
 assert.equal(b.status,'PREVIEW_EXISTS');assert.deepEqual(b.preview,a.preview);assert.deepEqual(f.state.events,[]);
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

test('generation requests are enqueued in the same transaction without sealing or publishing',async()=>{
 let calls=[],committed=false;const c={async beginTransaction(){},async commit(){committed=true},async rollback(){},release(){},async execute(sql){if(sql.startsWith('SELECT id FROM opmx_tg_quota'))return [[{id:1}]];if(sql.startsWith('SELECT owner_key,state,revision'))return [[{owner_key:ownerKey,state:'OPEN',revision}]];throw Error(sql)}};
 const scope={packageId,revision,baseRevision:8,ownerKey,actorKey:ownerKey,destination:'OPURO'};
 const config={pool:{async getConnection(){return c}},loadLockedFacts:async()=>({previewGenerationRequired:true,previewScope:scope}),commitConfirmed:async()=>{throw Error('MUST_NOT_PUBLISH')},verifyPreviewDelivery:async()=>false};
 const absent=createCorrectionConfirmationStore(config);assert.deepEqual(await absent.preview(request),{status:'PREVIEW_GENERATION_UNAVAILABLE'});
 const store=createCorrectionConfirmationStore({...config,enqueuePreviewGeneration:async(conn,input)=>{assert.equal(conn,c);calls.push(input);return {status:'PREVIEW_QUEUED'}}});
 assert.deepEqual(await store.preview(request),{status:'PREVIEW_GENERATION_REQUESTED'});assert.equal(committed,true);assert.deepEqual(calls,[{...scope,receiptId:request.receiptId}]);
});

test('an unbound request is not enqueued and an outbox failure rolls back',async()=>{
 let rollbacks=0,calls=0,scope={packageId,revision,baseRevision:8,ownerKey,actorKey:'f'.repeat(64),destination:'OPURO'};
 const c={async beginTransaction(){},async commit(){},async rollback(){rollbacks++},release(){},async execute(sql){if(sql.startsWith('SELECT id FROM opmx_tg_quota'))return [[{id:1}]];if(sql.startsWith('SELECT owner_key,state,revision'))return [[{owner_key:ownerKey,state:'OPEN',revision}]];throw Error(sql)}};
 const store=createCorrectionConfirmationStore({pool:{async getConnection(){return c}},loadLockedFacts:async()=>({previewGenerationRequired:true,previewScope:scope}),commitConfirmed:async()=>{throw Error('MUST_NOT_PUBLISH')},verifyPreviewDelivery:async()=>false,enqueuePreviewGeneration:async()=>{calls++;throw Error('QUEUE_FAILED')}});
 assert.equal((await store.preview(request)).status,'PREVIEW_GENERATION_UNAVAILABLE');assert.equal(calls,0);
 scope={...scope,actorKey:ownerKey};await assert.rejects(()=>store.preview(request),/QUEUE_FAILED/);assert.equal(rollbacks,1);
});
