import test from 'node:test';import assert from 'node:assert/strict';import {buildOpolCategoryProof as build} from './writer-opol-category-proof.mjs';
const rows=[{id:10,name:'ESTADOS',slug:'estados',parent:0},{id:1731,name:'GUERRERO',slug:'guerrero',parent:10}];
const responses=[{statusCode:200,headers:{'x-wp-totalpages':'1','x-wp-total':'2'},body:rows}];
const master={CATEGORIAS:{OPOL:{PRINCIPAL:'ESTADOS',SECUNDARIA:'GUERRERO',SECUNDARIA_ID:1731}}};
const input={prepared:{request_id:'id',CREAR_EN:'AMBOS',json:JSON.stringify(master)},scopeApproved:true,scope:{requestId:'id',destinations:['OPURO','OPOL'],writeAuthorized:false},responses};
test('binds real hierarchical OPOL selection to the same request and scope',()=>{const p=build(input);assert.equal(p.principal.id,10);assert.equal(p.secondary.id,1731);assert.equal(p.requestId,'id')});
test('refuses absent, forged, ambiguous or mismatched proof inputs',()=>{
 for(const x of [{...input,scopeApproved:false},{...input,scope:{...input.scope,requestId:'other'}},{...input,scope:{...input.scope,destinations:['OPURO']}},{...input,prepared:{...input.prepared,CREAR_EN:'OPURO'}},{...input,responses:[{statusCode:401}]},{...input,prepared:{...input.prepared,json:JSON.stringify({CATEGORIAS:{OPOL:{PRINCIPAL:'ESTADOS',PRINCIPAL_ID:1731}}})}}])assert.throws(()=>build(x),/UNCONFIRMED/);
});
