import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSelectedCategories as validate} from './category-validation.mjs';
const term=(slug,id)=>({slug,id});
const catalog={category:[term('sin-categoria',1),term('politica',28),term('economia',29)],ehc_region:[term('bcs',2),term('mexico',3),term('mundo',4)],ehc_topic:[term('politica',10),term('economia',11)],ehc_municipality:[term('la-paz',5)]};
const oldCatalog={sites:{OPURO:{allowed_names:['Política']},OPOL:{allowed_names:['POLÍTICA']},LIBERAL:{allowed_names:['Política']}}};
const master={SEO:{CATEGORIA:'Política'},CATEGORIAS:{OPURO:{PRINCIPAL:'Política'},OPOL:{PRINCIPAL:'POLÍTICA'},LIBERAL:{PRINCIPAL:'Política'},HORIZONTE:{PRINCIPAL:'politica',REGION:'bcs',TEMA:'politica',TIPO:'news',MUNICIPIO:'la-paz'}}};
test('preserves the three existing media and independently validates the fourth',()=>{
 assert.deepEqual(validate(master,oldCatalog,['OPURO','OPOL','LIBERAL']),{ok:true,errors:[]});
 assert.deepEqual(validate(master,oldCatalog,['OPURO','OPOL','LIBERAL','HORIZONTE'],{horizonteCatalog:catalog}),{ok:true,errors:[]});
 assert.deepEqual(validate(master,oldCatalog,['HORIZONTE'],{horizonteCatalog:catalog}),{ok:true,errors:[]});
});
test('missing, ambiguous, foreign and malformed Horizon classifications fail closed',()=>{
 assert.equal(validate(master,oldCatalog,['HORIZONTE']).ok,false);
 const missing=structuredClone(master);delete missing.CATEGORIAS.HORIZONTE;assert.deepEqual(validate(missing,oldCatalog,['HORIZONTE'],{horizonteCatalog:catalog}).errors,['HORIZONTE_CLASIFICACION_REQUERIDA']);
 const wrong=structuredClone(master);wrong.CATEGORIAS.HORIZONTE.REGION='mexico';assert.ok(validate(wrong,oldCatalog,['HORIZONTE'],{horizonteCatalog:catalog}).errors.includes('HORIZONTE_MUNICIPIO_NO_CONFIRMADO'));
 const ambiguous=structuredClone(catalog);ambiguous.ehc_region.push(term('bcs',22));assert.ok(validate(master,oldCatalog,['HORIZONTE'],{horizonteCatalog:ambiguous}).errors.includes('HORIZONTE_REGION_NO_CONFIRMADA'));
 const invalid=structuredClone(master);invalid.CATEGORIAS.HORIZONTE.TEMA='OPURO';assert.ok(validate(invalid,oldCatalog,['HORIZONTE'],{horizonteCatalog:catalog}).errors.includes('HORIZONTE_TEMA_NO_CONFIRMADO'));
 assert.equal(validate(invalid,oldCatalog,['OPURO']).ok,true);
});
test('rejects default category and conflicting topic before any write',()=>{
 const x=structuredClone(master);x.CATEGORIAS.HORIZONTE.PRINCIPAL='sin-categoria';
 let result=validate(x,oldCatalog,['HORIZONTE'],{horizonteCatalog:catalog});
 assert.ok(result.errors.includes('HORIZONTE_CATEGORIA_NO_CONFIRMADA'));
 assert.ok(result.errors.includes('HORIZONTE_CATEGORIA_TEMA_DIFERENTES'));
 x.CATEGORIAS.HORIZONTE.PRINCIPAL='economia';
 result=validate(x,oldCatalog,['HORIZONTE'],{horizonteCatalog:catalog});
 assert.ok(result.errors.includes('HORIZONTE_CATEGORIA_TEMA_DIFERENTES'));
});
