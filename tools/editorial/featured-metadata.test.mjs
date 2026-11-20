import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareFeaturedMetadata} from './featured-metadata.mjs';
const alt='La imagen muestra un edificio oficial', token='{{OPMX:DESTACADA_OPURO}}';
for(const destination of ['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS']){
 test(destination+' complete featured contract without changing text',()=>{
  const source={IMAGENES:{HERO_OPURO:{ALT:alt}},TEXTO_EDITORIAL:{PARRAFOS:['Texto original literal.']}};
  const result=prepareFeaturedMetadata(source,{featuredAlt:alt});
  assert.equal(result.IMAGENES.DESTACADA_OPURO.URL,token);
  assert.equal(result.IMAGENES.DESTACADA_OPURO.ALT,alt);
  assert.deepEqual(result.TEXTO_EDITORIAL,source.TEXTO_EDITORIAL);
  assert.equal(source.IMAGENES.DESTACADA_OPURO,undefined);
 });
}
test('preserve supplied ALT and reject absent or untrusted values',()=>{
 let value=prepareFeaturedMetadata({IMAGENES:{DESTACADA_OPURO:{URL:token,ALT:'Fotografía existente'}}},{featuredAlt:alt});
 assert.equal(value.IMAGENES.DESTACADA_OPURO.ALT,'Fotografía existente');
 assert.throws(()=>prepareFeaturedMetadata({IMAGENES:{}},{}),/ALT_REQUIRED/);
 assert.throws(()=>prepareFeaturedMetadata({IMAGENES:{DESTACADA_OPURO:{URL:'https://example.com/image.jpg'}}},{featuredAlt:alt}),/URL_INVALID/);
 assert.throws(()=>prepareFeaturedMetadata({IMAGENES:{DESTACADA_OPURO:'bad'}},{featuredAlt:alt}),/METADATA_INVALID/);
});
