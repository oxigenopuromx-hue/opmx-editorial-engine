import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryPlacementMeta, verifyCategoryPlacementReadback } from './category-placement.mjs';
const assignedCategoryIds = ['12','35'];
test('omitted setting never writes or clears WordPress metadata', () => {
  assert.deepEqual(categoryPlacementMeta({assignedCategoryIds}), {});
  assert.equal(verifyCategoryPlacementReadback({post:{meta:{oxpuro_excluded_category_ids:['12']}}}),true);
});
test('explicit empty list clears only when deliberately requested', () => {
  assert.deepEqual(categoryPlacementMeta({excludedCategoryIds:[],assignedCategoryIds}),{oxpuro_excluded_category_ids:[]});
  assert.equal(verifyCategoryPlacementReadback({excludedCategoryIds:[],post:{meta:{oxpuro_excluded_category_ids:[]}}}),true);
});
test('selected categories require exact assigned IDs; readback order is irrelevant', () => {
  assert.deepEqual(categoryPlacementMeta({excludedCategoryIds:['35','12'],assignedCategoryIds}),{oxpuro_excluded_category_ids:['35','12']});
  assert.equal(verifyCategoryPlacementReadback({excludedCategoryIds:['12','35'],post:{meta:{oxpuro_excluded_category_ids:['35','12']}}}),true);
  assert.equal(verifyCategoryPlacementReadback({excludedCategoryIds:['12'],post:{meta:{oxpuro_excluded_category_ids:['35']}}}),false);
});
test('rejects invalid IDs, duplicates, and unassigned exclusions', () => {
  for (const bad of [['0'],['-1'],[12],['01'],['12','12'],['99'],['12.0'],['12 '],['1e2'],null,'12']) {
    assert.throws(()=>categoryPlacementMeta({excludedCategoryIds:bad,assignedCategoryIds}));
  }
  assert.throws(()=>categoryPlacementMeta({excludedCategoryIds:['12'],assignedCategoryIds:[12]}));
  assert.throws(()=>categoryPlacementMeta({excludedCategoryIds:['12'],assignedCategoryIds:['12','12']}));
});
test('never accepts malformed or missing readback as success for explicit writes', () => {
  assert.equal(verifyCategoryPlacementReadback({excludedCategoryIds:['12'],post:{meta:{}}}),false);
  assert.equal(verifyCategoryPlacementReadback({excludedCategoryIds:['12'],post:{meta:{oxpuro_excluded_category_ids:[12]}}}),false);
  assert.equal(verifyCategoryPlacementReadback({excludedCategoryIds:['12'],post:{meta:{oxpuro_excluded_category_ids:['12','12']}}}),false);
});
