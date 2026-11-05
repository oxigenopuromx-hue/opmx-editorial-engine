import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCandidate } from './build-category-placement-candidate.mjs';

function fixture(){
  const nodes=Array.from({length:91},(_,i)=>({name:'Fixture '+i,type:'n8n-nodes-base.noOp',parameters:{}}));
  const swap=(i,name,parameters)=>nodes[i]={name,type:'n8n-nodes-base.code',parameters,position:[0,0]};
  swap(0,'Validar y normalizar OPMX MASTER',{jsCode:'const categoryOpol=str(OPOLCAT.PRINCIPAL??OPOLCAT.principal??SEO.CATEGORIA??SEO.category);\nreturn {json:{canonical:{\n      categories:{opuro:{principal:category}}}}};'});
  swap(1,'OPURO — Resolver categoría',{jsCode:'return [{json:{category_id:12}}];'});
  swap(2,'OPURO — Preparar etiquetas v1.13',{jsCode:'return [];'});
  swap(3,'OPURO — Crear borrador Gutenberg enriquecido',{jsonBody:'={{ { meta:{\n    oxpuro_editorial: { subtitle: \'x\' }\n} } }}'});
  swap(4,'OPURO — Validar antes de publicar',{jsCode:'const p=$json;\nreturn {json:{validated:true,post_id:Number(p.id)}};'});
  return {nodes,connections:{'OPURO — Resolver categoría':{main:[[{node:'OPURO — Preparar etiquetas v1.13',type:'main',index:0}]]}},active:true,id:'test',versionId:'old'};
}
test('adds a single inactive preflight, preserving 91 original node definitions',()=>{
  const source=fixture(),old=structuredClone(source),w=buildCandidate(source);
  assert.deepEqual(source,old);
  assert.equal(w.nodes.length,92);
  assert.equal(w.active,false);
  assert.equal(w.id,undefined);
  assert.equal(w.connections['OPURO — Resolver categoría'].main[0][0].node,'OPURO — Preflight de colocación (CANDIDATO)');
  assert.equal(w.connections['OPURO — Preflight de colocación (CANDIDATO)'].main[0][0].node,'OPURO — Preparar etiquetas v1.13');
  assert.match(w.nodes.find(n=>n.name==='OPURO — Crear borrador Gutenberg enriquecido').parameters.jsonBody,/placement_requested/);
  assert.match(w.nodes.find(n=>n.name==='OPURO — Validar antes de publicar').parameters.jsCode,/readback mismatch/);
  assert.match(w.nodes.find(n=>n.name==='Validar y normalizar OPMX MASTER').parameters.jsCode,/placementSpecified/);
});
test('candidate blocks drift instead of overwriting unknown workflow',()=>{
  const w=fixture(); w.nodes.pop(); assert.throws(()=>buildCandidate(w),/drift/);
  const x=fixture(); x.connections['OPURO — Resolver categoría'].main[0][0].node='Wrong'; assert.throws(()=>buildCandidate(x),/drift/);
});
test('preflight supports ancestor traversal and fails closed on invalid hierarchy',async()=>{
  const w=buildCandidate(fixture());
  const preflight=w.nodes.find(n=>n.name==='OPURO — Preflight de colocación (CANDIDATO)').parameters.jsCode;
  const run=new (Object.getPrototypeOf(async function(){}).constructor)('$',preflight);
  const stub=(selection,categories)=>({
    lookup(name){if(name==='Validar y normalizar OPMX MASTER')return {json:{canonical:{category_placement_excluded_ids:selection}}};return {json:{category_id:35}};},
    http:async ({url})=>categories[Number(url.split('/').at(-1))]
  });
  const valid=stub(['10'],{35:{id:35,parent:10},10:{id:10,parent:0}});
  let result=await run.call({helpers:{httpRequest:valid.http}},name=>({first:()=>valid.lookup(name)}));
  assert.deepEqual(result[0].json.excluded_category_ids,['10']);
  const absent=stub(undefined,{});
  result=await run.call({helpers:{}},name=>({first:()=>absent.lookup(name)}));
  assert.equal(result[0].json.placement_requested,false);
  const bad=stub(['99'],{35:{id:35,parent:10},10:{id:10,parent:0}});
  await assert.rejects(()=>run.call({helpers:{httpRequest:bad.http}},name=>({first:()=>bad.lookup(name)})),/not eligible/);
});
