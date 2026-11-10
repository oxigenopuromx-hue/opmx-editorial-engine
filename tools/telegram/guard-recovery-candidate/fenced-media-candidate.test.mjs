import test from 'node:test';
import assert from 'node:assert/strict';
import {beginFencedMedia,createClassifiedMediaRouter} from './fenced-media-candidate.mjs';
const input={requestId:'tg_'+'a'.repeat(64),slug:'nota-de-prueba',destination:'OPURO',role:'hero'};
function fixture({state='WRITING',bound=true,target=true,duplicate=false,lostCommit=false,changedBinding=false,packageState='READY',packageRevision=7}={}){
 let reads=0;const calls=[],c={async beginTransaction(){calls.push('begin')},async commit(){calls.push('commit');if(lostCommit)throw Error('lost')},async rollback(){calls.push('rollback')},release(){calls.push('release')},async execute(sql,args){calls.push({sql,args});
  if(sql.startsWith('SELECT package_id')){reads++;return [bound?[{package_id:'tg_'+(changedBinding&&reads===2?'c':'b').repeat(40),revision:7}]:[]]}
  if(sql.startsWith('SELECT state,revision'))return [[{state:packageState,revision:packageRevision}]];
  if(sql.startsWith('SELECT state'))return [state===null?[]:[{state}]];
  if(sql.startsWith('SELECT target_key'))return [target?[{target_key:'d'.repeat(64)}]:[]];
  if(sql.startsWith('UPDATE opmx_tg_publication_fence'))return [{affectedRows:1}];
  if(sql.startsWith('INSERT')){if(duplicate)throw Object.assign(Error('duplicate'),{code:'ER_DUP_ENTRY'});return [{affectedRows:1}]}
  throw Error('unexpected SQL');
 }};return {pool:{async getConnection(){return c}},calls};
}
test('media claim locks the same revision fence before target and insert',async()=>{
 const f=fixture();assert.deepEqual(await beginFencedMedia(f.pool,input),{status:'upload_started'});
 const q=f.calls.filter(x=>x.sql);assert.doesNotMatch(q[0].sql,/FOR UPDATE/);assert.match(q[1].sql,/packages.*FOR UPDATE/);assert.match(q[2].sql,/publication_fence.*FOR UPDATE/);assert.match(q[3].sql,/request_binding.*FOR UPDATE/);assert.match(q[4].sql,/target_progress.*FOR UPDATE/);assert.match(q[5].sql,/INSERT INTO opmx_mcp_media_progress/);assert.ok(f.calls.includes('commit'));
});
test('historical writing may finish its media while recovery stays fenced',async()=>{
 const f=fixture({state:'HISTORICAL_WRITING'});assert.equal((await beginFencedMedia(f.pool,input)).status,'upload_started');
 const g=fixture({state:'HISTORICAL_UNRECONCILED'});assert.equal((await beginFencedMedia(g.pool,input)).status,'upload_started');assert.ok(g.calls.some(x=>x.sql?.includes("SET state='HISTORICAL_WRITING'")));
 const h=fixture({state:'HISTORICAL_UNRECONCILED',target:false});assert.equal((await beginFencedMedia(h.pool,input)).status,'not_started');assert.equal(h.calls.some(x=>x.sql?.startsWith('UPDATE')),false);
});
test('missing, changed or fenced binding and missing target cannot start media',async()=>{
 for(const opt of [{bound:false},{packageState:'OPEN'},{packageRevision:8},{changedBinding:true},{state:'READY_TO_WRITE'},{state:'RECONCILING'},{state:'RECOVERY_FENCED'},{state:null},{target:false}]){
  const f=fixture(opt);assert.notEqual((await beginFencedMedia(f.pool,input)).status,'upload_started');assert.ok(f.calls.includes('rollback'));assert.equal(f.calls.some(x=>x.sql?.startsWith('INSERT')),false);
 }
});
test('duplicate and uncertain commits never grant another upload',async()=>{
 const f=fixture({duplicate:true});assert.equal((await beginFencedMedia(f.pool,input)).status,'already_started');
 const g=fixture({lostCommit:true});await assert.rejects(()=>beginFencedMedia(g.pool,input),/MEDIA_START_UNCONFIRMED/);
});
test('unsupported roles or destination are rejected before database access',async()=>{
 for(const patch of [{destination:'OPOL',role:'hero'},{role:'other'},{slug:'../bad'},{requestId:'legacy_request_123'}]){
  const f=fixture();await assert.rejects(()=>beginFencedMedia(f.pool,{...input,...patch}),/INVALID_MEDIA_REQUEST/);assert.equal(f.calls.length,0);
 }
});
test('unknown Telegram requests never fall back to a legacy media writer',async()=>{
 for(const rows of [[],[{kind:'LEGACY'}]]){let called=false,inserts=0;const c={async beginTransaction(){},async commit(){},async rollback(){},release(){},async execute(sql){if(sql.startsWith('INSERT'))inserts++;return [rows]}};
  const route=createClassifiedMediaRouter(async()=>{called=true});assert.equal((await route({async getConnection(){return c}},input)).status,'NOT_BOUND');assert.equal(called,false);assert.equal(inserts,0);
 }
});
test('malformed Telegram prefixes cannot fall through to legacy media',async()=>{
 for(const requestId of ['tg_not_a_valid_request','TG_'+'a'.repeat(64),'tg_'+'g'.repeat(64)]){let legacy=0,inserts=0;const c={async beginTransaction(){},async commit(){},async rollback(){},release(){},async execute(sql){if(sql.startsWith('INSERT'))inserts++;return [[]]}};
  const route=createClassifiedMediaRouter(async()=>{legacy++});assert.equal((await route({async getConnection(){return c}},{...input,requestId})).status,'NOT_BOUND');assert.equal(legacy,0);assert.equal(inserts,0);
 }
});
test('legacy media uses the existing writer only after durable classification',async()=>{
 const calls=[],c={async beginTransaction(){},async commit(){calls.push('commit')},async rollback(){},release(){},async execute(sql){return sql.startsWith('SELECT')?[[{kind:'LEGACY'}]]:[{affectedRows:1}]}};
 const pool={async getConnection(){return c}},request={...input,requestId:'legacy_request_123456'},route=createClassifiedMediaRouter(async(p,x)=>{assert.equal(p,pool);assert.equal(x,request);calls.push('legacy');return {status:'upload_started'}});
 assert.equal((await route(pool,request)).status,'upload_started');assert.deepEqual(calls,['commit','legacy']);
});
