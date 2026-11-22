import test from 'node:test';import assert from 'node:assert/strict';import {buildLiteralDelivery} from './literal-delivery-v3.mjs';
test('literal delivery preserves selected category IDs and Horizonte facets unchanged',()=>{
 const categories={OPURO:{PRINCIPAL:'Deporte',PRINCIPAL_ID:43},OPOL:{PRINCIPAL:'ESTADOS',PRINCIPAL_ID:10,SECUNDARIA:'GUERRERO',SECUNDARIA_ID:1731},LIBERAL:{PRINCIPAL:'Economía',PRINCIPAL_ID:3},HORIZONTE:{PRINCIPAL:'economia',TEMA:'economia',REGION:'bcs',TIPO:'news'}};
 const policy={authorized:true,content_mode:'LITERAL',mode:'DRAFT',policy:'publish-todos-v3',destination:'TODOS',destinations:['OPURO','OPOL','LIBERAL','HORIZONTE']};
 const out=buildLiteralDelivery({baseMaster:{CONTROL_EDITORIAL:{ESTADO:'LISTO'},CATEGORIAS:categories},policy,packageId:'tg_'+'a'.repeat(40),revision:1,sourceText:'Título de prueba\n\nPárrafo original.',title:'Título de prueba',subtitle:'',paragraphs:['Párrafo original.']});
 assert.deepEqual(out.master.CATEGORIAS,categories);assert.match(out.master.GUTENBERG_FINAL,/Párrafo original/);
});
