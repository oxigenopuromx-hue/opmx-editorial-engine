import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildCorrectionPreview} from './correction-preview.mjs';
import {createCorrectionConfirmationStore} from './correction-confirmation-store.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const packageId='tg_'+'a'.repeat(40),revision=10,ownerKey=hash('opmx:telegram:v1:123:123');
const item=n=>({itemId:'ti_'+String(n).repeat(40),kind:'TEXT',state:'STORED',sha256:String(n).repeat(64)});
const request={owner:'123',chat:'123',packageId,revision,receiptId:'telegram-123-11-101'};
function fixture({editor='123',action='UPDATE'}={}){
 const actorKey=hash(`opmx:telegram:v1:${editor}:${editor}`),originalReceipt=`telegram-${editor}-10-100`;
 const facts={baseRevision:8,before:[item(1)],after:[item(1),item(2)],action,mode:'LITERAL',destination:'OPURO',verifiedPosts:action==='UPDATE'?{OPURO:10268}:{},authorizedEditorKey:actorKey};
 const preview=buildCorrectionPreview({...facts,packageId,revision,ownerKey,actorKey});
 const previewRow={preview_hash:preview.previewHash,owner_key:actorKey,preview_receipt:originalReceipt,preview_json:JSON.stringify(preview),state:'PREVIEWED'};
 const job={job_id:hash(JSON.stringify(['opmx-preview-v1',packageId,revision,8,ownerKey,actorKey,'OPURO'])),package_id:packageId,revision,base_revision:8,owner_key:ownerKey,actor_key:actorKey,destination:'OPURO',receipt_hash:hash(originalReceipt),receipt_id:originalReceipt,state:'DISPATCHED'};
 const state={pack:{owner_key:ownerKey,state:'OPEN',revision},previews:[],jobs:[]},calls=[];
 let factsCalls=0,enqueueCalls=0;
 const c={async execute(sql,args){
  calls.push({sql,args});
  if(sql.startsWith('SELECT id FROM opmx_tg_quota'))return [[{id:1}]];
  if(sql.startsWith('SELECT owner_key,state,revision'))return [state.pack?[state.pack]:[]];
  if(sql.startsWith('SELECT preview_hash,owner_key,preview_receipt'))return [state.previews];
  if(sql.startsWith('SELECT job_id,package_id,revision,base_revision'))return [state.jobs];
  if(sql.startsWith('INSERT IGNORE INTO opmx_tg_correction_previews')){state.previews.push({preview_hash:args[2],owner_key:args[3],preview_receipt:args[4],preview_json:args[5],state:'PREVIEWED'});return [{affectedRows:1}]}
  throw Error('UNEXPECTED_SQL');
 },async commit(){throw Error('HELPER_MUST_NOT_COMMIT')},async rollback(){throw Error('HELPER_MUST_NOT_ROLLBACK')},release(){throw Error('HELPER_MUST_NOT_RELEASE')}};
 const store=createCorrectionConfirmationStore({pool:{async getConnection(){throw Error('HELPER_MUST_NOT_ALLOCATE')}},loadLockedFacts:async()=>{factsCalls++;return facts},commitConfirmed:async()=>{throw Error('MUST_NOT_CONFIRM')},verifyPreviewDelivery:async()=>false,enqueuePreviewGeneration:async()=>{enqueueCalls++;throw Error('MUST_NOT_ENQUEUE_WHILE_READING')}});
 return {store,c,state,calls,facts,preview,previewRow,job,originalReceipt,actorKey,get factsCalls(){return factsCalls},get enqueueCalls(){return enqueueCalls},request:{...request,owner:editor,chat:editor,receiptId:`telegram-${editor}-11-101`}};
}
async function read(f){const before=JSON.stringify(f.state),result=await f.store.readClosePreviewInTransaction(f.c,f.request);assert.equal(JSON.stringify(f.state),before);assert(f.calls.every(x=>x.sql.startsWith('SELECT ')));assert.equal(f.factsCalls,0);assert.equal(f.enqueueCalls,0);return result}

test('previewInTransaction uses caller connection and leaves its commit to the caller',async()=>{
 const f=fixture(),result=await f.store.previewInTransaction(f.c,f.request);
 assert.equal(result.status,'PREVIEW_READY');assert.equal(f.state.previews.length,1);assert.equal(f.factsCalls,1);assert.equal(f.state.pack.state,'OPEN');assert.equal(f.state.pack.revision,revision);
 assert.match(f.calls[0].sql,/quota_v1/);assert.match(f.calls[1].sql,/packages_v1/);
});
test('close reader returns null without a durable result',async()=>{const f=fixture();assert.equal(await read(f),null)});
test('close reader refuses to use a package outside the exact OPEN revision',async()=>{
 for(const change of [f=>f.state.pack=null,f=>f.state.pack.state='READY',f=>f.state.pack.revision++]){const f=fixture();f.state.previews=[f.previewRow];change(f);assert.equal(await read(f),null);assert.equal(f.calls.length,2)}
});
test('close reader returns the complete original preview and original receipt, never the new command receipt',async()=>{
 const f=fixture();f.state.previews=[f.previewRow];assert.deepEqual(await read(f),{receiptId:f.originalReceipt,result:{status:'PREVIEW_EXISTS',preview:f.preview}});assert.notEqual(f.originalReceipt,f.request.receiptId);
});
test('close reader supports the leased administrator without transferring package ownership',async()=>{
 const f=fixture({editor:'456'});f.state.previews=[f.previewRow];const r=await read(f);assert.equal(r.receiptId,'telegram-456-10-100');assert.equal(r.result.preview.actorKey,f.actorKey);assert.equal(r.result.preview.ownerKey,ownerKey);
});
for(const state of ['PENDING','DISPATCHING','DISPATCHED'])test('close reader reuses '+state+' generation without enqueuing',async()=>{
 const f=fixture();f.job.state=state;f.state.jobs=[f.job];assert.deepEqual(await read(f),{receiptId:f.originalReceipt,result:{status:'PREVIEW_GENERATION_REQUESTED'}});
});
test('close reader preserves uncertain generation as uncertain without restarting it',async()=>{
 const f=fixture();f.job.state='UNCERTAIN';f.state.jobs=[f.job];assert.deepEqual(await read(f),{receiptId:f.originalReceipt,result:{status:'PREVIEW_DELIVERY_UNCERTAIN',retryPermitted:false}});
});
for(const state of ['PENDING','DISPATCHING','DISPATCHED','UNCERTAIN'])test('a firm compatible preview takes priority over '+state+' dispatch acknowledgement',async()=>{
 const f=fixture();f.job.state=state;f.state.previews=[f.previewRow];f.state.jobs=[f.job];assert.deepEqual(await read(f),{receiptId:f.originalReceipt,result:{status:'PREVIEW_EXISTS',preview:f.preview}});
});
const badPreviews={
 duplicate:f=>f.state.previews.push({...f.previewRow}),
 foreignActor:f=>f.previewRow.owner_key='f'.repeat(64),
 confirmed:f=>f.previewRow.state='CONFIRMED',
 malformedJson:f=>f.previewRow.preview_json='{',
 hashChanged:f=>f.previewRow.preview_hash='f'.repeat(64),
 wrongReceiptActor:f=>f.previewRow.preview_receipt='telegram-456-10-100',
 missingReceipt:f=>f.previewRow.preview_receipt=null,
};
for(const [name,mutate]of Object.entries(badPreviews))test('close reader rejects preview '+name+' without mutations',async()=>{
 const f=fixture();f.state.previews=[f.previewRow];mutate(f);await assert.rejects(()=>read(f),/CLOSE_PREVIEW_CONFLICT/);assert(f.calls.every(x=>x.sql.startsWith('SELECT ')));assert.equal(f.enqueueCalls,0);
});
const badJobs={
 duplicate:f=>f.state.jobs.push({...f.job}),
 foreignOwner:f=>f.job.owner_key='f'.repeat(64),
 foreignActor:f=>f.job.actor_key='f'.repeat(64),
 otherPackage:f=>f.job.package_id='tg_'+'b'.repeat(40),
 staleRevision:f=>f.job.revision++,
 invalidBase:f=>f.job.base_revision=revision,
 cancelled:f=>f.job.state='CANCELLED',
 badReceiptHash:f=>f.job.receipt_hash='f'.repeat(64),
 wrongReceiptActor:f=>{f.job.receipt_id='telegram-456-10-100';f.job.receipt_hash=hash(f.job.receipt_id)},
 badJobId:f=>f.job.job_id='f'.repeat(64),
 invalidDestination:f=>f.job.destination='http://private.invalid',
};
for(const [name,mutate]of Object.entries(badJobs))test('close reader rejects generation '+name+' without mutations',async()=>{
 const f=fixture();f.state.jobs=[f.job];mutate(f);await assert.rejects(()=>read(f),/CLOSE_PREVIEW_CONFLICT/);assert(f.calls.every(x=>x.sql.startsWith('SELECT ')));assert.equal(f.enqueueCalls,0);
});
test('conflicting original receipts in materialized preview and generation fail closed',async()=>{
 const f=fixture();f.state.previews=[f.previewRow];f.job.receipt_id='telegram-123-9-99';f.job.receipt_hash=hash(f.job.receipt_id);f.state.jobs=[f.job];await assert.rejects(()=>read(f),/CLOSE_PREVIEW_CONFLICT/);
});
test('a generation cannot be attached to a CREATE preview',async()=>{
 const f=fixture({action:'CREATE'});f.state.previews=[f.previewRow];f.state.jobs=[f.job];await assert.rejects(()=>read(f),/CLOSE_PREVIEW_CONFLICT/);
});
test('invalid current command identity or client fields never reach a database read',async()=>{
 for(const mutate of [x=>x.chat='456',x=>x.receiptId='telegram-456-11-101',x=>x.receiptId=null,x=>x.url='https://private.invalid']){const f=fixture();mutate(f.request);await assert.rejects(()=>read(f),/INVALID_CORRECTION/);assert.equal(f.calls.length,0)}
});
test('legacy preview still validates caller input before acquiring a connection',async()=>{
 const f=fixture();await assert.rejects(()=>f.store.preview({...request,chat:'456'}),/INVALID_CORRECTION_REQUEST/);assert.equal(f.calls.length,0);
});
