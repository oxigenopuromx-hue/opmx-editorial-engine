import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createTelegramPackageStore} from './package-store.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex'),key=x=>sha(`opmx:telegram:v1:${x}:${x}`),pkg='tg_'+'a'.repeat(40);
function fixture({recovery=false,initialItems=recovery?39:20,failSeal=false,failPreview=false,previewStatus='PREVIEW_GENERATION_REQUESTED'}={}){
 const actor=recovery?'456':'123',owner='123',originals=Array.from({length:initialItems},(_,i)=>({item_id:'ti_'+i.toString(16).padStart(40,'0'),kind:'TEXT',state:'STORED',text_content:'original '+i,sha256:sha('original '+i),reserved_bytes:10,content_bytes:10,actor_key:null}));
 let state={pack:{package_id:pkg,owner_key:key(owner),state:'OPEN',revision:10,item_count:originals.length,used_bytes:originals.length*10},quota:{used_bytes:originals.length*10,package_count:1},items:structuredClone(originals),session:true,lease:recovery?{actor_key:key(actor),owner_key:key(owner),receipt_id:'telegram-456-1-1',opening_revision:8}:null,events:[],preview:null};
 let tail=Promise.resolve(),sealFailures=Number(failSeal),previewFailures=Number(failPreview),connections=0,previewCalls=0;
 const queries=[];
 const pool={async getConnection(){connections++;let snapshot,releaseLock,active=false;return {
  async beginTransaction(){const previous=tail;tail=new Promise(resolve=>{releaseLock=resolve});await previous;snapshot=structuredClone(state);active=true},
  async commit(){assert(active);active=false;releaseLock()},async rollback(){assert(active);state=snapshot;active=false;releaseLock()},release(){assert(!active)},
  async execute(sql,args=[]){queries.push(sql);
   if(sql.startsWith('CREATE TABLE')||sql.startsWith('INSERT IGNORE'))return [[]];
   if(sql.startsWith('SELECT used_bytes,package_count'))return [[structuredClone(state.quota)]];
   if(sql.startsWith('SELECT actor_key,owner_key,receipt_id'))return [state.lease?[structuredClone(state.lease)]:[]];
   if(sql.startsWith('SELECT * FROM opmx_tg_packages'))return [args[1]===state.pack.owner_key?[structuredClone(state.pack)]:[]];
   if(sql.startsWith('SELECT package_id FROM opmx_tg_sessions'))return [state.session?[{package_id:pkg}]:[]];
   if(sql.startsWith('SELECT item_id,package_id,fingerprint'))return [state.items.filter(i=>i.receipt_key===args[0]).map(i=>({...i,package_id:pkg}))];
   if(sql.startsWith('SELECT COUNT(*) AS pending'))return [[{pending:0}]];
   if(sql.startsWith('SELECT COUNT(*) AS total'))return [[{total:state.items.length,pending:0,stored:state.items.length}]];
   if(sql.startsWith('SELECT i.item_id,i.kind,i.text_content'))return [[structuredClone(state.items.at(-1))]];
   if(sql.startsWith('SELECT item_id FROM opmx_tg_items'))return [[{item_id:state.items.at(-1).item_id}]];
   if(sql.startsWith('INSERT INTO opmx_tg_items')){state.items.push({item_id:args[0],package_id:pkg,owner_key:args[2],receipt_key:args[3],fingerprint:args[4],kind:args[5],state:args[6],text_content:args[7],reserved_bytes:args[9],content_bytes:args[10],sha256:args[11],actor_key:null});return [{affectedRows:1}]}
   if(sql.startsWith('INSERT INTO opmx_tg_recovery_contributions')){state.items.find(i=>i.item_id===args[0]).actor_key=args[2];return [{affectedRows:1}]}
   if(sql.startsWith('UPDATE opmx_tg_packages_v1 SET item_count=item_count+1')){state.pack.item_count++;state.pack.used_bytes+=args[0];state.pack.revision++;return [{affectedRows:1}]}
   if(sql.startsWith('UPDATE opmx_tg_quota_v1 SET used_bytes=used_bytes+')){state.quota.used_bytes+=args[0];return [{affectedRows:1}]}
   if(sql.startsWith("UPDATE opmx_tg_packages_v1 SET state='READY'")){state.pack.state='READY';state.pack.revision++;return [{affectedRows:1}]}
   if(sql.startsWith('DELETE FROM opmx_tg_sessions')){state.session=false;return [{affectedRows:1}]}
   if(sql.startsWith('DELETE FROM opmx_tg_recovery_leases')){state.lease=null;return [{affectedRows:1}]}
   throw Error('UNEXPECTED_SQL:'+sql);
  }
 }}};
 const options={recoveryEnabled:true,adminUserIds:['456'],events:{async initialize(){},async enqueue(_c,event){state.events.push(event);return 'evt_'+'b'.repeat(48)}},initializePublicationFence:async()=>{if(sealFailures-->0)throw Error('SYNTHETIC_SEAL_FAILURE')},closeRecoveryPreview:async(_c,x)=>{previewCalls++;if(previewFailures-->0)throw Error('SYNTHETIC_PREVIEW_FAILURE');const result={status:previewStatus};state.preview={revision:x.revision,receiptId:x.receiptId,result};return result},readCloseRecoveryResult:async(_c,x)=>state.preview?.revision===x.revision?structuredClone(state.preview):null};
 const store=createTelegramPackageStore(pool,options);
 const close=message=>({owner:actor,chat:actor,packageId:pkg,receiptId:`telegram-${actor}-${message}-${message}`,kind:'TEXT',text:'OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d\n/listo\n'+JSON.stringify({policy:'publish-todos-v2',package_id:pkg,message_id:message}),attachment:null});
 return {store,close,originals,get state(){return state},get previewCalls(){return previewCalls},get connections(){return connections},queries};
}

test('reproduces the old split request hole: stored control21 survives failed seal and blocks a new receipt',async()=>{
 const f=fixture({failSeal:true});assert.equal((await f.store.run('reserve',f.close(2))).status,'STORED');
 await assert.rejects(f.store.run('seal',{owner:'123',chat:'123',packageId:pkg}),/Almacenamiento no confirmado/);
 assert.equal(f.state.pack.state,'OPEN');assert.equal(f.state.pack.item_count,21);
 const retry=await f.store.run('reserve',f.close(3));assert.equal(retry.status,'QUOTA_EXCEEDED');assert.equal(retry.quotaDiagnostic.code,'PACKAGE_ITEMS_LIMIT');
});
for(const recovery of [false,true])test('atomic close rolls back control, exact bytes and revision after '+(recovery?'preview':'seal')+' failure, then a new /listo succeeds',async()=>{
 const f=fixture({recovery,failSeal:!recovery,failPreview:recovery}),before=structuredClone(f.state);
 await assert.rejects(f.store.run('close',f.close(2)),/Almacenamiento no confirmado/);assert.deepEqual(f.state,before);
 const result=await f.store.run('close',f.close(3));assert.equal(result.status,'CLOSE_COMPLETED');assert.equal(result.result.status,recovery?'PREVIEW_GENERATION_REQUESTED':'READY');
 assert.equal(f.state.pack.item_count,before.pack.item_count+1);assert.equal(f.state.pack.used_bytes,before.pack.used_bytes+Buffer.byteLength(f.close(3).text));assert.deepEqual(f.state.items.slice(0,f.originals.length),f.originals);assert.equal(f.state.events.length,recovery?0:1);
});
test('a nonconfirmed preview outcome also rolls back its stored close and quota',async()=>{
 const f=fixture({recovery:true,previewStatus:'PREVIEW_GENERATION_UNAVAILABLE'}),before=structuredClone(f.state);await assert.rejects(f.store.run('close',f.close(2)));assert.deepEqual(f.state,before);
});
for(const recovery of [false,true])test('commit with lost response and a fresh /listo reuses the durable result without another slot '+recovery,async()=>{
 const f=fixture({recovery}),first=await f.store.run('close',f.close(2)),committed=structuredClone(f.state);
 const retry=await f.store.run('close',f.close(3));assert.equal(retry.status,'CLOSE_COMPLETED');assert.equal(retry.replayed,true);assert.equal(retry.result.status,first.result.status);assert.deepEqual(f.state,committed);assert.equal(f.previewCalls,recovery?1:0);if(recovery)assert.equal(retry.receiptId,f.close(2).receiptId);
});
for(const recovery of [false,true])test('two concurrent closing commands consume exactly one slot and one event/job '+recovery,async()=>{
 const f=fixture({recovery}),n=f.state.pack.item_count;const results=await Promise.all([f.store.run('close',f.close(2)),f.store.run('close',f.close(3))]);assert(results.every(r=>r.status==='CLOSE_COMPLETED'));assert.equal(f.state.pack.item_count,n+1);assert.equal(f.state.events.length,recovery?0:1);assert.equal(f.previewCalls,recovery?1:0);
});
test('uncertain preview dispatch is reported without another control or job',async()=>{
 const f=fixture({recovery:true});await f.store.run('close',f.close(2));f.state.preview.result={status:'PREVIEW_DELIVERY_UNCERTAIN',retryPermitted:false};const before=structuredClone(f.state),retry=await f.store.run('close',f.close(3));assert.equal(retry.result.status,'PREVIEW_DELIVERY_UNCERTAIN');assert.deepEqual(f.state,before);assert.equal(f.previewCalls,1);
});
test('foreign lease, stale closing command and corrupt recorded receipt cannot close or change originals',async()=>{
 const f=fixture({recovery:true}),before=structuredClone(f.state);const foreign={...f.close(2),owner:'123',chat:'123'};foreign.receiptId='telegram-123-2-2';assert.equal((await f.store.run('close',foreign)).status,'PACKAGE_IN_USE');assert.deepEqual(f.state,before);
 assert.equal((await f.store.run('close',f.close(1))).status,'STALE_SESSION_MESSAGE');assert.deepEqual(f.state,before);
 await f.store.run('close',f.close(2));f.state.preview.receiptId=f.close(99).receiptId;const committed=structuredClone(f.state);await assert.rejects(f.store.run('close',f.close(3)));assert.deepEqual(f.state,committed);
});
test('a pasted or unbound /listo marker is rejected before touching the database',async()=>{
 const f=fixture();for(const patch of [{text:'/listo'},{receiptId:'telegram-123-99-99'},{kind:'FILE',text:''}])await assert.rejects(f.store.run('close',{...f.close(2),...patch}));assert.equal(f.connections,0);
});
test('a stale legacy close replay cannot seal material added after that command',async()=>{
 const f=fixture({initialItems:1});await f.store.run('reserve',f.close(2));await f.store.run('reserve',{...f.close(3),text:'Nueva fuente después de aquel cierre'});const before=structuredClone(f.state);
 assert.equal((await f.store.run('close',f.close(2))).status,'STALE_SESSION_MESSAGE');assert.deepEqual(f.state,before);assert.equal(f.state.events.length,0);
});
for(const field of ['sha256','content_bytes','actor_key'])test('durable replay refuses changed stored closing provenance '+field,async()=>{
 const f=fixture({recovery:true});await f.store.run('close',f.close(2));f.state.items.at(-1)[field]=field==='content_bytes'?999:'bad';const before=structuredClone(f.state);await assert.rejects(f.store.run('close',f.close(3)));assert.deepEqual(f.state,before);assert.equal(f.previewCalls,1);
});
