import test from 'node:test';import assert from 'node:assert/strict';import {patchOpolSecondary as patch} from './writer-opol-secondary-patch.mjs';
const write=`={{ { categories: [
    Number(
      $('OPOL — Resolver categoría').first().json.category_id
    )
  ], tags: [] } }}`;
const read=`const p=$json,c=$('Validar y normalizar OPMX MASTER').first().json.canonical;if(!p.categories?.includes($('OPOL — Resolver categoría').first().json.category_id))throw Error('readback');return {json:{ok:true}};`;
const $=id=>name=>({first:()=>({json:name==='OPOL — Resolver categoría'?{category_id:10}:{canonical:{categories:{opol:id===undefined?{}:{secundaria_id:id}}}}})});
test('includes the proven secondary ID while preserving principal and legacy shape',()=>{const p=patch(write,read);const expr=p.writeExpression.slice(3,-2);assert.deepEqual(new Function('$','return ('+expr+')')($(1731)).categories,[10,1731]);assert.deepEqual(new Function('$','return ('+expr+')')($(undefined)).categories,[10]);});
test('readback requires the selected secondary when present',()=>{const p=patch(write,read);const run=(categories,id)=>new Function('$json','$',p.readbackCode)({categories},$(id));assert.equal(run([10,1731],1731).json.ok,true);assert.throws(()=>run([10],1731),/readback/);assert.equal(run([10],undefined).json.ok,true)});
test('refuses an unexpected node source',()=>assert.throws(()=>patch('changed',read),/SOURCE_CHANGED/));
