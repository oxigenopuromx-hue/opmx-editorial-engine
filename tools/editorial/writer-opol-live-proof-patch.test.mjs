import test from 'node:test';import assert from 'node:assert/strict';import {patchWriterOpolLiveProof as patch} from './writer-opol-live-proof-patch.mjs';
const one=`const opolPrincipalId=optionalCategoryId('x'),opolSecondaryId=undefined;
if (execution.create_opol && !CATEGORY_CATALOG.OPOL_ALLOWED.includes(categoryOpol)) {throw Error('old')}
if (execution.create_opol && categoryOpolSecondary !== null) {throw Error('old2')}
const seoCategory = str(SEO.CATEGORIA ?? SEO.category);
return {principal:categoryOpol,...(opolPrincipalId===undefined?{}:{principal_id:opolPrincipalId}),...(opolSecondaryId===undefined?{}:{secundaria_id:opolSecondaryId})};`;
const source=`if(branch){${one}}else{${one}}`;
function run(p,options={}){const {branch=true,primaryId=undefined,secondary='GUERRERO',requestId='r'}=options;const $=()=>({first:()=>({json:{categoryProof:p}})});return new Function('branch','execution','categoryOpol','categoryOpolSecondary','optionalCategoryId','envelope','$','str','SEO',patch(source))(branch,{create_opol:true},'ESTADOS',secondary,()=>primaryId,{request_id:requestId},$,String,{});}
const proof={status:'VERIFIED',site:'OPOL',requestId:'r',principal:{id:10,name:'ESTADOS'},secondary:{id:1731,name:'GUERRERO',parent:10}};
test('binds authenticated proof to request, names, IDs, and hierarchy in both branches',()=>{for(const branch of [true,false])assert.deepEqual(run(proof,{branch}),{principal:'ESTADOS',principal_id:10,secundaria_id:1731})});
test('refuses mismatched proof rather than falling back to stale catalog',()=>{for(const p of [{...proof,requestId:'other'},{...proof,site:'OPURO'},{...proof,principal:{id:11,name:'ESTADOS'}},{...proof,secondary:{...proof.secondary,parent:11}},null])assert.throws(()=>run(p,{primaryId:10}),/UNCONFIRMED/)});
test('refuses unknown source shapes',()=>assert.throws(()=>patch(one),/SOURCE_CHANGED/));
