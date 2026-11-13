// Optional presentation policy. These helpers validate an already authorised
// payload; a field in source text or MASTER never grants a publication permit.
export function categoryExclusionIds(value) {
 if(!Array.isArray(value)||value.length>100||value.some(id=>typeof id!=='string'||!/^[1-9][0-9]{0,15}$/.test(id)||!Number.isSafeInteger(Number(id)))||new Set(value).size!==value.length)throw Error('OPURO_CATEGORY_HOME_INVALID');
 return [...value];
}

export function readOpuroCategoryHome(master,selected) {
 const publication=master?.PUBLICACION;
 if(!publication||typeof publication!=='object'||Array.isArray(publication)||!Object.hasOwn(publication,'OPURO'))return {declared:false};
 const site=publication.OPURO;
 if(!site||typeof site!=='object'||Array.isArray(site)||Object.keys(site).some(k=>k!=='EXCLUIR_PORTADA_CATEGORIAS_IDS'))throw Error('OPURO_CATEGORY_HOME_INVALID');
 if(!Object.hasOwn(site,'EXCLUIR_PORTADA_CATEGORIAS_IDS'))return {declared:false};
 if(selected!==true)throw Error('OPURO_CATEGORY_HOME_DESTINATION');
 return {declared:true,ids:categoryExclusionIds(site.EXCLUIR_PORTADA_CATEGORIAS_IDS)};
}

export function assertOpuroCategoryMembership(policy,assignedIds) {
 if(policy?.declared!==true)return;
 const ids=categoryExclusionIds(policy.ids);
 if(!Array.isArray(assignedIds)||!assignedIds.length||assignedIds.some(id=>!Number.isSafeInteger(id)||id<1)||new Set(assignedIds).size!==assignedIds.length||ids.some(id=>!assignedIds.includes(Number(id))))throw Error('OPURO_CATEGORY_HOME_MEMBERSHIP');
}

export function opuroCategoryHomeMeta(policy) {
 if(policy?.declared!==true)return {};
 return {oxpuro_excluded_category_ids:categoryExclusionIds(policy.ids)};
}

export function assertOpuroCategoryReadback(policy,post) {
 if(policy?.declared!==true)return;
 assertOpuroCategoryMembership(policy,post?.categories);
 const expected=categoryExclusionIds(policy.ids).sort((a,b)=>Number(a)-Number(b));
 const actual=categoryExclusionIds(post?.meta?.oxpuro_excluded_category_ids).sort((a,b)=>Number(a)-Number(b));
 if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('OPURO_CATEGORY_HOME_READBACK');
}

export function checkOpuroCategoryUpdate(destination,payload,before) {
 const declared=Object.hasOwn(payload?.meta??{},'oxpuro_excluded_category_ids');
 if(!declared){
  // Keeping metadata does not permit an UPDATE to leave that metadata referring
  // to categories the same UPDATE removes. Reject; never silently clear it.
  if(destination==='OPURO'&&Object.hasOwn(payload??{},'categories')&&Object.hasOwn(before?.meta??{},'oxpuro_excluded_category_ids'))assertOpuroCategoryMembership({declared:true,ids:categoryExclusionIds(before.meta.oxpuro_excluded_category_ids)},payload.categories);
  return;
 }
 if(destination!=='OPURO')throw Error('OPURO_CATEGORY_HOME_DESTINATION');
 const policy={declared:true,ids:categoryExclusionIds(payload.meta.oxpuro_excluded_category_ids)};
 assertOpuroCategoryMembership(policy,Object.hasOwn(payload,'categories')?payload.categories:before?.categories);
}

export function assertPreservedOpuroCategoryMeta(destination,payload,before,after) {
 if(destination!=='OPURO')return;
 const meta=payload?.meta??{};
 for(const key of ['oxpuro_excluded_category_ids','oxpuro_exclude_home']) {
  if(Object.hasOwn(meta,key))continue;
  const beforeHas=Object.hasOwn(before?.meta??{},key),afterHas=Object.hasOwn(after?.meta??{},key);
  if(beforeHas!==afterHas||beforeHas&&JSON.stringify(before.meta[key])!==JSON.stringify(after.meta[key]))throw Error('OPURO_CATEGORY_HOME_PRESERVATION');
 }
}

export function opuroCategoryHomeSource() {
 return [categoryExclusionIds,readOpuroCategoryHome,assertOpuroCategoryMembership,opuroCategoryHomeMeta,assertOpuroCategoryReadback,checkOpuroCategoryUpdate,assertPreservedOpuroCategoryMeta].map(fn=>fn.toString()).join('\n');
}
