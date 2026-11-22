import test from 'node:test';import assert from 'node:assert/strict';import {normalizeWriterCategoryPages as normalize} from './writer-category-pages.mjs';
const row=(id,parent=0)=>({id,name:`cat ${id}`,slug:`cat-${id}`,parent});
const page=(body,total='5',pages='3')=>({statusCode:200,headers:{'x-wp-totalpages':pages,'x-wp-total':total},body});
const good=[page([row(1),row(2)]),page([row(3,1),row(4)]),page([row(5)])];
test('requires all pages, parent hierarchy, totals and strict ID ordering',()=>assert.equal(normalize(good,2).length,5));
test('rejects incomplete, shifted, duplicate or unauthorized results',()=>{
 for(const bad of [good.slice(0,2),[good[0],good[0],good[2]],[good[0],page([row(3),row(4)],'6'),good[2]],[good[0],good[1],page([row(5,99)])],[good[0],good[1],{statusCode:401,headers:{},body:[]}],[page([row(1),row(2)]),page([row(3),row(3)]),good[2]]])assert.throws(()=>normalize(bad,2),/UNCONFIRMED/);
});
test('does not depend on header case or include unrelated CMS data',()=>{const response={statusCode:200,headers:{'X-WP-Total':'1','X-WP-TotalPages':'1',authorization:'secret'},body:[{...row(1),extra:'secret'}]};assert.deepEqual(normalize([response],2),[row(1)]);});
