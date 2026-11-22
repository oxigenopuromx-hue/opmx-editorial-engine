import {normalizeWriterCategoryPages} from './writer-category-pages.mjs';
import {resolveCategory} from './live-category-catalog.mjs';

// The graph passes the original output from Preparar MASTER y binarios, scope
// from Acreditar alcance escritor, and HTTP items from a fixed OPOL CMS node.
// This function must never receive catalog data from the MASTER or caller.
export function buildOpolCategoryProof({prepared,scopeApproved,scope,responses,perPage=100}={}) {
 const fail=()=>{throw Error('OPOL_CATEGORY_PROOF_UNCONFIRMED')};
 if(scopeApproved!==true||!prepared||typeof prepared.json!=='string'||typeof prepared.request_id!=='string'||!prepared.request_id||prepared.request_id.length>256)fail();
 const value=prepared.CREAR_EN;if(typeof value!=='string'||!value.trim())fail();
 const tokens=value.toUpperCase().split(',').map(x=>x.trim()),allowed=['OPURO','OPOL','LIBERAL','HORIZONTE','AMBOS','ACTIVOS','TODOS'];
 if(tokens.some(x=>!allowed.includes(x))||!tokens.some(x=>['OPOL','AMBOS','ACTIVOS','TODOS'].includes(x)))fail();
 if(/^tg_[a-f0-9]{64}$/.test(prepared.request_id)&&!scope)fail();
 if(scope!==null&&scope!==undefined&&(!Array.isArray(scope.destinations)||!scope.destinations.includes('OPOL')||scope.requestId!==prepared.request_id||scope.writeAuthorized!==false))fail();
 let master;try{master=JSON.parse(prepared.json)}catch{fail()}
 const cat=master?.CATEGORIAS?.OPOL??master?.CATEGORIAS?.opol??master?.categorias?.OPOL??master?.categorias?.opol;
 if(!cat||typeof cat!=='object'||Array.isArray(cat))fail();
 const name=cat.PRINCIPAL??cat.principal,secondaryName=cat.SECUNDARIA??cat.secundaria??null;
 const catalog={site:'OPOL',categories:normalizeWriterCategoryPages(responses,perPage)};
 let principal,secondary=null;
 try{
  principal=resolveCategory(catalog,{name,...(cat.PRINCIPAL_ID===undefined?{}:{id:cat.PRINCIPAL_ID})});
  if(principal.name!==name)fail();
  if(secondaryName!==null){secondary=resolveCategory(catalog,{name:secondaryName,...(cat.SECUNDARIA_ID===undefined?{}:{id:cat.SECUNDARIA_ID})});if(secondary.name!==secondaryName||secondary.parent!==principal.id)fail()}
  else if(cat.SECUNDARIA_ID!==undefined)fail();
 }catch{fail()}
 return {status:'VERIFIED',site:'OPOL',requestId:prepared.request_id,principal,secondary};
}
