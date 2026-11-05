import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Tests the inactive, sanitized n8n reference; no service is contacted.
const workflow = JSON.parse(readFileSync('workflows/publisher/OPMX_PUBLISHER_MCP_REFERENCIA_SANITIZADA_NO_ACTIVAR.json', 'utf8'));
const node = name => workflow.nodes.find(n => n.name === name);
const context = {
  'Validar y normalizar OPMX MASTER': {canonical: {title:'Título',subtitle:'Subtítulo',slug:'prueba',excerpt:'Texto',meta_description:'Descripción SEO',keywords_all:'clave, secundaria',gutenberg_enriquecido_final:'<!-- wp:paragraph --><p>Prueba</p><!-- /wp:paragraph -->',author:{id:3},images:{hero_opuro:{credit:'Cortesía'}}}},
  'OPURO — Subir HERO': {id:101},
  'OPURO — Subir DESTACADA': {id:102},
  'OPURO — Resolver categoría': {category_id:7},
  'OPURO — Consolidar etiquetas v1.13': {tag_ids:[8]}
};
const lookup = name => ({first: () => ({json:context[name]})});
const bodyExpression = node('OPURO — Crear borrador Gutenberg enriquecido').parameters.jsonBody;
const body = Function('$', `return (${bodyExpression.slice(3,-2)});`)(lookup);
const validate = Function('$json', '$', node('OPURO — Validar antes de publicar').parameters.jsCode);
const post = {id:999,status:'draft',slug:'prueba',author:3,title:{raw:'Título'},featured_media:102,categories:[7],tags:[8],meta:{oxpuro_hero_media_id:101,oxpuro_editorial:{subtitle:'Subtítulo',photo_credit:'Cortesía'},rank_math_title:'Título',rank_math_description:'Descripción SEO',rank_math_focus_keyword:'clave, secundaria'},content:{raw:'<!-- wp:paragraph --><p>Prueba</p><!-- /wp:paragraph -->'}};

test('el borrador solicita Hero y destacada con IDs separados', () => {
  assert.equal(body.meta.oxpuro_hero_media_id, 101);
  assert.equal(body.featured_media, 102);
  assert.deepEqual(body.meta.oxpuro_editorial,{subtitle:'Subtítulo',photo_credit:'Cortesía'});
  assert.equal(body.status, 'draft');
});
test('readback válido confirma Hero', () => assert.equal(validate(post,lookup).json.validated,true));
test('readback rechaza Hero ausente, cero o diferente', () => {
  for (const id of [undefined,0,102])
    assert.throws(() => validate({...post,meta:{...post.meta,oxpuro_hero_media_id:id}},lookup), /HERO/);
});
test('readback rechaza cambios en slug, autor, título, etiquetas, Gutenberg o SEO', () => {
  for (const changes of [{slug:'otro'},{author:4},{title:{raw:'otro'}},{tags:[]},{content:{raw:'otro'}},{meta:{...post.meta,rank_math_description:'otra'}},{meta:{...post.meta,oxpuro_editorial:{subtitle:'',photo_credit:'Cortesía'}}},{meta:{...post.meta,oxpuro_editorial:{subtitle:'Subtítulo',photo_credit:''}}}])
    assert.throws(() => validate({...post,...changes},lookup));
});
test('el workflow mantiene referencia inactiva y sin credenciales', () => {
  assert.equal(workflow.active,false);
  assert.ok(workflow.nodes.every(n => !n.credentials));
});

