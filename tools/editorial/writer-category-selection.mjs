import {readCategoryCatalog,resolveCategory} from './live-category-catalog.mjs';

// The writer independently fetches each CMS after scope has been authorized.
// The MASTER supplies editorial names/IDs, never the catalog or a CMS URL.
// An omitted ID remains compatible only where the CMS name is unambiguous.
export async function selectWriterCategory(site, selection, fetchPage) {
 if(!['OPURO','OPOL','LIBERAL'].includes(site)||!selection||typeof selection!=='object'||Array.isArray(selection))throw Error('CATEGORY_SELECTION_INVALID');
 const keys=Object.keys(selection),allowed=['name','id','slug','secondaryName','secondaryId'];
 if(keys.some(k=>!allowed.includes(k)))throw Error('CATEGORY_SELECTION_INVALID');
 const catalog=await readCategoryCatalog(site,fetchPage);
 const principal=resolveCategory(catalog,{name:selection.name,...(selection.id===undefined?{}:{id:selection.id}),...(selection.slug===undefined?{}:{slug:selection.slug})});
 if(principal.name!==selection.name)throw Error('CATEGORY_NAME_UNCONFIRMED');
 let secondary=null;
 if(selection.secondaryName!==undefined&&selection.secondaryName!==null){
  if(site!=='OPOL')throw Error('CATEGORY_SECONDARY_NOT_ALLOWED');
  secondary=resolveCategory(catalog,{name:selection.secondaryName,...(selection.secondaryId===undefined?{}:{id:selection.secondaryId})});
  if(secondary.name!==selection.secondaryName||secondary.parent!==principal.id)throw Error('CATEGORY_HIERARCHY_UNCONFIRMED');
 } else if(selection.secondaryId!==undefined) throw Error('CATEGORY_SECONDARY_NOT_ALLOWED');
 return {site,principal:{id:principal.id,name:principal.name,slug:principal.slug,parent:principal.parent},secondary:secondary?{id:secondary.id,name:secondary.name,slug:secondary.slug,parent:secondary.parent}:null};
}
