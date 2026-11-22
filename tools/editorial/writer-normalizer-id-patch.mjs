// Candidate for both policy branches of the active writer normalizer. This is
// identity propagation only; it does not remove any existing preflight gate.
export function patchWriterNormalizerIds(source) {
 if(typeof source!=='string')throw Error('CATEGORY_NORMALIZER_INVALID');
 const replaceExactly=(text,needle,replacement)=>{
  if(text.split(needle).length!==3)throw Error('CATEGORY_NORMALIZER_SOURCE_CHANGED');
  return text.split(needle).join(replacement);
 };
 const cats='const CATS=d.CATEGORIAS??d.categorias??{};';
 const helper=`${cats}
function optionalCategoryId(cat,key){
 const v=cat?.[key];if(v===undefined)return undefined;
 if(!Number.isSafeInteger(v)||v<1)throw Error('CATEGORY_ID_INVALID');return v;
}
const opuroPrincipalId=optionalCategoryId(CATS.OPURO??CATS.opuro,'PRINCIPAL_ID');
const opolPrincipalId=optionalCategoryId(CATS.OPOL??CATS.opol,'PRINCIPAL_ID');
const opolSecondaryId=optionalCategoryId(CATS.OPOL??CATS.opol,'SECUNDARIA_ID');
const liberalPrincipalId=optionalCategoryId(CATS.LIBERAL??CATS.liberal,'PRINCIPAL_ID');`;
 const old='categories:{opuro:{principal:category},opol:{principal:categoryOpol,secundaria:categoryOpolSecondary}},';
 const next='categories:{opuro:{principal:category,...(opuroPrincipalId===undefined?{}:{principal_id:opuroPrincipalId})},opol:{principal:categoryOpol,secundaria:categoryOpolSecondary,...(opolPrincipalId===undefined?{}:{principal_id:opolPrincipalId}),...(opolSecondaryId===undefined?{}:{secundaria_id:opolSecondaryId})}},';
 const lib='normalized.json.canonical.categories.liberal={principal:liberalCategory};';
 const libNext='normalized.json.canonical.categories.liberal={principal:liberalCategory,...(liberalPrincipalId===undefined?{}:{principal_id:liberalPrincipalId})};';
 return replaceExactly(replaceExactly(replaceExactly(source,cats,helper),old,next),lib,libNext);
}
