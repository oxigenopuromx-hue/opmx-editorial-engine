import test from 'node:test';import assert from 'node:assert/strict';import {buildSiteCategoryProof as build} from './writer-site-category-proof.mjs';
const rows=[{id:21,name:'Deporte',slug:'deporte',parent:0},{id:43,name:'Deporte',slug:'deporte-noticias',parent:0}];
const responses=[{statusCode:200,headers:{'x-wp-totalpages':'1','x-wp-total':'2'},body:rows}];
const master={CATEGORIAS:{OPURO:{PRINCIPAL:'Deporte',PRINCIPAL_ID:43}}};
const id='tg_'+'a'.repeat(64),prepared={request_id:id,CREAR_EN:'AMBOS',json:JSON.stringify(master)},scope={requestId:id,destinations:['OPURO','OPOL'],writeAuthorized:false};
test('preserves the chosen ID in its own destination catalog',()=>assert.equal(build({site:'OPURO',prepared,scopeApproved:true,scope,responses}).principal.id,43));
test('refuses cross-site scope, unspecified ambiguous IDs and untrusted request',()=>{
 for(const x of [{site:'LIBERAL',prepared,scopeApproved:true,scope,responses},{site:'OPURO',prepared,scopeApproved:true,scope:null,responses},{site:'OPURO',prepared:{...prepared,json:JSON.stringify({CATEGORIAS:{OPURO:{PRINCIPAL:'Deporte'}}})},scopeApproved:true,scope,responses},{site:'OPURO',prepared,scopeApproved:false,scope,responses}])assert.throws(()=>build(x),/UNCONFIRMED/);
});
