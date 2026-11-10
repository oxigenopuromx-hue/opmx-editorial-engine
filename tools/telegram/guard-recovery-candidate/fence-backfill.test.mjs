import test from 'node:test';
import assert from 'node:assert/strict';
import {backfillHistoricalFences} from './fence-backfill.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
const id='tg_'+'a'.repeat(40),event='evt_'+'b'.repeat(48);
function setup({conflict=false,bindingConflict=false,missingBinding=false}={}){
 const calls=[];let committed=0,rolled=0;const bindings=new Map();
 const c={async beginTransaction(){},async commit(){committed++},async rollback(){rolled++},release(){},async execute(sql,args=[]){
  calls.push({sql,args});
  if(sql.startsWith('SELECT id FROM opmx_tg_quota'))return [[{id:1}]];
  if(sql.startsWith('SELECT event_id'))return [[{event_id:event,package_id:id,revision:7}]];
  if(sql.startsWith('INSERT IGNORE INTO opmx_tg_request_binding')){for(let i=0;i<args.length;i+=3)bindings.set(args[i],{request_id:args[i],package_id:args[i+1],revision:args[i+2]});return [{affectedRows:args.length/3}]}
  if(sql.startsWith('SELECT request_id,kind'))return [args.map(request_id=>({request_id,kind:conflict?'LEGACY':'TELEGRAM'}))];
  if(sql.startsWith('SELECT request_id,package_id,revision')){const rows=args.map(x=>bindings.get(x));if(bindingConflict)rows[0]={...rows[0],revision:8};if(missingBinding)rows.pop();return [rows]}
  if(sql.startsWith('INSERT IGNORE'))return [{affectedRows:1}];
  throw Error(sql);
 }};
 return {pool:{async getConnection(){return c}},calls,get committed(){return committed},get rolled(){return rolled}};
}
test('historical bindings remain unreconciled and cannot authorize recovery',async()=>{
 const f=setup();assert.deepEqual(await backfillHistoricalFences(f.pool),{status:'HISTORICAL_BINDINGS_RECORDED',revisions:1,recoveryEnabled:false});
 assert.equal(f.committed,1);assert.equal(f.calls.filter(x=>x.sql.startsWith('INSERT IGNORE INTO opmx_tg_request_binding')).length,1);
 assert.match(f.calls.find(x=>x.sql.startsWith('INSERT IGNORE INTO opmx_tg_publication_fence')).sql,/HISTORICAL_UNRECONCILED/);
 assert.equal(f.calls.some(x=>/SAFE_TO_REOPEN|READY_TO_WRITE/.test(x.sql)),false);
});
test('a preexisting incompatible classification rolls back the migration',async()=>{
 const f=setup({conflict:true});await assert.rejects(()=>backfillHistoricalFences(f.pool),/HISTORICAL_CLASS_CONFLICT/);assert.equal(f.rolled,1);assert.equal(f.committed,0);
});
test('lazy backfill only records a revision whose server-derived key matches',async()=>{
 const f=setup(),requestId=expectedDraftRequestId({packageId:id,revision:7,destination:'TODOS'});
 assert.equal((await backfillHistoricalFences(f.pool,{onlyRequestId:requestId})).revisions,1);
 const unknown=setup();assert.equal((await backfillHistoricalFences(unknown.pool,{onlyRequestId:'tg_'+'9'.repeat(64)})).revisions,0);
 assert.equal(unknown.calls.some(x=>x.sql.startsWith('INSERT')),false);
});

test('a conflicting or missing historical binding rolls back all batches',async()=>{
 for(const options of [{bindingConflict:true},{missingBinding:true}]){const f=setup(options);await assert.rejects(()=>backfillHistoricalFences(f.pool),/HISTORICAL_BINDING_CONFLICT/);assert.equal(f.rolled,1);assert.equal(f.committed,0)}
});
