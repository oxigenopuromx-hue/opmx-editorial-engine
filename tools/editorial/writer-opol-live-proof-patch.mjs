// Candidate only: the referenced proof MUST come exclusively from the writer's
// authenticated, fixed OPOL catalog node before this normalizer runs. Never
// enable this replacement with a caller-controlled proof or without the graph.
export function patchWriterOpolLiveProof(source) {
 if(typeof source!=='string')throw Error('OPOL_LIVE_PATCH_INVALID');
 const start='if (execution.create_opol && !CATEGORY_CATALOG.OPOL_ALLOWED.includes(categoryOpol)) {';
 const end='const seoCategory = str(SEO.CATEGORIA ?? SEO.category);';
 if(source.split(start).length!==3||source.split(end).length!==3||source.split('const opolPrincipalId=optionalCategoryId(').length!==3)throw Error('OPOL_LIVE_PATCH_SOURCE_CHANGED');
 const proof=`let opolLiveProof=null;
if(execution.create_opol){
 try{opolLiveProof=$('Categoría OPOL — Verificar catálogo').first().json.categoryProof}catch{throw Error('OPOL_CATEGORY_PROOF_MISSING')}
 const p=opolLiveProof,valid=x=>Number.isSafeInteger(x)&&x>0;
 if(!p||p.status!=='VERIFIED'||p.site!=='OPOL'||p.requestId!==envelope.request_id||p.principal?.name!==categoryOpol||!valid(p.principal?.id)||opolPrincipalId!==undefined&&p.principal.id!==opolPrincipalId)throw Error('OPOL_CATEGORY_PROOF_UNCONFIRMED');
 if(categoryOpolSecondary===null){if(p.secondary!==null||opolSecondaryId!==undefined)throw Error('OPOL_CATEGORY_PROOF_UNCONFIRMED')}
 else if(p.secondary?.name!==categoryOpolSecondary||!valid(p.secondary?.id)||p.secondary.parent!==p.principal.id||opolSecondaryId!==undefined&&p.secondary.id!==opolSecondaryId)throw Error('OPOL_CATEGORY_PROOF_UNCONFIRMED');
}

`;
 let output=source;
 for(let i=0;i<2;i++){const a=output.indexOf(start),b=output.indexOf(end,a);if(a<0||b<a)throw Error('OPOL_LIVE_PATCH_SOURCE_CHANGED');output=output.slice(0,a)+proof+output.slice(b)}
 const old='...(opolPrincipalId===undefined?{}:{principal_id:opolPrincipalId}),...(opolSecondaryId===undefined?{}:{secundaria_id:opolSecondaryId})';
 const next='...(execution.create_opol?{principal_id:opolLiveProof.principal.id}:opolPrincipalId===undefined?{}:{principal_id:opolPrincipalId}),...(execution.create_opol&&opolLiveProof.secondary?{secundaria_id:opolLiveProof.secondary.id}:opolSecondaryId===undefined?{}:{secundaria_id:opolSecondaryId})';
 if(output.split(old).length!==3)throw Error('OPOL_LIVE_PATCH_SOURCE_CHANGED');
 return output.split(old).join(next);
}
