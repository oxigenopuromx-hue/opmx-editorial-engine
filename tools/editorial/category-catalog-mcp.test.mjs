import test from 'node:test';import assert from 'node:assert/strict';
import {classifyCategoryCatalog as classify,formatCategoryCatalog as format} from './category-catalog-mcp.mjs';
const call=args=>({jsonrpc:'2.0',id:7,method:'tools/call',params:{name:'consultar_categorias_editoriales_opmx',arguments:args}});
const req={id:7,site:'OPURO',page:1};
const identity={owner:'1',chat:'1'};
test('routes only a bounded site and page; rejects URLs and extra input',()=>{
 assert.equal(classify(call({site:'OPURO',page:1}),{},identity).route,'editorial-category-catalog');
 for(const a of [{site:'https://example.com',page:1},{site:'OPURO',page:0},{site:'OPURO',page:101},{site:'OPURO',page:1,url:'https://example.com'}])assert.equal(classify(call(a),{},identity).response.error.code,-32602);
 assert.equal(classify(call({site:'OPURO',page:1}),{},null).response.error.code,-32602);
});
test('publishes a read-only schema exactly once',()=>{
 const base={response:{result:{tools:[]}}},msg={method:'tools/list'};
 assert.equal(classify(msg,base).response.result.tools[0].annotations.readOnlyHint,true);
 assert.throws(()=>classify(msg,base),/DUPLICATE/);
});
test('returns only validated category fields, with no headers',()=>{
 const out=format(req,{statusCode:200,headers:{'x-wp-totalpages':'1',authorization:'secret'},body:[{id:1,name:'Ciencia',slug:'ciencia',parent:0,extra:'ignored'}]}).response.result;
 assert.equal(out.isError,false);assert.deepEqual(out.structuredContent.body,[{id:1,name:'Ciencia',slug:'ciencia',parent:0}]);assert.equal(JSON.stringify(out).includes('secret'),false);
});
test('rejects malformed, partial, out-of-range and unauthenticated responses',()=>{
 for(const response of [{statusCode:401,headers:{},body:'secret'},{statusCode:200,headers:{},body:[]},{statusCode:200,headers:{'X-WP-TotalPages':'2'},body:[{id:1,name:'A',slug:'a',parent:0}]},{statusCode:200,headers:{'X-WP-TotalPages':'1'},body:[{id:1,name:'A',slug:'a',parent:0},{id:1,name:'B',slug:'b',parent:0}]}])assert.equal(format(req,response).response.result.isError,true);
});
