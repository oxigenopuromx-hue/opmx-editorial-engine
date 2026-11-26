import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareInlineMediaMaster} from './inline-media-delivery.mjs';
import {readInlinePlan,decodeInlineBundle} from './inline-media.mjs';
const body='<!-- wp:paragraph -->\n<p>Texto original.</p>\n<!-- /wp:paragraph -->';
const base=()=>({CONTROL_EDITORIAL:{ESTADO:'LISTO'},SEO:{TITULO_SEO:'Título original'},IMAGENES:{HERO_OPURO:{URL:'{{OPMX:HERO_OPURO}}'}},GUTENBERG_FINAL:body,GUTENBERG_ENRIQUECIDO_FINAL:body});
const bytes=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
const source=()=>({id:'img01',bytes,afterParagraph:1,alt:'Imagen original'});
test('builds native-file metadata from exact original bytes',()=>{
 const m=base(),out=prepareInlineMediaMaster(m,[source()]);
 assert.equal(out.GUTENBERG_FINAL,body);assert.equal(m.IMAGENES.INTERIORES,undefined);
 const rows=decodeInlineBundle(out.MEDIA_ARCHIVOS,readInlinePlan(out));assert.deepEqual(rows[0].buffer,bytes);
 assert.equal(rows[0].manifest.SHA256,createHash('sha256').update(bytes).digest('hex'));
});
test('preserves a real Telegram source identity or null for manual files',()=>{
 const id='ti_'+'a'.repeat(40);const m=prepareInlineMediaMaster(base(),[{...source(),itemId:id}]);
 assert.equal(m.IMAGENES.INTERIORES[0].ITEM_ID,id);
 assert.equal(prepareInlineMediaMaster(base(),[source()]).IMAGENES.INTERIORES[0].ITEM_ID,null);
});
test('does not repurpose a declared manifest or silently replace bytes',()=>{
 const m=prepareInlineMediaMaster(base(),[source()]);
 assert.throws(()=>prepareInlineMediaMaster(m,[source()]),/ALREADY_DECLARED/);
 assert.throws(()=>prepareInlineMediaMaster(base(),[{...source(),bytes:'not original bytes'}]),/BYTES_INVALID/);
});
test('zero interiors keep a legacy master free of extra transport fields',()=>{
 const m=base(),out=prepareInlineMediaMaster(m,[]);assert.deepEqual(out,m);assert.notEqual(out,m);
});
