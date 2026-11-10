import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPreviewPayloadStore} from './preview-payload-store.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex'),packageId='tg_'+'a'.repeat(40),actorKey=hash('opmx:telegram:v1:123:123'),ownerKey='b'.repeat(64),revision=12;
function fixture(){
 const s={rows:[],state:'OPEN',revision,session:packageId,selection:{packageId,revision,ownerKey,action:'UPDATE',mode:'LITERAL',destination:'AMBOS'},lease:{actor_key:actorKey,owner_key:ownerKey,opening_revision:8}};let snapshot;
 const c={async beginTransaction(){snapshot=structuredClone(s.rows)},async commit(){},async rollback(){s.rows=snapshot},release(){},async execute(sql,args){
  if(sql.includes('FROM opmx_tg_quota'))return [[{id:1}]];
  if(sql.includes('FROM opmx_tg_packages'))return [[{owner_key:ownerKey,state:s.state,revision:s.revision}]];
  if(sql.includes('FROM opmx_tg_recovery_leases'))return [[s.lease]];
  if(sql.includes('FROM opmx_tg_sessions'))return [[{package_id:s.session}]];
  if(sql.startsWith('INSERT INTO opmx_tg_preview_payloads')){s.rows.push({destination:args[2],actor_key:args[3],payload_hash:args[4],payload_json:args[5]});return [{affectedRows:1}]}
  if(sql.includes('FROM opmx_tg_preview_payloads'))return [sql.includes('AND destination=?')?s.rows.filter(x=>x.destination===args[2]):s.rows];
  throw Error(sql)
 }};
 const store=createPreviewPayloadStore({pool:{async getConnection(){return c}},readSelection:async()=>s.selection});
 const request={owner:'123',chat:'123',packageId,revision,destination:'OPURO',payload:{title:'Prueba',content:'<p>Exacto</p>'}};
 const scope={packageId,revision,baseRevision:7,ownerKey,actorKey,destination:'AMBOS'};
 return {store,request,scope,s,c};
}
test('preview proposals are immutable and require every selected destination',async()=>{
 const {store,request,scope,c}=fixture();assert.equal((await store.stage(request)).status,'PREVIEW_PAYLOAD_STAGED');assert.equal((await store.stage(request)).status,'PREVIEW_PAYLOAD_REPLAY');
 assert.equal((await store.stage({...request,payload:{title:'Modificado'}})).status,'PREVIEW_PAYLOAD_CONFLICT');assert.equal(await store.read(c,scope),null);
 assert.equal((await store.stage({...request,destination:'OPOL'})).status,'PREVIEW_PAYLOAD_STAGED');const read=await store.read(c,scope);assert.deepEqual(read.finalPayloads.OPURO,request.payload);assert.deepEqual(read.finalPayloads.OPOL,request.payload);
});
test('stale revision, wrong editor or selection cannot stage a proposal',async()=>{
 for(const change of [s=>s.state='READY',s=>s.revision--,s=>s.lease.actor_key='c'.repeat(64),s=>s.session='tg_'+'d'.repeat(40),s=>s.selection.action='CREATE',s=>s.selection.destination='LIBERAL']){
  const f=fixture();change(f.s);assert.notEqual((await f.store.stage(f.request)).status,'PREVIEW_PAYLOAD_STAGED');assert.equal(f.s.rows.length,0)
 }
});
test('tampered bytes, extra destinations and forged target fields are rejected',async()=>{
 const f=fixture();await f.store.stage(f.request);await f.store.stage({...f.request,destination:'OPOL'});f.s.rows[0].payload_json='{"title":"alterado"}';assert.equal(await f.store.read(f.c,f.scope),null);
 for(const bad of [{postId:123},{previewHash:'b'.repeat(64)},{exactPayload:true}])await assert.rejects(()=>f.store.stage({...f.request,...bad}),/INVALID_PREVIEW_PAYLOAD/);
});
test('Motor resolves an authorized administrator from the lease without transferring ownership',async()=>{
 const own=hash('opmx:telegram:v1:123:123'),admin=hash('opmx:telegram:v1:456:456'),state={actor:admin,receipt:'telegram-456-22-33',rows:[]};
 const c={async beginTransaction(){},async commit(){},async rollback(){},release(){},async execute(sql,args=[]){
  if(sql.includes('JOIN opmx_tg_recovery_leases'))return [[{owner_key:own,state:'OPEN',revision,actor_key:state.actor,lease_owner:own,receipt_id:state.receipt}]];
  if(sql.includes('FROM opmx_tg_quota'))return [[{id:1}]];
  if(sql.includes('FROM opmx_tg_packages'))return [[{owner_key:own,state:'OPEN',revision}]];
  if(sql.includes('FROM opmx_tg_recovery_leases'))return [[{actor_key:state.actor,owner_key:own,opening_revision:8}]];
  if(sql.includes('FROM opmx_tg_sessions'))return [args[0]===admin?[{package_id:packageId}]:[]];
  if(sql.startsWith('SELECT actor_key,payload_hash'))return [[]];
  if(sql.startsWith('INSERT INTO opmx_tg_preview_payloads')){state.rows.push(args);return [{affectedRows:1}]}
  throw Error(sql);
 }};
 const store=createPreviewPayloadStore({pool:{async getConnection(){return c}},adminUserIds:['456'],readSelection:async()=>({packageId,revision,ownerKey:own,action:'UPDATE',destination:'OPURO'})});
 const request={owner:'123',chat:'123',packageId,revision,destination:'OPURO',payload:{title:'Propuesta'}};
 assert.equal((await store.stageFromMotor(request)).status,'PREVIEW_PAYLOAD_STAGED');assert.equal(state.rows[0][3],admin);
 assert.equal((await store.stageFromMotor({...request,owner:'999',chat:'999'})).status,'NOT_AVAILABLE');
 state.receipt='telegram-999-22-33';assert.equal((await store.stageFromMotor(request)).status,'NOT_AVAILABLE');
});
