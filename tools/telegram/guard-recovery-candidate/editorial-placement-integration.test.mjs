import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {request} from 'node:http';
import {prepareEditorialPlacementServices,patchEditorialPlacementGuardSource,patchEditorialPlacementPackageStoreSource,patchEditorialPlacementWiringSource} from './editorial-placement-integration.mjs';

async function patchedModule(relative,patch){const url=new URL(relative,import.meta.url),raw=await readFile(url,'utf8'),source=(raw.includes('EDITORIAL_PLACEMENT_GUARD_V1')||raw.includes('EDITORIAL_PLACEMENT_MANIFEST_V1')||raw.includes('readFinalPayloads=null,readEditorialPlacement=null,verifyEditorialPlacement=null,')?raw:patch(raw)).replace(/from (['"])(\.[^'"]+)\1/g,(_,quote,path)=>'from '+quote+new URL(path,url).href+quote);return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))}
const secret='a'.repeat(64);
async function call(server,path,{authorization='Bearer '+secret,method='POST',contentType='application/json',body='{}'}={}){return new Promise((resolve,reject)=>{const q=request({hostname:'127.0.0.1',port:server.address().port,path,method,headers:{authorization,'content-type':contentType}},r=>{let data='';r.on('data',x=>data+=x);r.on('end',()=>resolve({status:r.statusCode,body:JSON.parse(data)}))});q.on('error',reject);q.end(body)})}

test('real patched Guard keeps authentication/method/body limits before either placement route',async()=>{
 const {createGuard}=await patchedModule('./deployed-guard/guard-server.mjs',patchEditorialPlacementGuardSource);let calls=0;
 const server=createGuard({pool:{getConnection:async()=>{throw Error('unexpected DB')}},secret,telegramPlacement:{select:async input=>{calls++;return {status:'PLACEMENT_SELECTED',input}},prove:async input=>{calls++;return {status:'PLACEMENT_UNCHANGED',input,writesStarted:false}}}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  for(const path of ['/v1/telegram/placement/select','/v1/telegram/placement/prove']){
   assert.equal((await call(server,path,{authorization:'Bearer '+'b'.repeat(64)})).status,401);
   assert.equal((await call(server,path,{method:'GET'})).status,404);
   assert.equal((await call(server,path,{contentType:'text/plain'})).status,415);
   assert.equal((await call(server,path,{body:JSON.stringify({x:'a'.repeat(65536)})})).status,413);
  }
  assert.equal(calls,0);
  assert.equal((await call(server,'/v1/telegram/placement/select',{body:'{"ids":[]}'})).body.status,'PLACEMENT_SELECTED');
  assert.equal((await call(server,'/v1/telegram/placement/prove',{body:'{"ids":null}'})).body.writesStarted,false);
  assert.equal(calls,2);
 }finally{await new Promise(r=>server.close(r))}
});

test('schema failure exposes no placement service and releases its connection',async()=>{let release=0;await assert.rejects(()=>prepareEditorialPlacementServices({pool:{getConnection:async()=>({execute:async()=>{throw Error('DDL_FAILED')},release(){release++}})}}),/DDL_FAILED/);assert.equal(release,1);const service=await prepareEditorialPlacementServices({pool:{getConnection:async()=>({execute:async()=>{},release(){release++}})}});assert.equal(typeof service.prove,'function');assert.equal(release,2)});

test('real package manifest omits null projection, preserves prior wire fields and rejects malformed projection',async()=>{
 const {createTelegramPackageStore}=await patchedModule('./package-store.mjs',patchEditorialPlacementPackageStoreSource);
 const owner='123',ownerKey=createHash('sha256').update('opmx:telegram:v1:123:123').digest('hex'),packageId='tg_'+'a'.repeat(40),pack={package_id:packageId,owner_key:ownerKey,state:'OPEN',revision:7};
 const pool={getConnection:async()=>({beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},execute:async(sql,args)=>{
  if(sql.startsWith('CREATE ')||sql.startsWith('INSERT IGNORE'))return [];
  if(sql.includes('FROM opmx_tg_quota'))return [[{used_bytes:0,package_count:1}]];
  if(sql.startsWith('SELECT * FROM opmx_tg_packages'))return [args[0]===packageId&&args[1]===ownerKey?[pack]:[]];
  if(sql.startsWith('SELECT item_id,kind,state'))return [[]];
  throw Error('Unexpected SQL');
 }})};
 const input={owner,chat:owner,packageId},base=await createTelegramPackageStore(pool).run('manifest',input);
 const absent=await createTelegramPackageStore(pool,{readEditorialPlacement:async(c,scope)=>{assert.equal(scope.ownerKey,ownerKey);return null}}).run('manifest',input);
 assert.deepEqual(absent,base);assert.equal(Object.hasOwn(absent,'editorialPlacement'),false);
 const selection={status:'PLACEMENT_SELECTION',target:'OPURO',excluded_category_ids:['30']};
 assert.deepEqual((await createTelegramPackageStore(pool,{readEditorialPlacement:async()=>selection}).run('manifest',input)).editorialPlacement,selection);
 for(const value of [undefined,[],{status:'FORGED'},false])assert.deepEqual(await createTelegramPackageStore(pool,{readEditorialPlacement:async()=>value}).run('manifest',input),{status:'PLACEMENT_CONTEXT_UNCONFIRMED'});
 let unauthorisedReaderCalls=0;
 assert.deepEqual(await createTelegramPackageStore(pool,{readEditorialPlacement:async()=>{unauthorisedReaderCalls++;return selection}}).run('manifest',{...input,owner:'456',chat:'456'}),{status:'NOT_FOUND'});
 assert.equal(unauthorisedReaderCalls,0);assert.equal(pack.owner_key,ownerKey);
});

test('wiring omits absent optional UPDATE provider while rejecting malformed ones',async()=>{
 const {createRecoveryWiring}=await patchedModule('./recovery-wiring.mjs',patchEditorialPlacementWiringSource);
 const options={pool:{getConnection:async()=>{throw Error('unexpected DB')}},secret,events:{initialize:async()=>{},enqueue:async()=>{},run:async()=>{}},reviews:{run:async()=>{}},adminUserIds:[],verifyTerminalRun:async()=>null,verifyWriterCoverage:async()=>null,verifyDecisionConsumer:async()=>false,updateProviders:{verifyPayload:async()=>null,verifyCmsPreflight:async()=>null,verifyUpdateReadiness:async()=>false,verifyUpdateEnforcement:async()=>false},updateExecution:{wordpress:{read:async()=>null,update:async()=>null}}};
 assert.equal(typeof createRecoveryWiring(options).telegramUpdateExecutor.execute,'function');
 for(const verifyEditorialPlacement of [false,{},'permission'])assert.throws(()=>createRecoveryWiring({...options,verifyEditorialPlacement}),/PLACEMENT_CONFIGURATION_INVALID/);
 assert.equal(typeof createRecoveryWiring({...options,verifyEditorialPlacement:async()=>false}).telegramUpdateExecutor.execute,'function');
});
