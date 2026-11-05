// Pure preflight: exact catalog membership per requested destination; no network or writes.
export function validateSelectedCategories(master, catalog, selected) {
 const errors=[];
 if (!Array.isArray(selected)||!selected.length||selected.some(s=>!['OPURO','OPOL','LIBERAL'].includes(s))) return {ok:false,errors:['DESTINOS_INVALIDOS']};
 for (const site of new Set(selected)) {
  const allowed=catalog?.sites?.[site]?.allowed_names;
  const value=master?.CATEGORIAS?.[site]?.PRINCIPAL;
  if(!Array.isArray(allowed)) {errors.push(`CATALOGO_${site}_NO_DISPONIBLE`);continue;}
  if(typeof value!=='string'||!value||!allowed.includes(value)) errors.push(`CATEGORIA_${site}_NO_AUTORIZADA`);
 }
 if(selected.includes('OPOL')){
  const principal=master?.CATEGORIAS?.OPOL?.PRINCIPAL, secondary=master?.CATEGORIAS?.OPOL?.SECUNDARIA;
  if(secondary!==null && secondary!==undefined){
   const matches=catalog?.sites?.OPOL?.categories?.filter(c=>c.name===secondary&&c.parent_id!==0&&c.parent_name===principal)??[];
   if(!matches.length)errors.push('CATEGORIA_OPOL_JERARQUIA_INVALIDA');
  }
 }
 if(selected.includes('OPURO')&&master?.SEO?.CATEGORIA!==master?.CATEGORIAS?.OPURO?.PRINCIPAL) errors.push('SEO_CATEGORIA_INCONSISTENTE');
 return {ok:errors.length===0,errors};
}
