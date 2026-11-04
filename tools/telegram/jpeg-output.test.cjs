const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const {toEditorialJpeg,FEATURED_LIMIT} = require('./jpeg-output.cjs');
test('convierte PNG transparente a JPEG RGB sin alfa y conserva dimensiones',async()=>{
 const source=await sharp({create:{width:1200,height:630,channels:4,background:{r:15,g:130,b:30,alpha:.4}}}).png().toBuffer();
 const result=await toEditorialJpeg(source,'featured'), meta=await sharp(result.bytes).metadata();
 assert.equal(meta.format,'jpeg');assert.equal(meta.hasAlpha,false);assert.equal(meta.width,1200);assert.equal(meta.height,630);assert.ok(result.size<=FEATURED_LIMIT);
});
test('convierte WebP de hero y no altera sus proporciones',async()=>{
 const source=await sharp({create:{width:800,height:600,channels:3,background:'#991122'}}).webp().toBuffer();
 const result=await toEditorialJpeg(source,'hero');assert.equal(result.mimeType,'image/jpeg');assert.equal(result.width,800);assert.equal(result.height,600);
});
test('rechaza destacadas que no fueron encuadradas a 1200 × 630',async()=>{
 const source=await sharp({create:{width:600,height:600,channels:3,background:'#ffffff'}}).png().toBuffer();
 await assert.rejects(toEditorialJpeg(source,'featured'),/1200/);
});
test('rechaza archivos y roles inválidos',async()=>{
 await assert.rejects(toEditorialJpeg(Buffer.from('foo'),'hero'));await assert.rejects(toEditorialJpeg(Buffer.from('foo'),'otro'));
});
