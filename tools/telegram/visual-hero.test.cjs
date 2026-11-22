'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),sharp=require('sharp');
const {cropFeatured}=require('./visual-hero.cjs');
test('crops and centers a wide source without changing the original',async()=>{
 const input=await sharp({create:{width:2000,height:700,channels:3,background:'#abc'}}).png().toBuffer(),before=Buffer.from(input);
 const r=await cropFeatured(input,{x:0,y:0.5});
 assert.equal(r.width,1200);assert.equal(r.height,630);assert.equal(r.crop.left,0);assert.deepEqual(input,before);
 const metadata=await sharp(r.bytes).metadata();assert.equal(metadata.width,1200);assert.equal(metadata.height,630);
});
test('keeps crop bounds for portrait, edge focus and rejects invalid input',async()=>{
 const input=await sharp({create:{width:700,height:1400,channels:3,background:'#fff'}}).png().toBuffer();
 const r=await cropFeatured(input,{x:1,y:1});assert.equal(r.crop.top+r.crop.height,1400);
 await assert.rejects(cropFeatured(input,{x:2,y:0}),/IMAGE_FOCUS_INVALID/);
 await assert.rejects(cropFeatured(Buffer.from('invalid')));
});
