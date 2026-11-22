import {readCategoryCatalog, resolveCategory} from './live-category-catalog.mjs';
import {validateEditorialDestinations} from './horizonte-preflight.mjs';
import {normalizeHorizonteCatalog} from './horizonte-catalog.mjs';
import {normalizeHorizonteEditorialClassification} from './horizonte-authoritative-catalog.mjs';

// Trusted callers supply per-site CMS transport; neither a source document nor
// a MASTER supplies a URL or credentials. Failure never falls back to a stale
// snapshot. No reads are made for destinations outside the approved scope.
export async function validateLiveEditorialDestinations(master, selected, transport = {}) {
  const sites = ['OPURO', 'OPOL', 'LIBERAL', 'HORIZONTE'];
  if (!Array.isArray(selected) || !selected.length ||
      selected.some(site => !sites.includes(site)) || new Set(selected).size !== selected.length)
    return {ok:false, errors:['DESTINOS_INVALIDOS']};
  const catalog = {sites:{}};
  for (const site of selected.filter(site => site !== 'HORIZONTE')) {
    let live;
    try { live = await readCategoryCatalog(site, transport.fetchPage); }
    catch { return {ok:false, errors:[`CATALOGO_${site}_NO_CONFIRMADO`]}; }
    const principal = master?.CATEGORIAS?.[site]?.PRINCIPAL;
    try {
      // Ensure the chosen name resolves uniquely under the writer's own name
      // normalization; a historical name alone cannot disambiguate two IDs.
      const chosen = resolveCategory(live, {name:principal,...(master?.CATEGORIAS?.[site]?.PRINCIPAL_ID!==undefined?{id:master.CATEGORIAS[site].PRINCIPAL_ID}:{})});
      if (chosen.name !== principal) throw Error('CATEGORY_NAME_NOT_LITERAL');
      if (site === 'OPOL' && master?.CATEGORIAS?.OPOL?.SECUNDARIA != null) {
        const secondary = resolveCategory(live, {name:master.CATEGORIAS.OPOL.SECUNDARIA,...(master.CATEGORIAS.OPOL.SECUNDARIA_ID!==undefined?{id:master.CATEGORIAS.OPOL.SECUNDARIA_ID}:{})});
        if (secondary.name !== master.CATEGORIAS.OPOL.SECUNDARIA || secondary.parent !== chosen.id)
          throw Error('CATEGORY_PARENT_UNCONFIRMED');
      }
    } catch { return {ok:false, errors:[`CATEGORIA_${site}_NO_CONFIRMADA`]}; }
    const byId = new Map(live.categories.map(c => [c.id,c]));
    catalog.sites[site] = {
      allowed_names:live.categories.map(c=>c.name),
      categories:live.categories.map(c=>({name:c.name,parent_id:c.parent,parent_name:byId.get(c.parent)?.name ?? null}))
    };
  }
  if(selected.includes('HORIZONTE')){
    try {
      if(typeof transport.fetchHorizonteCatalog!=='function'||typeof transport.fetchHorizonteEditorialClassification!=='function')throw Error('CATALOG_UNAVAILABLE');
      const raw=await transport.fetchHorizonteCatalog();
      const normalized=normalizeHorizonteCatalog(raw);
      normalized.editorialSlugs=normalizeHorizonteEditorialClassification(await transport.fetchHorizonteEditorialClassification(),normalized);
      const {validateSelectedCategories}=await import('./category-validation.mjs');
      return validateSelectedCategories(master,catalog,selected,{horizonteCatalog:normalized});
    }catch{return {ok:false,errors:['HORIZONTE_CATALOGO_NO_CONFIRMADO']};}
  }
  return validateEditorialDestinations(master,catalog,selected);
}
