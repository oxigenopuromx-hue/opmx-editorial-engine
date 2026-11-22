import test from 'node:test';import assert from 'node:assert/strict';
import {formatHorizonteCategoryCatalog as format} from './horizonte-catalog-tool.mjs';
import {normalizeHorizonteCatalog as terms} from './horizonte-catalog.mjs';
import {normalizeHorizonteEditorialClassification as authority} from './horizonte-authoritative-catalog.mjs';
const term=(id,slug)=>({id,slug,name:slug});
const a={statusCode:200,body:{category:[term(1,'nueva')],ehc_topic:[term(2,'nueva')],ehc_region:[term(3,'bcs')],ehc_municipality:[]}};
const b={statusCode:200,body:{schemaVersion:1,items:[{slug:'nueva',name:'Nueva',categoryId:1,topicId:2}]}};
test('returns only paired, authenticated results without transport headers',()=>{const r=format({id:1,site:'HORIZONTE',page:1},{...a,headers:{authorization:'secret'}},b,terms,authority).response.result;assert.equal(r.isError,false);assert.deepEqual(r.structuredContent.editorialSlugs,['nueva']);assert.equal(JSON.stringify(r).includes('secret'),false)});
test('fails closed if either response or page is invalid',()=>{for(const [req,x,y] of [[{site:'HORIZONTE',page:2},a,b],[{site:'HORIZONTE',page:1},{statusCode:401},b],[{site:'HORIZONTE',page:1},a,{statusCode:503}]])assert.equal(format(req,x,y,terms,authority).response.result.isError,true)});
