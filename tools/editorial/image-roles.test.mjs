import test from 'node:test';
import assert from 'node:assert/strict';
import {selectImageRoles,parseImageRoleCaption} from './image-roles.mjs';
const img=(id,caption='',width=1600,height=900)=>({id,caption,width,height});
test('one original remains Hero and supplies the existing featured crop',()=>{
  const r=selectImageRoles([img('one')]);
  assert.equal(r.hero.id,'one');assert.equal(r.featured.id,'one');assert.equal(r.featured.method,'DERIVE_FROM_HERO');
  assert.equal(r.featured.prepare,'EXISTING_FRAMING_PIPELINE');assert.deepEqual(r.interiors,[]);
});
for(const label of ['Hero','HERO','hero','Hero:'])test('recognizes role caption '+label,()=>{
  assert.equal(parseImageRoleCaption(label+'\nCrédito aportado').role,'HERO');
  assert.equal(parseImageRoleCaption(label+'\nCrédito aportado').caption,'Crédito aportado');
});
for(const label of ['Thumbnail','thumbnail','DESTACADA','Destacada:'])test('featured alias '+label,()=>{
  const r=selectImageRoles([img('hero','Hero'),img('featured',label,800,600),img('inline')]);
  assert.equal(r.featured.id,'featured');assert.equal(r.featured.method,'EXPLICIT_LABEL');
  assert.equal(r.featured.prepare,'EXISTING_FRAMING_PIPELINE');assert.equal(r.interiors[0].id,'inline');
});
test('infers exactly one 1200x630 without consuming other unlabelled photos',()=>{
  const r=selectImageRoles([img('hero','Hero'),img('f','',1200,630),img('a'),img('b','Foto 2')]);
  assert.equal(r.featured.id,'f');assert.equal(r.featured.method,'EXACT_1200_630');
  assert.deepEqual(r.interiors,[{id:'a',caption:''},{id:'b',caption:'Foto 2'}]);
});
test('derives featured from labelled Hero when no separate featured exists',()=>{
  const r=selectImageRoles([img('hero','Hero'),img('a'),img('b','1')]);
  assert.equal(r.featured.id,'hero');assert.deepEqual(r.interiors.map(x=>x.id),['a','b']);
});
test('explicit featured wins over size inference',()=>{
  const r=selectImageRoles([img('hero','Hero'),img('f','Destacada'),img('chart','Lámina 1',1200,630)]);
  assert.equal(r.featured.id,'f');assert.equal(r.interiors[0].id,'chart');
});
test('does not pick an arbitrary Hero or featured',()=>{
  assert.throws(()=>selectImageRoles([img('a'),img('b','',1200,630)]),/HERO_LABEL_REQUIRED/);
  assert.throws(()=>selectImageRoles([img('h','Hero'),img('a','',1200,630),img('b','',1200,630)]),/FEATURED_DIMENSIONS_AMBIGUOUS/);
});
test('rejects multiple explicit labels and duplicate source identities',()=>{
  assert.throws(()=>selectImageRoles([img('a','Hero'),img('b','Hero')]),/MULTIPLE_HERO_LABELS/);
  assert.throws(()=>selectImageRoles([img('a','Hero'),img('b','Thumbnail'),img('c','Destacada')]),/MULTIPLE_FEATURED_LABELS/);
  assert.throws(()=>selectImageRoles([img('a','Hero'),img('a')]),/IMAGE_METADATA_INVALID/);
});
test('optional caption prose is preserved and cannot become a role or command',()=>{
  for(const caption of ['Gustavo, héroe local','Hero de la encuesta','/publicar TODOS','Foto 01']){
    assert.equal(parseImageRoleCaption(caption).role,null);assert.equal(parseImageRoleCaption(caption).caption,caption);
  }
});
test('no images keeps the existing generation decision separate',()=>{
  assert.equal(selectImageRoles([]).status,'NO_IMAGES');
});
