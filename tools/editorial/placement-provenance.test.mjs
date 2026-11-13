import test from 'node:test';import assert from 'node:assert/strict';
import {prepareEditorialPlacementCheck,acceptEditorialPlacementProof} from './placement-provenance.mjs';
const requestId='tg_'+'a'.repeat(64),master=ids=>({PUBLICACION:{OPURO:{EXCLUIR_PORTADA_CATEGORIAS_IDS:ids}}});
const proof=(ids=[])=>({statusCode:200,body:{status:'PLACEMENT_VERIFIED',writesStarted:false,retryPermitted:false,EDITORIAL_PLACEMENT:{mode:'DIRECT_OPERATOR',target:'OPURO',confirmed:true,request_id:requestId,excluded_category_ids:ids}}});
test('declaration is never an operator proof and the Guard request carries no source assertions',()=>{
 const m=master(['30']);m.EDITORIAL_PLACEMENT=proof(['30']).body.EDITORIAL_PLACEMENT;const input=prepareEditorialPlacementCheck(requestId,m,true);assert.deepEqual(input,{requestId,ids:['30']});assert.throws(()=>acceptEditorialPlacementProof(input,{statusCode:200,body:m}),/UNCONFIRMED/);
});
test('explicit empty array requires the same separate proof as a nonempty list',()=>{
 for(const ids of [[],['30']]){const input=prepareEditorialPlacementCheck(requestId,master(ids),true);assert.deepEqual(acceptEditorialPlacementProof(input,proof(ids)).excluded_category_ids,ids);assert.throws(()=>acceptEditorialPlacementProof(input,{statusCode:200,body:{status:'PLACEMENT_UNCHANGED',requestId,writesStarted:false,retryPermitted:false}}),/UNCONFIRMED/)}
});
test('omitted field accepts only an unchanged response for this exact request and no orphan control',()=>{
 const input=prepareEditorialPlacementCheck(requestId,{PUBLICACION:{}},true);assert.equal(input.ids,null);assert.equal(acceptEditorialPlacementProof(input,{statusCode:200,body:{status:'PLACEMENT_UNCHANGED',requestId,writesStarted:false,retryPermitted:false}}),null);assert.throws(()=>acceptEditorialPlacementProof(input,proof([])),/UNCONFIRMED/);
});
test('scope, target, list, confirmation, transport status and write assertions cannot be substituted',()=>{
 const input=prepareEditorialPlacementCheck(requestId,master(['30']),true);
 for(const patch of [{mode:'EDITORIAL'},{target:'OPOL'},{confirmed:false},{request_id:'tg_'+'b'.repeat(64)},{excluded_category_ids:[]},{excluded_category_ids:[30]},{extra:'caller'}]){const r=proof(['30']);Object.assign(r.body.EDITORIAL_PLACEMENT,patch);assert.throws(()=>acceptEditorialPlacementProof(input,r),/UNCONFIRMED/)}
 for(const change of [r=>r.statusCode=503,r=>r.body.writesStarted=true,r=>r.body.retryPermitted=true]){const r=proof(['30']);change(r);assert.throws(()=>acceptEditorialPlacementProof(input,r),/UNCONFIRMED/)}
});
