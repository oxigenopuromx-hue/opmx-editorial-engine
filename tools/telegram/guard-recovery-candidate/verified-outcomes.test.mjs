import test from 'node:test';
import assert from 'node:assert/strict';
import {copyVerifiedOutcomes} from './verified-outcomes.mjs';
const existing={destination:'OPURO',status:'PUBLISHED',publicationVerdict:'CMS_RECORD_CONFIRMED',cmsVerified:true,wordpressStatus:'publish',postId:12,slug:'nota-real'};
const absent={destination:'OPOL',status:'BLOCKED',publicationVerdict:'NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'};
test('copies exact verified IDs and does not retain unrelated fields',()=>{
 assert.deepEqual(copyVerifiedOutcomes(['OPURO','OPOL'],[{...absent,untrusted:'ignored'},{...existing,untrusted:'ignored'}]),[existing,absent]);
});
test('uncertain, inconsistent, deleted, missing or duplicate destinations fail closed',()=>{
 for(const bad of [{...existing,wordpressStatus:'trash'},{...existing,cmsVerified:false},{...existing,postId:0},{...existing,slug:'x y'},{...existing,status:'DRAFT'}, {...existing,publicationVerdict:'UNKNOWN'}, {...existing,destination:'OPOL'}])assert.equal(copyVerifiedOutcomes(['OPURO','OPOL'],[bad,absent]),null);
 assert.equal(copyVerifiedOutcomes(['OPURO','OPOL'],[existing]),null);
});
