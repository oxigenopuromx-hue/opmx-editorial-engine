import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCorrectionSelectionStore,readCorrectionSelectionInTransaction} from './correction-selection-store.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex'),packageId='tg_'+'a'.repeat(40),owner='123',ownerKey=hash('opmx:telegram:v1:123:123');
function setup({editor='123'}={}){let editorKey=hash(`opmx:telegram:v1:${editor}:${editor}`);let data={pack:{owner_key:ownerKey,state:'OPEN',revision:10},selections:[]},backup;
 const c={async beginTransaction(){backup=structuredClone(data)},async commit(){},async rollback(){data=backup},release(){},async execute(sql,args){
  if(sql.includes('FROM opmx_tg_quota'))return [[{id:1}]];
  if(sql.includes('FROM opmx_tg_packages'))return [[data.pack]];
  if(sql.includes('WHERE receipt_key='))return [data.selections.filter(x=>x.receipt_key===args[0])];
  if(sql.includes('FROM opmx_tg_recovery_leases'))return [[{actor_key:editorKey,owner_key:ownerKey,receipt_id:`telegram-${editor}-1-1`,opening_revision:8}]];
  if(sql.includes('FROM opmx_tg_sessions'))return [[{package_id:packageId}]];
  if(sql.includes('ORDER BY revision DESC'))return [data.selections.filter(x=>x.package_id===args[0]&&x.owner_key===args[1]&&x.revision>=args[2]).slice(-1)];
  if(sql.startsWith('INSERT INTO opmx_tg_correction_selections')){data.selections.push({package_id:args[0],revision:args[1],owner_key:args[2],receipt_key:args[3],message_id:args[4],mode:args[5],destination:args[6]});return [{affectedRows:1}]}
  if(sql.startsWith('UPDATE opmx_tg_packages')){if(data.pack.revision!==args[2])return [{affectedRows:0}];data.pack.revision=args[0];return [{affectedRows:1}]}
  if(sql.includes('JOIN opmx_tg_recovery_leases'))return [data.selections.filter(x=>args[0]===ownerKey&&x.package_id===args[1]&&x.revision<=args[2]&&x.revision>=2).slice(-1)];
  throw Error(sql);
 }};return {c,store:createCorrectionSelectionStore({pool:{async getConnection(){return c}}}),get data(){return data}};
}
const request={owner,chat:owner,packageId,revision:10,receiptId:'telegram-123-4-20',mode:'LITERAL',destination:'OPOL,OPURO'};
test('selection advances revision and reads only the exact stored decision',async()=>{
 const f=setup(),out=await f.store.select(request);assert.equal(out.revision,11);assert.equal(out.destination,'AMBOS');
 assert.equal((await f.store.select(request)).status,'SELECTION_REPLAY');
 assert.equal((await readCorrectionSelectionInTransaction(f.c,{packageId,revision:11,ownerKey})).destination,'AMBOS');
 assert.equal((await readCorrectionSelectionInTransaction(f.c,{packageId,revision:12,ownerKey})).destination,'AMBOS');
 assert.equal(await readCorrectionSelectionInTransaction(f.c,{packageId,revision:10,ownerKey}),null);
});
test('revision conflicts, different users, replay changes and delayed selections do not overwrite',async()=>{
 const f=setup();await f.store.select(request);
 assert.equal((await f.store.select({...request,mode:'EDITORIAL'})).status,'RECEIPT_CONFLICT');
 assert.equal((await f.store.select({...request,receiptId:'telegram-123-5-21'})).status,'STALE_REVISION');
 assert.equal((await f.store.select({...request,revision:11,receiptId:'telegram-123-3-22'})).status,'STALE_SELECTION');
 assert.equal((await f.store.select({...request,owner:'456',chat:'456',receiptId:'telegram-456-5-21',revision:11})).status,'NOT_AVAILABLE');
 assert.equal(f.data.selections.length,1);
});
test('the leased administrator can select without taking package ownership',async()=>{
 const f=setup({editor:'456'}),actorKey=hash('opmx:telegram:v1:456:456');
 const out=await f.store.select({...request,owner:'456',chat:'456',receiptId:'telegram-456-4-20'});
 assert.equal(out.status,'SELECTED');assert.equal(f.data.pack.owner_key,ownerKey);assert.equal(f.data.selections[0].owner_key,actorKey);
 assert.equal((await readCorrectionSelectionInTransaction(f.c,{packageId,revision:11,ownerKey,actorKey})).destination,'AMBOS');
 assert.equal(await readCorrectionSelectionInTransaction(f.c,{packageId,revision:11,ownerKey,actorKey:ownerKey}),null);
});
test('message ordering is confined to the current editor and recovery lease',async()=>{
 const f=setup({editor:'456'});f.data.selections.push({package_id:packageId,revision:7,owner_key:ownerKey,receipt_key:'old',message_id:'99999',mode:'EDITORIAL',destination:'OPURO'});
 const out=await f.store.select({...request,owner:'456',chat:'456',receiptId:'telegram-456-4-20'});
 assert.equal(out.status,'SELECTED');assert.equal(f.data.selections.length,2);
});
