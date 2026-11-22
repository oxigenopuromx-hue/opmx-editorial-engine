import {normalizeWriterCategoryPages} from './writer-category-pages.mjs';
import {resolveCategory} from './live-category-catalog.mjs';

// For OPURO and LIBERAL only; the graph must supply authenticated CMS pages,
// fixed server-owned host and Guard scope, never caller-provided catalog data.
export function buildSiteCategoryProof({site,prepared,scopeApproved,scope,responses,perPage=100}={}) {
 const fail=()=>{throw Error('SITE_CATEGORY_PROOF_UNCONFIRMED')};
 if(!['OPURO','LIBERAL'].includes(site)||scopeApproved!==true||!prepared||typeof prepared.json!=='string'||typeof prepared.request_id!=='string'||!prepared.request_id||prepared.request_id.length>256)fail();
 const value=prepared.CREAR_EN;if(typeof value!=='string'||!value.trim())fail();
 const tokens=value.toUpperCase().split(',').map(x=>x.trim()),allowed=['OPURO','OPOL','LIBERAL','HORIZONTE','AMBOS','ACTIVOS','TODOS'];
 const selecting=site==='OPURO'?['OPURO','AMBOS','ACTIVOS','TODOS']:['LIBERAL','ACTIVOS','TODOS'];
 if(tokens.some(x=>!allowed.includes(x))||!tokens.some(x=>selecting.includes(x)))fail();
 if(/^tg_[a-f0-9]{64}$/.test(prepared.request_id)&&!scope)fail();
 if(scope!==null&&scope!==undefined&&(!Array.isArray(scope.destinations)||!scope.destinations.includes(site)||scope.requestId!==prepared.request_id||scope.writeAuthorized!==false))fail();
 let master;try{master=JSON.parse(prepared.json)}catch{fail()}
 const cats=master?.CATEGORIAS??master?.categorias,cat=cats?.[site]??cats?.[site.toLowerCase()];
 if(!cat||typeof cat!=='object'||Array.isArray(cat))fail();
 const name=cat.PRINCIPAL??cat.principal,catalog={site,categories:normalizeWriterCategoryPages(responses,perPage)};
 let principal;try{principal=resolveCategory(catalog,{name,...(cat.PRINCIPAL_ID===undefined?{}:{id:cat.PRINCIPAL_ID})});if(principal.name!==name)fail()}catch{fail()}
 return {status:'VERIFIED',site,requestId:prepared.request_id,principal};
}
