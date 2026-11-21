import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEditorialDestinations as validate} from './horizonte-preflight.mjs';
const term=(id,slug)=>({id,slug,name:slug});
const response={statusCode:200,body:{category:[term(1,'sin-categoria')],ehc_region:[term(2,'bcs')],ehc_topic:[term(10,'politica')],ehc_municipality:[term(5,'la-paz')]}};
const master={SEO:{CATEGORIA:'Política'},CATEGORIAS:{OPURO:{PRINCIPAL:'Política'},HORIZONTE:{PRINCIPAL:'sin-categoria',REGION:'bcs',TEMA:'politica',TIPO:'news',MUNICIPIO:'la-paz'}}};
const catalog={sites:{OPURO:{allowed_names:['Política']}}};
test('queries Horizonte only when selected and validates its live terms',async()=>{
 let calls=0;const fetchHorizonteCatalog=async()=>{calls++;return response};
 assert.deepEqual(await validate(master,catalog,['OPURO'],{fetchHorizonteCatalog}),{ok:true,errors:[]});assert.equal(calls,0);
 assert.deepEqual(await validate(master,catalog,['OPURO','HORIZONTE'],{fetchHorizonteCatalog}),{ok:true,errors:[]});assert.equal(calls,1);
});
test('rejects missing, failed or incomplete catalog reads without silently falling back',async()=>{
 for(const fetchHorizonteCatalog of [undefined,async()=>{throw Error('timeout')},async()=>({statusCode:401}),async()=>({statusCode:200,body:{}})]){
  assert.deepEqual(await validate(master,catalog,['HORIZONTE'],{fetchHorizonteCatalog}),{ok:false,errors:['HORIZONTE_CATALOGO_NO_CONFIRMADO']});
 }
});
