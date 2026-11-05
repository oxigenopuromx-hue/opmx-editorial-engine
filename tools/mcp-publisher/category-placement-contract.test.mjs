import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { categoryPlacementMeta, verifyCategoryPlacementReadback } from './category-placement.mjs';

const previous = JSON.parse(readFileSync('masters/04_CONTRATO_SALIDA_OPMX_v1.4.1_MEDIA_GUTENBERG_EDITORIAL.json','utf8'));
const candidate = JSON.parse(readFileSync('masters/04_CONTRATO_SALIDA_OPMX_v1.4.2_CANDIDATO_COLOCACION_CATEGORIAS.json','utf8'));
const opuro = candidate.properties.CATEGORIAS.properties.OPURO;

test('candidate keeps previous required shape and Gutenberg rules unchanged', () => {
  assert.deepEqual(candidate.required, previous.required);
  assert.deepEqual(candidate.top_level_fields, previous.top_level_fields);
  assert.deepEqual(candidate.properties.CATEGORIAS.required, previous.properties.CATEGORIAS.required);
  assert.deepEqual(opuro.required, previous.properties.CATEGORIAS.properties.OPURO.required);
  assert.deepEqual(candidate.contract_rules.enriched_gutenberg_allowed_blocks, previous.contract_rules.enriched_gutenberg_allowed_blocks);
  assert.equal(previous.properties.CATEGORIAS.properties.OPURO.properties.EXCLUIR_DE_PORTADA_IDS, undefined);
});
test('new placement field is optional, array of exact decimal strings', () => {
  const field = opuro.properties.EXCLUIR_DE_PORTADA_IDS;
  assert.equal(opuro.required.includes('EXCLUIR_DE_PORTADA_IDS'), false);
  assert.equal(field.type,'array');
  assert.equal(field.items.type,'string');
  assert.equal(field.uniqueItems,true);
  assert.equal(candidate.contract_rules.category_placement_candidate.production_enabled,false);
  assert.deepEqual(categoryPlacementMeta({excludedCategoryIds:undefined,assignedCategoryIds:['12']}),{});
  assert.deepEqual(categoryPlacementMeta({excludedCategoryIds:['12'],assignedCategoryIds:['12']}),{oxpuro_excluded_category_ids:['12']});
  assert.equal(verifyCategoryPlacementReadback({excludedCategoryIds:['12'],post:{meta:{oxpuro_excluded_category_ids:['12']}}}),true);
});
