import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHorizonteCatalog as read} from './horizonte-catalog.mjs';
import {validateSelectedCategories} from './category-validation.mjs';
const item=(id,slug)=>({id,slug,name:slug});
const body={category:[item(1,'sin-categoria')],ehc_region:[item(2,'bcs')],ehc_topic:[item(10,'politica')],ehc_municipality:[item(5,'la-paz')]};
test('verified response feeds the selected editorial validator',()=>{
 const catalog=read({statusCode:200,body});const master={CATEGORIAS:{HORIZONTE:{PRINCIPAL:'sin-categoria',REGION:'bcs',TEMA:'politica',TIPO:'news',MUNICIPIO:'la-paz'}}};
 assert.deepEqual(validateSelectedCategories(master,{},['HORIZONTE'],{horizonteCatalog:catalog}),{ok:true,errors:[]});
});
test('fails closed for missing, ambiguous, oversized and unsuccessful CMS responses',()=>{
 for(const response of [{statusCode:401,body},{statusCode:200,body:{...body,ehc_region:[]}},{statusCode:200,body:{...body,category:[item(1,'sin-categoria'),item(2,'sin-categoria')]}},{statusCode:200,body:{...body,ehc_topic:Array.from({length:100},(_,i)=>item(i+1,`term-${i}`))}},{statusCode:200,body:{...body,unexpected:[]}}])assert.throws(()=>read(response),/HORIZONTE_CATALOG_UNCONFIRMED/);
});
