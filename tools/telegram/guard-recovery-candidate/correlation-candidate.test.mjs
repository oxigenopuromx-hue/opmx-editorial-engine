import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedDraftRequestId,matchCandidateCorrelation} from './correlation-candidate.mjs';
const packageId='tg_'+'a'.repeat(40);
const destinations=['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'];
test('all active receiver destination labels get stable distinct candidate identifiers',()=>{
  const ids=destinations.map(destination=>expectedDraftRequestId({packageId,revision:7,destination}));
  assert.equal(ids.at(-1),'tg_c47f52f680ba5fe08df5ae9412b6ec30d83d1e2b1dcd61909eab843f428afc53');
  assert.equal(new Set(ids).size,7);
  for(const [i,destination] of destinations.entries())assert.equal(matchCandidateCorrelation({packageId,revision:7,destination,requestId:ids[i]}),true);
});
test('candidate identifiers cannot be reused across package revisions or destinations',()=>{
  const requestId=expectedDraftRequestId({packageId,revision:7,destination:'TODOS'});
  assert.equal(matchCandidateCorrelation({packageId,revision:8,destination:'TODOS',requestId}),false);
  assert.equal(matchCandidateCorrelation({packageId:'tg_'+'b'.repeat(40),revision:7,destination:'TODOS',requestId}),false);
  assert.equal(matchCandidateCorrelation({packageId,revision:7,destination:'AMBOS',requestId}),false);
});
test('reject malformed revision, package and noncanonical destination',()=>{
  for(const x of [{packageId:'tg_bad',revision:7,destination:'OPURO'},{packageId,revision:0,destination:'OPURO'},{packageId,revision:7,destination:'OPOL,OPURO'}])assert.throws(()=>expectedDraftRequestId(x),/INVALID_CORRELATION/);
});
