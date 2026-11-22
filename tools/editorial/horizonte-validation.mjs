// Validación editorial sin escrituras. El catálogo debe provenir de una
// lectura autenticada del CMS; ni el MASTER ni una fuente lo acreditan.
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const regions=['bcs','mexico','mundo'];
const topics=['politica','economia','sociedad-y-derechos','horizonte-verde','cultura-e-identidad'];
const municipalities=['la-paz','los-cabos','comondu','loreto','mulege'];
function confirmed(catalog,taxonomy,slug){
 const rows=catalog?.[taxonomy];
 if(!Array.isArray(rows)||typeof slug!=='string'||!slug)return false;
 const matches=rows.filter(x=>object(x)&&x.slug===slug);
 return matches.length===1&&Number.isSafeInteger(matches[0].id)&&matches[0].id>0;
}
export function validateHorizonteClassification(master,catalog){
 const errors=[],h=master?.CATEGORIAS?.HORIZONTE;
 const acceptedTopics=Array.isArray(catalog?.editorialSlugs)?catalog.editorialSlugs:topics;
 if(!object(h))return {ok:false,errors:['HORIZONTE_CLASIFICACION_REQUERIDA']};
 if(!acceptedTopics.includes(h.PRINCIPAL)||!confirmed(catalog,'category',h.PRINCIPAL))errors.push('HORIZONTE_CATEGORIA_NO_CONFIRMADA');
 if(!regions.includes(h.REGION)||!confirmed(catalog,'ehc_region',h.REGION))errors.push('HORIZONTE_REGION_NO_CONFIRMADA');
 if(!acceptedTopics.includes(h.TEMA)||!confirmed(catalog,'ehc_topic',h.TEMA))errors.push('HORIZONTE_TEMA_NO_CONFIRMADO');
 if(h.PRINCIPAL!==h.TEMA)errors.push('HORIZONTE_CATEGORIA_TEMA_DIFERENTES');
 if(!['news','analysis','opinion'].includes(h.TIPO))errors.push('HORIZONTE_TIPO_INVALIDO');
 if(h.MUNICIPIO!==undefined&&h.MUNICIPIO!==null&&(!municipalities.includes(h.MUNICIPIO)||h.REGION!=='bcs'||!confirmed(catalog,'ehc_municipality',h.MUNICIPIO)))errors.push('HORIZONTE_MUNICIPIO_NO_CONFIRMADO');
 return {ok:errors.length===0,errors};
}
