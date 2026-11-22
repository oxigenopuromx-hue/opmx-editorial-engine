import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHorizonteEditorialClassification as normalize} from './horizonte-authoritative-catalog.mjs';
import {validateHorizonteClassification} from './horizonte-validation.mjs';
const terms=(id,slug)=>({id,slug,name:slug});
const catalog={category:[terms(3,'nueva-seccion')],ehc_topic:[terms(8,'nueva-seccion')],ehc_region:[terms(2,'bcs')],ehc_municipality:[]};
const response={statusCode:200,body:{schemaVersion:1,items:[{slug:'nueva-seccion',name:'Nueva sección',categoryId:3,topicId:8}]}};
test('new deployed editorial slugs are accepted without a static whitelist',()=>{
 const editorialSlugs=normalize(response,catalog);
 const master={CATEGORIAS:{HORIZONTE:{PRINCIPAL:'nueva-seccion',TEMA:'nueva-seccion',REGION:'bcs',TIPO:'news'}}};
 assert.equal(validateHorizonteClassification(master,{...catalog,editorialSlugs}).ok,true);
 assert.equal(validateHorizonteClassification(master,catalog).ok,false);
});
test('rejects partial, unauthenticated, ambiguous or inconsistent authoritative data',()=>{
 const variants=[{statusCode:401}, {statusCode:200,body:{schemaVersion:1,items:[]}},structuredClone(response),structuredClone(response)];
 variants[2].body.items[0].topicId=9;variants[3].body.items.push({...variants[3].body.items[0]});
 for(const variant of variants)assert.throws(()=>normalize(variant,catalog));
});
