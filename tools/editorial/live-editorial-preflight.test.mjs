import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLiveEditorialDestinations as validate} from './live-editorial-preflight.mjs';
import {classifyCategoryCatalog,formatCategoryCatalog} from './category-catalog-mcp.mjs';

const row=(id,name,parent=0)=>({id,name,slug:`cat-${id}`,parent});
const m={SEO:{CATEGORIA:'Ciencia'},CATEGORIAS:{OPURO:{PRINCIPAL:'Ciencia'},OPOL:{PRINCIPAL:'Política',SECUNDARIA:'Congreso'},LIBERAL:{PRINCIPAL:'Economía'}}};
const catalogs={OPURO:[row(1,'Ciencia')],OPOL:[row(1,'Política'),row(2,'Congreso',1)],LIBERAL:[row(1,'Economía')]};
function transport(cats=catalogs) { return {fetchPage:async({site})=>({status:200,totalPages:1,body:cats[site]})}; }
test('uses independent live catalogs for three destinations and validates OPOL hierarchy',async()=>{
 assert.deepEqual(await validate(m,['OPURO','OPOL','LIBERAL'],transport()),{ok:true,errors:[]});
 const wrong=structuredClone(catalogs); wrong.OPOL[1].parent=0;
 assert.equal((await validate(m,['OPOL'],transport(wrong))).ok,false);
});
test('a newly added live category works and a removed category cannot use a stale snapshot',async()=>{
 const changed=structuredClone(catalogs);changed.OPURO=[row(9,'Innovación')];
 assert.equal((await validate(m,['OPURO'],transport(changed))).ok,false);
 const next=structuredClone(m);next.CATEGORIAS.OPURO.PRINCIPAL='Innovación';next.SEO.CATEGORIA='Innovación';
 assert.equal((await validate(next,['OPURO'],transport(changed))).ok,true);
});
test('does not resolve normalized duplicate names to the first result',async()=>{
 const ambiguous=structuredClone(catalogs);ambiguous.OPOL.push(row(3,'Politica'));
 assert.equal((await validate(m,['OPOL'],transport(ambiguous))).ok,false);
 const selected=structuredClone(m);selected.CATEGORIAS.OPOL.PRINCIPAL_ID=1;
 assert.equal((await validate(selected,['OPOL'],transport(ambiguous))).ok,true);
 selected.CATEGORIAS.OPOL.PRINCIPAL_ID=3;
 assert.equal((await validate(selected,['OPOL'],transport(ambiguous))).ok,false);
});
test('duplicate literal names can be distinguished by site-specific ID',async()=>{
 const ambiguous=structuredClone(catalogs);ambiguous.OPURO=[row(1,'Deporte'),row(2,'Noticias'),row(3,'Deporte',2)];
 const master=structuredClone(m);master.SEO.CATEGORIA='Deporte';master.CATEGORIAS.OPURO={PRINCIPAL:'Deporte'};
 assert.equal((await validate(master,['OPURO'],transport(ambiguous))).ok,false);
 master.CATEGORIAS.OPURO.PRINCIPAL_ID=3;assert.equal((await validate(master,['OPURO'],transport(ambiguous))).ok,true);
 master.CATEGORIAS.OPURO.PRINCIPAL_ID=99;assert.equal((await validate(master,['OPURO'],transport(ambiguous))).ok,false);
});
test('only queries selected destinations; unavailable and malformed catalogs fail closed',async()=>{
 let calls=[];const t={fetchPage:async x=>{calls.push(x.site);return {status:200,totalPages:1,body:catalogs[x.site]}}};
 assert.equal((await validate(m,['LIBERAL'],t)).ok,true);assert.deepEqual(calls,['LIBERAL']);
 assert.deepEqual(await validate(m,['OPURO'],{}),{ok:false,errors:['CATALOGO_OPURO_NO_CONFIRMADO']});
 assert.equal((await validate(m,['OPURO'],transport({OPURO:[row(1,'child',99)]}))).ok,false);
});
test('rejects duplicate destinations and never treats a caller-supplied catalog as a transport',async()=>{
 assert.deepEqual(await validate(m,['OPURO','OPURO'],transport()),{ok:false,errors:['DESTINOS_INVALIDOS']});
 assert.equal((await validate(m,['OPURO'],{catalog:catalogs})).ok,false);
});
test('four destinations use separate catalogs and reject inconsistent Horizonte classification',async()=>{
 const term=(id,slug)=>({id,slug,name:slug});
 const response={statusCode:200,body:{category:[term(8,'politica')],ehc_region:[term(9,'bcs')],ehc_topic:[term(10,'politica'),term(11,'economia')],ehc_municipality:[term(12,'la-paz')]}};
 const master=structuredClone(m);master.CATEGORIAS.HORIZONTE={PRINCIPAL:'politica',TEMA:'politica',REGION:'bcs',TIPO:'news',MUNICIPIO:'la-paz'};
 const t={...transport(),fetchHorizonteCatalog:async()=>response,fetchHorizonteEditorialClassification:async()=>({statusCode:200,body:{schemaVersion:1,items:[{slug:'politica',name:'Política',categoryId:8,topicId:10}]}})};
 assert.equal((await validate(master,['OPURO','OPOL','LIBERAL','HORIZONTE'],t)).ok,true);
 master.CATEGORIAS.HORIZONTE.TEMA='economia';
 assert.equal((await validate(master,['OPURO','OPOL','LIBERAL','HORIZONTE'],t)).ok,false);
});
test('MCP page responses feed the live preflight without relying on source-provided URLs',async()=>{
 const fetchPage=async({site,page})=>{
  const message={jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'consultar_categorias_editoriales_opmx',arguments:{site,page}}};
  const request=classifyCategoryCatalog(message,{}, {owner:'1',chat:'1'}).request;
  const result=formatCategoryCatalog(request,{statusCode:200,headers:{'x-wp-totalpages':'1'},body:catalogs[site]}).response.result;
  if(result.isError)throw Error('CMS_CATALOG_UNCONFIRMED');
  return result.structuredContent;
 };
 assert.equal((await validate(m,['OPURO','OPOL','LIBERAL'],{fetchPage})).ok,true);
});
test('all 15 destination combinations independently query exactly their scoped catalogs',async()=>{
 const all=['OPURO','OPOL','LIBERAL','HORIZONTE'],term=(id,slug)=>({id,slug,name:slug});
 const response={statusCode:200,body:{category:[term(8,'politica')],ehc_region:[term(9,'bcs')],ehc_topic:[term(10,'politica')],ehc_municipality:[term(12,'la-paz')]}};
 const master=structuredClone(m);master.CATEGORIAS.HORIZONTE={PRINCIPAL:'politica',TEMA:'politica',REGION:'bcs',TIPO:'news',MUNICIPIO:'la-paz'};
 for(let mask=1;mask<16;mask++){
  const selected=all.filter((_,i)=>mask&(1<<i)),calls=[];
  const t={fetchPage:async({site})=>{calls.push(site);return {status:200,totalPages:1,body:catalogs[site]}},fetchHorizonteCatalog:async()=>{calls.push('HORIZONTE');return response},fetchHorizonteEditorialClassification:async()=>({statusCode:200,body:{schemaVersion:1,items:[{slug:'politica',name:'Política',categoryId:8,topicId:10}]}})};
  assert.equal((await validate(master,selected,t)).ok,true,selected.join(','));
  assert.deepEqual(calls.sort(),[...selected].sort());
 }
});
