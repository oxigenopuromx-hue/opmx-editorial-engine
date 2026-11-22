import test from 'node:test';import assert from 'node:assert/strict';import {patchWriterSitesLiveProof as patch} from './writer-sites-live-proof-patch.mjs';
const one=`const liberalCategory=str(CATS.LIBERAL?.PRINCIPAL??CATS.LIBERAL?.principal??CATS.liberal?.PRINCIPAL??CATS.liberal?.principal);
return {opuro:{principal:category,...(opuroPrincipalId===undefined?{}:{principal_id:opuroPrincipalId})},liberal:{principal:liberalCategory,...(liberalPrincipalId===undefined?{}:{principal_id:liberalPrincipalId})}};`;
const source=`if(branch){${one}}else{${one}}`;
const proofs={OPURO:{status:'VERIFIED',site:'OPURO',requestId:'r',principal:{name:'Deporte',id:43}},LIBERAL:{status:'VERIFIED',site:'LIBERAL',requestId:'r',principal:{name:'Economía',id:3}}};
function run(p=proofs,branch=true){const $=name=>({first:()=>({json:{categoryProof:p[name.includes('OPURO')?'OPURO':'LIBERAL']}})});return new Function('branch','str','CATS','execution','category','opuroPrincipalId','liberalPrincipalId','envelope','$',patch(source))(branch,String,{LIBERAL:{PRINCIPAL:'Economía'}},{create_opuro:true,create_liberal:true},'Deporte',43,3,{request_id:'r'},$)}
test('binds each site proof to its own name and request in both branches',()=>{for(const branch of [true,false])assert.deepEqual(run(proofs,branch),{opuro:{principal:'Deporte',principal_id:43},liberal:{principal:'Economía',principal_id:3}})});
test('rejects a foreign or stale site proof',()=>{assert.throws(()=>run({...proofs,OPURO:{...proofs.OPURO,site:'LIBERAL'}}),/UNCONFIRMED/);assert.throws(()=>run({...proofs,OPURO:{...proofs.OPURO,requestId:'old'}}),/UNCONFIRMED/)});
test('checks the production anchors before changing code',()=>assert.throws(()=>patch(one),/SOURCE_CHANGED/));
