import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {categoryExclusionIds,readOpuroCategoryHome,assertOpuroCategoryMembership,opuroCategoryHomeMeta,assertOpuroCategoryReadback,checkOpuroCategoryUpdate,assertPreservedOpuroCategoryMeta} from './opuro-category-home.mjs';
const master=ids=>({PUBLICACION:{EXTRACTO:'Texto',OPURO:{EXCLUIR_PORTADA_CATEGORIAS_IDS:ids}}});
test('optional extension resolves for both profiles without changing their base contract or adding required fields',()=>{
 const read=path=>JSON.parse(readFileSync(new URL('../../'+path,import.meta.url),'utf8')),manifest=read('manifest.json'),extension=read('contracts/OPURO_CATEGORY_HOME_v1.0.json');
 for(const name of ['EDITORIAL','LITERAL']){const profile=manifest.content_profiles[name],base=read(profile.path);assert.ok(profile.optional_extensions.includes('opuro_category_home'));assert.equal(base.properties.PUBLICACION.additionalProperties,undefined);assert.equal(base.properties.PUBLICACION.required.includes('OPURO'),false)}
 assert.equal(manifest.content_profiles.EDITORIAL.version,'1.4.2');assert.equal(manifest.content_profiles.LITERAL.version,'1.0');assert.equal(extension.optional,true);assert.equal(extension.field,'PUBLICACION.OPURO.EXCLUIR_PORTADA_CATEGORIAS_IDS');
});
test('absent policy preserves the historical MASTER and emits no REST key',()=>{
 const value={PUBLICACION:{EXTRACTO:'Texto'}},before=JSON.stringify(value),policy=readOpuroCategoryHome(value,true);
 assert.deepEqual(policy,{declared:false});assert.deepEqual(opuroCategoryHomeMeta(policy),{});assert.equal(JSON.stringify(value),before);
 assert.deepEqual(readOpuroCategoryHome({PUBLICACION:{OPURO:{}}},true),{declared:false});
});
test('explicit empty array is a replacement distinct from absence',()=>{
 const policy=readOpuroCategoryHome(master([]),true);assert.deepEqual(policy,{declared:true,ids:[]});assert.deepEqual(opuroCategoryHomeMeta(policy),{oxpuro_excluded_category_ids:[]});
 assertOpuroCategoryMembership(policy,[61]);assertOpuroCategoryReadback(policy,{categories:[61],meta:{oxpuro_excluded_category_ids:[]}});
});
for(const ids of [null,undefined,'61',[61],['0'],['01'],['+61'],[' 61'],['61 '],['6.1'],['6e1'],['-61'],['1/2'],['9007199254740992'],['61','61'],[''],[{}],Array.from({length:101},(_,i)=>String(i+1))])test('reject ambiguous exclusions '+JSON.stringify(ids),()=>assert.throws(()=>readOpuroCategoryHome(master(ids),true),/OPURO_CATEGORY_HOME_INVALID/));
test('positive canonical string IDs remain exact and input is never mutated',()=>{
 const value=master(['61','2']),before=JSON.stringify(value),p=readOpuroCategoryHome(value,true);assertOpuroCategoryMembership(p,[2,61]);assert.equal(JSON.stringify(value),before);const meta=opuroCategoryHomeMeta(p);meta.oxpuro_excluded_category_ids.push('3');assert.deepEqual(p.ids,['61','2']);
});
test('another CMS cannot receive OPURO configuration, including explicit empty',()=>{
 for(const ids of [[],['61']])assert.throws(()=>readOpuroCategoryHome(master(ids),false),/DESTINATION/);
 for(const destination of ['OPOL','LIBERAL'])assert.throws(()=>checkOpuroCategoryUpdate(destination,{meta:{oxpuro_excluded_category_ids:[]}},{}),/DESTINATION/);
});
test('only verified assigned categories validate membership',()=>{
 const p={declared:true,ids:['61']};for(const ids of [undefined,[],['61'],[0],[61,61],[2]])assert.throws(()=>assertOpuroCategoryMembership(p,ids),/MEMBERSHIP/);assertOpuroCategoryMembership(p,[61]);
});
test('readback must expose the exact array and assigned category',()=>{
 const p={declared:true,ids:['61']};assertOpuroCategoryReadback(p,{categories:[61],meta:{oxpuro_excluded_category_ids:['61']}});
 for(const post of [{categories:[61]},{categories:[61],meta:{oxpuro_excluded_category_ids:[]}},{categories:[61],meta:{oxpuro_excluded_category_ids:[61]}},{categories:[2],meta:{oxpuro_excluded_category_ids:['61']}}])assert.throws(()=>assertOpuroCategoryReadback(p,post));
});
test('UPDATE omission preserves category and general-home decisions independently',()=>{
 const before={meta:{oxpuro_excluded_category_ids:['61'],oxpuro_exclude_home:true}},payload={meta:{oxpuro_editorial:{subtitle:'Nuevo'}}};
 checkOpuroCategoryUpdate('OPURO',payload,before);assertPreservedOpuroCategoryMeta('OPURO',payload,before,structuredClone(before));
 for(const key of ['oxpuro_excluded_category_ids','oxpuro_exclude_home']){const after=structuredClone(before);delete after.meta[key];assert.throws(()=>assertPreservedOpuroCategoryMeta('OPURO',payload,before,after),/PRESERVATION/)}
});
test('explicit UPDATE replaces only the declared category array and preserves home flag',()=>{
 const before={categories:[61],meta:{oxpuro_excluded_category_ids:['61'],oxpuro_exclude_home:true}},payload={meta:{oxpuro_excluded_category_ids:[]}},after={...before,meta:{...before.meta,oxpuro_excluded_category_ids:[]}};
 checkOpuroCategoryUpdate('OPURO',payload,before);assertPreservedOpuroCategoryMeta('OPURO',payload,before,after);after.meta.oxpuro_exclude_home=false;assert.throws(()=>assertPreservedOpuroCategoryMeta('OPURO',payload,before,after),/PRESERVATION/);
});
test('UPDATE validates exclusions against final selected categories before a write claim',()=>{
 checkOpuroCategoryUpdate('OPURO',{categories:[2],meta:{oxpuro_excluded_category_ids:['2']}},{categories:[61]});
 assert.throws(()=>checkOpuroCategoryUpdate('OPURO',{categories:[2],meta:{oxpuro_excluded_category_ids:['61']}},{categories:[61]}),/MEMBERSHIP/);
 assert.throws(()=>checkOpuroCategoryUpdate('OPURO',{categories:[2]},{categories:[61],meta:{oxpuro_excluded_category_ids:['61']}}),/MEMBERSHIP/);
 checkOpuroCategoryUpdate('OPURO',{categories:[2,61]},{categories:[61],meta:{oxpuro_excluded_category_ids:['61']}});
});
