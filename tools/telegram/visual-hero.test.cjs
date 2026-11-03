const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const {cropRect, makeHero} = require('./visual-hero.cjs');

test('encuadra fotos horizontales y verticales alrededor del punto elegido', () => {
 const left = cropRect(2000, 1000, 0, .5), right = cropRect(2000, 1000, 1, .5);
 assert.equal(left.left, 0); assert.equal(right.left + right.width, 2000);
 const bottom = cropRect(900, 1600, .5, 1); assert.equal(bottom.top + bottom.height, 1600);
 assert.throws(() => cropRect(900, 1600, undefined, .5));
 assert.throws(() => cropRect(900, 1600, 1.1, .5));
});
test('genera JPEG de dimensiones exactas y rechaza entradas inválidas', async () => {
 const image = await sharp({create:{width:1000,height:800,channels:3,background:'#559933'}}).png().toBuffer();
 const result = await makeHero(image,.5,.5);
 const meta = await sharp(result.bytes).metadata();
 assert.equal(meta.width,1200); assert.equal(meta.height,630); assert.equal(meta.format,'jpeg');
 await assert.rejects(makeHero(Buffer.from('no es imagen'),.5,.5));
 await assert.rejects(makeHero(image,NaN,.5));
});
