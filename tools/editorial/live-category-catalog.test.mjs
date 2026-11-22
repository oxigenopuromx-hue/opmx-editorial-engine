import test from 'node:test';
import assert from 'node:assert/strict';
import {readCategoryCatalog, resolveCategory} from './live-category-catalog.mjs';

const row = (id, name = `Cat ${id}`, parent = 0) => ({id, name, slug: `cat-${id}`, parent});
test('reads every page and keeps hierarchy scoped to the chosen destination', async () => {
  const calls = [];
  const catalog = await readCategoryCatalog('OPURO', async request => {
    calls.push(request);
    return {status: 200, totalPages: 2, body: request.page === 1 ? Array.from({length:100}, (_, i) => row(i + 1)) : [row(101, 'Hijo', 1)]};
  });
  assert.equal(calls.length, 2); assert.equal(catalog.categories.length, 101);
  assert.deepEqual(resolveCategory(catalog, {name: 'Hijo', id: 101, slug: 'cat-101'}), row(101, 'Hijo', 1));
});
test('rejects ambiguous names and requires a matching ID when duplicated', async () => {
  const catalog = await readCategoryCatalog('OPURO', async () => ({status:200,totalPages:1,body:[row(1,'BCS'),row(2,'BCS')]}));
  assert.throws(() => resolveCategory(catalog,{name:'BCS'}), /AMBIGUOUS/);
  assert.equal(resolveCategory(catalog,{name:'BCS',id:2}).id,2);
  assert.throws(() => resolveCategory(catalog,{name:'BCS',id:3}), /UNCONFIRMED/);
});
test('rejects incomplete, unavailable, inconsistent and duplicate catalogs', async () => {
  for (const fetchPage of [async()=>{throw Error('timeout')}, async()=>({status:401,totalPages:1,body:[]}),
    async()=>({status:200,totalPages:2,body:[row(1)]}),
    async()=>({status:200,totalPages:1,body:[row(1),row(1)]}),
    async()=>({status:200,totalPages:1,body:[row(1,'child',99)]})])
    await assert.rejects(readCategoryCatalog('OPOL',fetchPage),/CATEGORY_CATALOG_/);
});
