import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readInlinePlan,decodeInlineBundle,assertInlineImageHash,paragraphBoundaries,renderInlineMedia,stripVerifiedInlineMedia,inlineImageBlock,inlineMetadataMatches} from './inline-media.mjs';
import {assertLiteralCanonicalText} from './literal-text.mjs';
const gb=['Primer párrafo.','Segundo párrafo.','Tercer párrafo.'].map(x=>'<!-- wp:paragraph -->\n<p>'+x+'</p>\n<!-- /wp:paragraph -->').join('\n\n');
const bytes=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
const hash=createHash('sha256').update(bytes).digest('hex');

test('WordPress attachment metadata accepts one entity encoding without removing markup or changing words',()=>{
 assert.equal(inlineMetadataMatches('Crédito &amp; foto','Crédito & foto'),true);
 assert.equal(inlineMetadataMatches('Crédito &#038; foto','Crédito & foto'),true);
 assert.equal(inlineMetadataMatches('Crédito &#x26; foto','Crédito & foto'),true);
 assert.equal(inlineMetadataMatches('Crédito &amp;amp; foto','Crédito & foto'),false);
 assert.equal(inlineMetadataMatches('<p>Crédito &amp; foto</p>','Crédito & foto'),false);
 assert.equal(inlineMetadataMatches('Crédito &amp; otra','Crédito & foto'),false);
 assert.equal(inlineMetadataMatches('Crédito &#0; foto','Crédito & foto'),false);
});
const image=(id='img01',after=1)=>({ID:id,SHA256:hash,BYTES:bytes.length,MIME:'image/png',DESPUES_PARRAFO:after,ALT:'Imagen aportada',LEYENDA:'',CREDITO:''});
const master=(images=[image()])=>({IMAGENES:{INTERIORES:images},GUTENBERG_FINAL:gb,GUTENBERG_ENRIQUECIDO_FINAL:gb});
const attachment=(assetId='img01',id=100,site='OPURO')=>({assetId,id,url:({OPURO:'https://cms.oxigenopuro.com.mx',OPOL:'https://cms.oxigenopolitico.com.mx',LIBERAL:'https://cms.elliberal.mx',HORIZONTE:'https://cms.horizontedecalifornia.mx'})[site]+'/wp-content/uploads/2026/11/image-'+id+'.png'});
test('legacy zero-image masters keep their original content',()=>{
  assert.deepEqual(readInlinePlan({}),[]);assert.equal(renderInlineMedia(gb,[],[],'OPURO'),gb);
});
test('verified bundle bytes have a one-to-one binding to the plan',()=>{
  const plan=readInlinePlan(master());const assets=decodeInlineBundle({schema:'opmx.inline-images.v1',images:[{id:'img01',base64:bytes.toString('base64')}]},plan);
  assert.deepEqual(assets[0].buffer,bytes);assertInlineImageHash(assets[0],hash);
  assert.throws(()=>assertInlineImageHash(assets[0],'0'.repeat(64)),/SHA256/);
});
test('rejects corrupt bytes, duplicates, extra files and missing files',()=>{
  const plan=readInlinePlan(master());const row={id:'img01',base64:bytes.toString('base64')};
  for(const images of [[],[row,row],[{...row,id:'img02'}],[{...row,base64:'A'.repeat(16)}]]){
    assert.throws(()=>decodeInlineBundle({schema:'opmx.inline-images.v1',images},plan),/INLINE_/);
  }
});
test('validates canonical Base64 at the 10MiB transport limit without recursive matching',()=>{
  const original=Buffer.alloc(10*1024*1024);bytes.copy(original);const manifest={...image(),BYTES:original.length,SHA256:createHash('sha256').update(original).digest('hex')};
  const plan=readInlinePlan(master([manifest]));const assets=decodeInlineBundle({schema:'opmx.inline-images.v1',images:[{id:'img01',base64:original.toString('base64')}]},plan);
  assert.equal(assets[0].buffer.length,original.length);assertInlineImageHash(assets[0],manifest.SHA256);
});
test('manifest positions must exist in both delivery variants',()=>{
  assert.throws(()=>readInlinePlan(master([image('img01',4)])),/POSITION_OUT_OF_RANGE/);
  assert.throws(()=>readInlinePlan({...master([image('img01',3)]),GUTENBERG_FINAL:gb.split('\n\n')[0]}),/POSITION_OUT_OF_RANGE/);
});
test('does not consume original text or accept markup as metadata',()=>{
  for(const field of ['ALT','LEYENDA','CREDITO'])assert.throws(()=>readInlinePlan(master([{...image(),[field]:'<script>evil</script>'}])),/METADATA_INVALID/);
});
test('multiple images after one paragraph and a leading image retain order',()=>{
  const plan=readInlinePlan(master([image('img01',0),image('img02',2),image('img03',2)]));
  const uploads=[attachment(),attachment('img02',101),attachment('img03',102)];
  const out=renderInlineMedia(gb,plan,uploads,'OPURO');
  assert.ok(out.indexOf('wp-image-100')<out.indexOf('Primer párrafo.'));
  assert.ok(out.indexOf('Segundo párrafo.')<out.indexOf('wp-image-101'));
  assert.ok(out.indexOf('wp-image-101')<out.indexOf('wp-image-102'));
  assert.ok(out.indexOf('wp-image-102')<out.indexOf('Tercer párrafo.'));
  assert.equal(stripVerifiedInlineMedia(out,plan,uploads,'OPURO'),gb);
});
for(const site of ['OPURO','OPOL','LIBERAL','HORIZONTE'])test('native attachment references are scoped to '+site,()=>{
  const plan=readInlinePlan(master());const uploads=[attachment('img01',123,site)];
  const out=renderInlineMedia(gb,plan,uploads,site);assert.match(out,/wp-image-123/);
  assert.equal(stripVerifiedInlineMedia(out,plan,uploads,site),gb);
  const other=site==='OPURO'?'OPOL':'OPURO';
  assert.throws(()=>renderInlineMedia(gb,plan,uploads,other),/ATTACHMENT_UNCONFIRMED/);
});
test('literal title, subtitle and all paragraph units remain verifiable',()=>{
  const plan=readInlinePlan(master());const uploads=[attachment()];const out=renderInlineMedia(gb,plan,uploads,'OPURO');
  const clean=stripVerifiedInlineMedia(out,plan,uploads,'OPURO');
  const source='Título original\n\nSubtítulo original\n\nPrimer párrafo.\n\nSegundo párrafo.\n\nTercer párrafo.';
  assertLiteralCanonicalText({sourceText:source,title:'Título original',subtitle:'Subtítulo original',html:clean,gutenberg:clean,enriched:clean});
});
test('readback rejects missing, duplicate, changed and moved images',()=>{
  const plan=readInlinePlan(master());const uploads=[attachment()];const block=inlineImageBlock(plan[0],uploads[0],'OPURO');
  const out=renderInlineMedia(gb,plan,uploads,'OPURO');
  for(const changed of [gb,out+'\n\n'+block,out.replace('Imagen aportada','Otra imagen'),block+'\n\n'+gb]){
    assert.throws(()=>stripVerifiedInlineMedia(changed,plan,uploads,'OPURO'),/INLINE_/);
  }
});
test('unknown existing native blocks require an explicit source mapping',()=>{
  assert.throws(()=>readInlinePlan({...master(),GUTENBERG_FINAL:gb+'\n<!-- wp:image {"id":77} /-->'}),/EXISTING_MEDIA/);
});
test('a paragraph nested in a quote is not counted as a top-level anchor',()=>{
  const nested='<!-- wp:quote --><blockquote><!-- wp:paragraph --><p>Cita</p><!-- /wp:paragraph --></blockquote><!-- /wp:quote -->\n'+gb;
  assert.equal(paragraphBoundaries(nested).length,3);
});
test('unsafe URLs, reused CMS IDs and incomplete mappings fail closed',()=>{
  const plan=readInlinePlan(master([image(),image('img02',2)]));
  assert.throws(()=>renderInlineMedia(gb,plan,[attachment(),attachment('img02',100)],'OPURO'),/INCOMPLETE/);
  assert.throws(()=>renderInlineMedia(gb,plan,[attachment()],'OPURO'),/INCOMPLETE/);
  for(const url of ['https://evil.example/image.png','https://cms.oxigenopuro.com.mx/wp-content/uploads/../x.png','https://cms.oxigenopuro.com.mx/wp-content/uploads/%2e%2e/x.png']){
    assert.throws(()=>renderInlineMedia(gb,[plan[0]],[{...attachment(),url}],'OPURO'),/ATTACHMENT_UNCONFIRMED/);
  }
});
