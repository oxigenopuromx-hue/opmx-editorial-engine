import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReopenService} from './reopen-service.mjs';

const hash=id=>createHash('sha256').update(`opmx:telegram:v1:${id}:${id}`).digest('hex');
const id='tg_'+'a'.repeat(40);
const input=who=>({owner:who,chat:who,packageId:id,receiptId:`telegram-${who}-1-2`});
function fixture({failAudit=false}={}){
  const state={pkg:{ownerKey:hash('123'),state:'READY',revision:7},session:new Map(),lease:null,snapshots:[],audits:[],items:[{id:'one',state:'STORED'}],prior:{packageId:id,revision:7,ownerKey:hash('123'),requestId:'req-7',destinations:['OPURO','LIBERAL'],authorization:{mode:'PUBLISH',authorized:true},controls:['control-1'],results:[{destination:'OPURO',status:'BLOCKED',publicationVerdict:'NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'},{destination:'LIBERAL',status:'BLOCKED',publicationVerdict:'NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'}]},barrier:{id:'barrier',packageId:id,revision:7,terminalBlocked:true,noActiveAttempts:true,noPublicationSideEffects:true,writesFenced:true}};
  let queue=Promise.resolve();
  const db={transaction(fn){const result=queue.then(async()=>{
    const before=structuredClone(state);
    const tx={async lockQuota(){},async lockPackage(){return {...state.pkg}},async lockSession(actor){return state.session.get(actor)},async lockLease(){return state.lease},async lockSafetyBarrier(){return state.barrier},async lockInventory(){return state.items},async captureTrustedRevision(){return state.prior},async saveSnapshot(x){state.snapshots.push(structuredClone(x))},async markOpen(x){if(state.pkg.revision!==x.expectedRevision)throw Error('CONFLICT');state.pkg.state='OPEN';state.pkg.revision=x.revision},async createLease(x){if(state.lease)throw Error('CONFLICT');state.lease=x},async createSession(x){if(state.session.has(x.actorKey))throw Error('CONFLICT');state.session.set(x.actorKey,{packageId:x.packageId})},async audit(x){if(failAudit)throw Error('AUDIT_FAILED');state.audits.push(x)}};
    try{return await fn(tx)}catch(e){Object.assign(state,before);throw e;}
  });queue=result.catch(()=>{});return result;}};
  return {state,service:createReopenService({db,adminUserIds:['456']})};
}
test('owner reopens and duplicate command is idempotent',async()=>{const {state,service}=fixture();assert.equal((await service(input('123'))).status,'OPEN');assert.equal((await service(input('123'))).status,'OPEN_REPLAY');assert.equal(state.snapshots.length,1);assert.equal(state.audits.length,1);assert.equal(state.pkg.revision,8);});
test('administrator can reopen without transferring ownership',async()=>{const {state,service}=fixture();assert.equal((await service(input('456'))).status,'OPEN');assert.equal(state.pkg.ownerKey,hash('123'));assert.equal(state.lease.actorKey,hash('456'));assert.equal(state.lease.ownerKey,hash('123'));});
test('other operator is denied without disclosing package',async()=>{const {state,service}=fixture();assert.equal((await service(input('789'))).status,'NOT_FOUND');assert.equal(state.pkg.state,'READY');});
test('busy session does not overwrite existing work',async()=>{const {state,service}=fixture();state.session.set(hash('456'),{packageId:'tg_'+'b'.repeat(40)});assert.equal((await service(input('456'))).status,'SESSION_BUSY');assert.equal(state.snapshots.length,0);});
test('two concurrent actors result in just one editor',async()=>{const {state,service}=fixture();const result=await Promise.all([service(input('123')),service(input('456'))]);assert.deepEqual(result.map(x=>x.status).sort(),['NOT_REOPENABLE','OPEN']);assert.equal(state.snapshots.length,1);assert.equal(state.session.size,1);});
test('uncertain publication, active workers and old evidence fail closed',async()=>{for(const patch of [{noPublicationSideEffects:false},{noActiveAttempts:false},{writesFenced:false},{revision:6}]){const {state,service}=fixture();Object.assign(state.barrier,patch);assert.equal((await service(input('123'))).status,'RECONCILIATION_REQUIRED');assert.equal(state.pkg.state,'READY');}});
test('pending originals block recovery without discarding bytes',async()=>{const {state,service}=fixture();state.items.push({id:'two',state:'PENDING'});assert.equal((await service(input('123'))).status,'PENDING_RESERVATION');assert.equal(state.items.length,2);});
test('complete previous authorization, destinations, controls and results are preserved',async()=>{const {state,service}=fixture();const before=structuredClone(state.prior);assert.equal((await service(input('123'))).status,'OPEN');assert.deepEqual(state.snapshots[0].prior,before);state.prior.authorization.mode='DRAFT';assert.deepEqual(state.snapshots[0].prior,before);});
test('missing, stale or incomplete previous publication metadata prevents reopening',async()=>{for(const patch of [{requestId:''},{destinations:[]},{authorization:{}},{controls:null},{results:[]},{revision:6},{ownerKey:hash('456')},{results:[{destination:'OPURO',status:'BLOCKED'},{destination:'OPURO',status:'BLOCKED'}]}]){const {state,service}=fixture();Object.assign(state.prior,patch);assert.equal((await service(input('123'))).status,'RECONCILIATION_REQUIRED');assert.equal(state.pkg.state,'READY');assert.equal(state.snapshots.length,0);}});
test('contradictory published, draft, partial and uncertain destination outcomes never reopen',async()=>{
  for(const status of ['PUBLISHED','DRAFT','PARTIAL','UNKNOWN']){
    const {state,service}=fixture();state.prior.results[0].status=status;
    assert.equal((await service(input('123'))).status,'RECONCILIATION_REQUIRED',status);
    assert.equal(state.pkg.state,'READY');assert.equal(state.snapshots.length,0);
  }
});
test('a blocked result without confirmed absence of publication stays closed',async()=>{
  for(const verdict of [undefined,'UNKNOWN','PARTIAL','PUBLISHED']){
    const {state,service}=fixture();state.prior.results[1].publicationVerdict=verdict;
    assert.equal((await service(input('123'))).status,'RECONCILIATION_REQUIRED');
    assert.equal(state.pkg.state,'READY');assert.equal(state.snapshots.length,0);
  }
});
test('private identity and receipt must match',async()=>{const {service}=fixture();assert.equal((await service({...input('123'),chat:'456'})).status,'INVALID_REQUEST');assert.equal((await service({...input('123'),receiptId:'telegram-456-1-2'})).status,'INVALID_REQUEST');});
test('a failed write rolls back snapshot, revision, lease and session',async()=>{const {state,service}=fixture({failAudit:true});await assert.rejects(service(input('123')),/AUDIT_FAILED/);assert.equal(state.pkg.state,'READY');assert.equal(state.pkg.revision,7);assert.equal(state.snapshots.length,0);assert.equal(state.lease,null);assert.equal(state.session.size,0);});
