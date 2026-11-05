import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryPlacementMeta, verifyCategoryPlacementReadback } from './category-placement.mjs';
const eligibleCategoryIds = ['12','35'];
test('omitted setting never writes or clears WordPress metadata', () => {
  assert.deepEqual(categoryPlacementMeta({eligibleCategoryIds}), {});
  assert.equal(verifyCategoryPlacementReadback({post:{meta:{oxpuro_excluded_category_ids:['12']}}}),true);
});
test('explicit empty list clears only when deliberately requested', () => {
  assert.deepEqual(categoryPlacementMeta({excludedCategoryIds:[],eligibleCategoryIds}),{oxpuro_excluded_category_ids:[]});
  assert.equal(verifyCategoryPlacementReadback({excludedCategoryIds:[],post:{meta:{oxpuro_excluded_category_ids:[]}}}),true);
});
test('selected categories require exact assigned IDs; readback order is irrelevant', () => {
  assert.deepEqual(categoryPlacementMeta({excludedCategoryIds:['35','12'],eligibleCategoryIds}),{oxpuro_excluded_category_ids:['35','12']});
  assert.equal(verifyCategoryPlacementReadback({excludedCategoryIds:['12','35'],post:{meta:{oxpuro_excluded_category_ids:['35','12']}}}),true);
  assert.equal(verifyCategoryPlacementReadback({excludedCategoryIds:['12'],post:{meta:{oxpuro_excluded_category_ids:['35']}}}),false);
});
test('rejects invalid IDs, duplicates, and unassigned exclusions', () => {
  for (const bad of [['0'],['-1'],[12],['01'],['12','12'],['99'],['12.0'],['12 '],['1e2'],null,'12']) {
    assert.throws(()=>categoryPlacementMeta({excludedCategoryIds:bad,eligibleCategoryIds}));
  }
  assert.throws(()=>categoryPlacementMeta({excludedCategoryIds:['12'],eligibleCategoryIds:[12]}));
  assert.throws(()=>categoryPlacementMeta({excludedCategoryIds:['12'],eligibleCategoryIds:['12','12']}));
});
test('never accepts malformed or missing readback as success for explicit writes', () => {
  assert.equal(verifyCategoryPlacementReadback({excludedCategoryIds:['12'],post:{meta:{}}}),false);
  assert.equal(verifyCategoryPlacementReadback({excludedCategoryIds:['12'],post:{meta:{oxpuro_excluded_category_ids:[12]}}}),false);
  assert.equal(verifyCategoryPlacementReadback({excludedCategoryIds:['12'],post:{meta:{oxpuro_excluded_category_ids:['12','12']}}}),false);
});

test('category inherited from child may be excluded from ancestor homepage', () => {
  // WordPress category_story_eligible supports direct category and ancestor terms.
  // Caller must derive eligible IDs from the CMS; this adapter does not invent ancestry.
  assert.deepEqual(categoryPlacementMeta({excludedCategoryIds:['10'],eligibleCategoryIds:['10','35']}),{oxpuro_excluded_category_ids:['10']});
  assert.throws(()=>categoryPlacementMeta({excludedCategoryIds:['99'],eligibleCategoryIds:['10','35']}));
});
