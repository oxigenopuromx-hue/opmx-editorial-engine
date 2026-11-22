// Fetch and verify a complete, fresh WordPress category catalog using an
// injected authenticated transport. This module never accepts a CMS URL from
// an article, and does not perform writes.
const SITES = new Set(['OPURO', 'OPOL', 'LIBERAL']);
const nameKey = s => s.normalize('NFC').trim().toLocaleLowerCase('es-MX');

export async function readCategoryCatalog(site, fetchPage) {
  if (!SITES.has(site) || typeof fetchPage !== 'function') throw Error('CATEGORY_CATALOG_UNAVAILABLE');
  const categories = [], ids = new Set(), slugs = new Set();
  let pages;
  for (let page = 1; page <= (pages ?? 1); page++) {
    let response;
    try { response = await fetchPage({site, page, perPage: 100}); }
    catch { throw Error('CATEGORY_CATALOG_UNAVAILABLE'); }
    const total = Number(response?.totalPages);
    if (response?.status !== 200 || !Number.isSafeInteger(total) || total < 1 || total > 100 ||
        (pages !== undefined && pages !== total) || !Array.isArray(response.body) ||
        response.body.length > 100 || (page < total && response.body.length !== 100))
      throw Error('CATEGORY_CATALOG_INCOMPLETE');
    pages = total;
    for (const row of response.body) {
      if (!Number.isSafeInteger(row?.id) || row.id < 1 || !Number.isSafeInteger(row.parent) || row.parent < 0 ||
          typeof row.name !== 'string' || !row.name.trim() || typeof row.slug !== 'string' || !row.slug ||
          ids.has(row.id) || slugs.has(row.slug)) throw Error('CATEGORY_CATALOG_INVALID');
      ids.add(row.id); slugs.add(row.slug);
      categories.push({id: row.id, name: row.name, slug: row.slug, parent: row.parent});
    }
  }
  if (!categories.length || categories.some(row => row.parent !== 0 && !ids.has(row.parent)))
    throw Error('CATEGORY_CATALOG_INCOMPLETE');
  return {site, categories};
}

// A selected ID is bound to the catalog and expected name/slug. Where legacy
// callers only provide a name, refuse ambiguous matches instead of choosing
// the first item returned by WordPress.
export function resolveCategory(catalog, selection) {
  if (!SITES.has(catalog?.site) || !Array.isArray(catalog.categories) ||
      typeof selection?.name !== 'string' || !selection.name.trim()) throw Error('CATEGORY_SELECTION_INVALID');
  const matches = catalog.categories.filter(row => nameKey(row.name) === nameKey(selection.name));
  const chosen = selection.id === undefined ? (matches.length === 1 ? matches[0] : null) :
    matches.find(row => row.id === selection.id);
  if (!chosen || (selection.slug !== undefined && selection.slug !== chosen.slug))
    throw Error(matches.length > 1 && selection.id === undefined ? 'CATEGORY_SELECTION_AMBIGUOUS' : 'CATEGORY_SELECTION_UNCONFIRMED');
  return chosen;
}
