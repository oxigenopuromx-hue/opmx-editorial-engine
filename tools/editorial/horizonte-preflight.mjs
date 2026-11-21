import {normalizeHorizonteCatalog} from './horizonte-catalog.mjs';
import {validateSelectedCategories} from './category-validation.mjs';

// The server-owned callback must perform the authenticated CMS request; it
// must never be chosen by the MASTER or source text. No function here grants
// a write or substitutes for Guard's verified destination scope.
export async function validateEditorialDestinations(master,catalog,selected,{fetchHorizonteCatalog}={}){
 if(!Array.isArray(selected)||!selected.includes('HORIZONTE'))return validateSelectedCategories(master,catalog,selected);
 if(typeof fetchHorizonteCatalog!=='function')return {ok:false,errors:['HORIZONTE_CATALOGO_NO_CONFIRMADO']};
 let horizonteCatalog;try{horizonteCatalog=normalizeHorizonteCatalog(await fetchHorizonteCatalog())}catch{return {ok:false,errors:['HORIZONTE_CATALOGO_NO_CONFIRMADO']}}
 return validateSelectedCategories(master,catalog,selected,{horizonteCatalog});
}
