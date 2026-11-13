import {readFileSync} from 'node:fs';
import {createHash as nodeCreateHash} from 'node:crypto';
import vm from 'node:vm';
import {categoryExclusionIds} from '../../../editorial/opuro-category-home.mjs';
import {acceptEditorialPlacementProof} from '../../../editorial/placement-provenance.mjs';
import {canonicalUpdateValue} from '../canonical-json.mjs';
import {expectedDraftRequestId} from '../correlation-candidate.mjs';
import {destinationRuntimeSource} from '../original-destinations.mjs';
import {parseDestinationCommand,parseContentModeCommand} from '../original-destination-command.mjs';
import {attestedControl,decodeControl,ORDER_PREFIX,POLICY,LEGACY_POLICY} from '../original-destination-policy.mjs';

const digest=x=>nodeCreateHash('sha256').update(x).digest('hex');

// LOCAL NATIVE NODE ONLY, matching the Guard runtime. Not an n8n Code QA.
// n8n hides object prototypes; executions38545/38550 did not validate this store.
// The emitted script has no module imports, credentials, fetch, require or I/O.
// The real store and transcript fixture functions are embedded unchanged.
// Only SHA256 is replaced by declared fixed-fixture vectors, computed at build
// time with Node crypto; unseen runtime inputs throw instead of being hashed.
export async function buildEditorialPlacementStoreQaCode() {
 const raw=readFileSync(new URL('../editorial-placement-store.mjs',import.meta.url),'utf8');
 const storeSource=raw.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
 const unit=readFileSync(new URL('../editorial-placement-store.test.mjs',import.meta.url),'utf8');
 const fixtureStart=unit.indexOf('function fixture('),fixtureEnd=unit.indexOf('\n\ntest(',fixtureStart),itemStart=unit.indexOf('const item=');
 if(fixtureStart<0||fixtureEnd<0||itemStart<0)throw Error('PLACEMENT_QA_FIXTURE_SOURCE_CHANGED');
 const fixture=unit.slice(itemStart,fixtureEnd);
 const destinationSource=readFileSync(new URL('../original-destination-policy.mjs',import.meta.url),'utf8');
 const validControl=destinationSource.slice(destinationSource.indexOf('function validControl('),destinationSource.indexOf('\nexport const ORDER_PREFIX'));
 const dependencies=[categoryExclusionIds,canonicalUpdateValue,expectedDraftRequestId,parseDestinationCommand,parseContentModeCommand,attestedControl,decodeControl,acceptEditorialPlacementProof].map(fn=>fn.toString()).join('\n');
 const head=`// LOCAL NATIVE NODE ONLY: retain the same plain-object invariant as Guard.\nconst object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;\nconst labels=new Set(['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS']);\nconst ORDER_PREFIX=${JSON.stringify(ORDER_PREFIX)},POLICY=${JSON.stringify(POLICY)},LEGACY_POLICY=${JSON.stringify(LEGACY_POLICY)};\nconst structuredClone=x=>JSON.parse(JSON.stringify(x));let assertions=0;const assert={equal(a,b){assertions++;if(a!==b)throw Error('QA_FIXTURE_ASSERTION')}};\nasync function readLiteralScopeInTransaction(){throw Error('QA_DEFAULT_SCOPE_IS_NOT_A_FIXTURE')}\nasync function readVerifiedUpdateDecisionInTransaction(){throw Error('QA_DEFAULT_UPDATE_IS_NOT_A_FIXTURE')}\n`;
 const plan=`\nconst packageId='tg_'+'a'.repeat(40),owner='123',ownerKey=hash('opmx:telegram:v1:123:123');\n${fixture}\nconst outcomes=[];let databaseStatements=0;const check=(value,label)=>{assertions++;if(!value)throw Error('PLACEMENT_QA_FAILED:'+label)};const record=(name,f)=>{databaseStatements+=f.queries.length;outcomes.push(name)};\n{
 const f=fixture();check((await f.store.select(f.input)).status==='PLACEMENT_SELECTED','ordinary select');f.ready();const input={requestId:f.request(),ids:['30']},r=await f.store.prove(input);check(r.status==='PLACEMENT_VERIFIED','ordinary proof');check(r.EDITORIAL_PLACEMENT.request_id===f.request(),'request binding');check(r.EDITORIAL_PLACEMENT.target==='OPURO','target');check(r.writeAuthorized===false&&r.writesStarted===false,'not a write grant');check(acceptEditorialPlacementProof(input,{statusCode:200,body:r}).mode==='DIRECT_OPERATOR','real proof adapter accept');check((await f.store.prove({...input,ids:null})).status==='PLACEMENT_UNCONFIRMED','orphan');record('ordinary bound proof and orphan',f);
}
{
 const f=fixture({actor:'456',recovery:true});check((await f.store.select(f.input)).status==='PLACEMENT_SELECTED','admin select');f.ready();check(f.data.lease.length===0,'sealed lease gone');check((await f.store.prove({requestId:f.request(),ids:['30']})).status==='PLACEMENT_VERIFIED','durable closure');await f.c.beginTransaction();try{const p=await readPlacementForManifest(f.c,{packageId,revision:f.data.pack.revision,ownerKey,actorKey:ownerKey},{readScope:f.scope});check(p.status==='PLACEMENT_SELECTION','READY projection');check(p.request_id===f.request(),'projection request')}finally{await f.c.rollback()}record('leased admin after atomic cleanup',f);
}
{
 const f=fixture();await f.store.select(f.input);const b={...f.input,revision:11,receiptId:'telegram-123-41-101',ids:[]};await f.store.select(b);check((await f.store.select({...f.input,revision:12})).status==='STALE_PLACEMENT','superseded A');check((await f.store.select({...b,revision:12})).status==='PLACEMENT_REPLAY','current replay');check(f.data.pack.revision===12&&f.data.rows.length===2,'no replay bump');f.ready();check((await f.store.prove({requestId:f.request(),ids:[]})).status==='PLACEMENT_VERIFIED','explicit empty');record('latest receipt and explicit empty',f);
}
{
 const f=fixture();await f.store.select(f.input);await f.store.select({...f.input,revision:11,receiptId:'telegram-123-41-101',ids:null});await f.c.beginTransaction();try{const p=await readPlacementForManifest(f.c,{packageId,revision:12,ownerKey});check(p.status==='PLACEMENT_PRESERVE'&&!Object.hasOwn(p,'excluded_category_ids'),'preserve projection')}finally{await f.c.rollback()}f.ready();f.data.scopeDestination='OPOL';check((await f.store.prove({requestId:f.request('OPOL'),ids:null})).status==='PLACEMENT_UNCHANGED','withdrawal then OPOL');check((await f.store.prove({requestId:f.request('OPOL'),ids:[]})).status==='PLACEMENT_UNCONFIRMED','withdrawal is not empty');record('preserve tombstone',f);
}
{
 const f=fixture({actor:'456',recovery:true});await f.store.select(f.input);f.ready();f.data.scopeAction='UPDATE';f.data.finalPayloads={OPURO:{meta:{oxpuro_excluded_category_ids:['30']}},OPOL:{excerpt:'Aprobado'},LIBERAL:{excerpt:'Aprobado'}};const x={packageId,revision:f.data.pack.revision,destination:'OPOL',previewHash:f.data.scopePreviewHash,payload:{excerpt:'Aprobado'}};await f.c.beginTransaction();try{check(await verifyUpdateEditorialPlacementInTransaction(f.c,x,{readDecision:f.scope}),'OPOL of TODOS');check(!await verifyUpdateEditorialPlacementInTransaction(f.c,{...x,payload:{excerpt:'Otro'}},{readDecision:f.scope}),'changed update')}finally{await f.c.rollback()}record('full UPDATE destination scope',f);
}
{
 const f=fixture();f.ready();f.data.fence=[{state:'HISTORICAL_WRITING'}];const badScope=async()=>{throw Error('QA_LEGACY_SCOPE_UNAVAILABLE')};await f.c.beginTransaction();try{check(await readPlacementForManifest(f.c,{packageId,revision:f.data.pack.revision,ownerKey},{readScope:badScope})===null,'legacy manifest unchanged');check((await readEditorialPlacementForRequestInTransaction(f.c,{requestId:f.request(),ids:null},{readScope:badScope})).status==='PLACEMENT_UNCHANGED','legacy no option');check((await readEditorialPlacementForRequestInTransaction(f.c,{requestId:f.request(),ids:[]},{readScope:badScope})).status==='PLACEMENT_UNCONFIRMED','legacy explicit blocked')}finally{await f.c.rollback()}record('historical absence compatibility',f);
}
{
 const f=fixture();await f.store.select(f.input);f.ready();f.data.pack.revision=19;f.data.scopeBaseRevision=15;f.data.scopeAction='UPDATE';f.data.finalPayloads={OPURO:{excerpt:'Cambio'},OPOL:{excerpt:'Cambio'},LIBERAL:{excerpt:'Cambio'}};f.data.closures=[{snapshot_revision:15,actor_key:ownerKey,close_receipt_key:hash('new-close')}];check((await f.store.prove({requestId:f.request(),ids:null})).status==='PLACEMENT_UNCHANGED','new cycle absence');check((await f.store.prove({requestId:f.request(),ids:['30']})).status==='PLACEMENT_UNCONFIRMED','new cycle no inherited authority');record('no previous-cycle authority',f);
}
{
 const f=fixture();let denied=false;try{await f.store.select({...f.input,confirmed:true})}catch{denied=true}check(denied&&f.data.rows.length===0,'asserted envelope not accepted');f.data.session=[];check((await f.store.select(f.input)).status==='NOT_AVAILABLE','no session');record('forged body and missing session',f);
}
return [{json:{status:'EDITORIAL_PLACEMENT_STORE_QA_PASSED',executionRuntime:'LOCAL_NATIVE_NODE_ONLY',n8nEvidence:false,cases:outcomes.length,assertions,databaseStatements,hashMode:'PRECOMPUTED_SHA256_FIXED_FIXTURE_VECTORS',hashVectors:__QA_HASH_VECTOR_COUNT__,guardSourceSha256:${JSON.stringify(digest(raw))},syntheticFixturesOnly:true,realDatabaseConnections:0,cmsWrites:0,telegramMessages:0,n8nMutations:0,externalIoCalls:0,outcomes}}];`;
 const core=head+destinationRuntimeSource()+'\n'+validControl+'\n'+dependencies+'\n'+storeSource+'\n'+plan;
 const vectors={};
 const createHash=algorithm=>{if(algorithm!=='sha256')throw Error('QA_HASH_ALGORITHM');let text='';return {update(value){if(typeof value!=='string')throw Error('QA_HASH_INPUT');text+=value;return this},digest(format){if(format!=='hex')throw Error('QA_HASH_FORMAT');return vectors[text]=digest(text)}}};
 await new vm.Script('(async()=>{'+core.replace('__QA_HASH_VECTOR_COUNT__','0')+'})()').runInNewContext({Buffer,createHash});
 const provider=`// QA ONLY: immutable fixture SHA256 vectors; production uses Node crypto.\nconst qaHashVectors=${JSON.stringify(vectors)};\nfunction createHash(algorithm){if(algorithm!=='sha256')throw Error('QA_HASH_ALGORITHM');let text='';return {update(value){if(typeof value!=='string')throw Error('QA_HASH_INPUT');text+=value;return this},digest(format){if(format!=='hex'||!Object.hasOwn(qaHashVectors,text))throw Error('QA_UNRECOGNISED_HASH_VECTOR');return qaHashVectors[text]}}}\n`;
 return provider+core.replace('__QA_HASH_VECTOR_COUNT__',String(Object.keys(vectors).length));
}
