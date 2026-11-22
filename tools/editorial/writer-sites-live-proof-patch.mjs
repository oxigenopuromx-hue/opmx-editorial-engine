// Candidate only: the named nodes must come from fixed authenticated CMS
// nodes and scope. A MASTER field must never be treated as proof.
export function patchWriterSitesLiveProof(source) {
 if(typeof source!=='string')throw Error('SITE_LIVE_PATCH_INVALID');
 const replace2=(s,a,b)=>{if(s.split(a).length!==3)throw Error('SITE_LIVE_PATCH_SOURCE_CHANGED');return s.split(a).join(b)};
 const anchor='const liberalCategory=str(CATS.LIBERAL?.PRINCIPAL??CATS.LIBERAL?.principal??CATS.liberal?.PRINCIPAL??CATS.liberal?.principal);';
 const helper=`${anchor}
function verifiedSiteCategory(site,name,id){
 let p;try{p=$(\`Categoría \${site} — Verificar catálogo\`).first().json.categoryProof}catch{throw Error('SITE_CATEGORY_PROOF_MISSING')}
 if(!p||p.status!=='VERIFIED'||p.site!==site||p.requestId!==envelope.request_id||p.principal?.name!==name||!Number.isSafeInteger(p.principal?.id)||p.principal.id<1||id!==undefined&&p.principal.id!==id)throw Error('SITE_CATEGORY_PROOF_UNCONFIRMED');return p;
}
const opuroLiveProof=execution.create_opuro?verifiedSiteCategory('OPURO',category,opuroPrincipalId):null;
const liberalLiveProof=execution.create_liberal?verifiedSiteCategory('LIBERAL',liberalCategory,liberalPrincipalId):null;`;
 const oldOpuro='...(opuroPrincipalId===undefined?{}:{principal_id:opuroPrincipalId})';
 const nextOpuro='...(execution.create_opuro?{principal_id:opuroLiveProof.principal.id}:opuroPrincipalId===undefined?{}:{principal_id:opuroPrincipalId})';
 const oldLiberal='...(liberalPrincipalId===undefined?{}:{principal_id:liberalPrincipalId})';
 const nextLiberal='...(execution.create_liberal?{principal_id:liberalLiveProof.principal.id}:liberalPrincipalId===undefined?{}:{principal_id:liberalPrincipalId})';
 return replace2(replace2(replace2(source,anchor,helper),oldOpuro,nextOpuro),oldLiberal,nextLiberal);
}
