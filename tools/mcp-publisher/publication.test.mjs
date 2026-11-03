import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePublication,prepareExistingPublication,checkPublicationPreflight,recordPublication,recordPublicVisibility,summarizePublication} from './publication.mjs';
import {classifyFileMcp,parseMcpMaster} from './files-mcp-protocol.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const request={operation:'publicar_nota_opmx',confirmar_publicacion:'PUBLICAR',request_id:'opmx-fixture-publish-20261102',destino:'AMBOS'};
const receipt={status:'SUCCESS',mode:'DRAFT',request_id:request.request_id,post_id_opuro:900001,post_id_opol:900002,targets:{oxigenopuro:{status:'DRAFT',post_id:900001,slug:'opmx-fixture-no-publicar'},oxigenopolitico:{status:'DRAFT',post_id:900002,slug:'opmx-fixture-no-publicar'}}};
const post=d=>({id:d==='OPURO'?900001:900002,slug:'opmx-fixture-no-publicar',status:'draft',type:'post',title:{raw:'Fixture sintético; no publicar'},content:{raw:'<!-- wp:paragraph --><p>Fixture de pruebas.</p><!-- /wp:paragraph -->'},excerpt:{raw:'Fixture'},author:2,featured_media:900003,categories:[9],tags:[7,8],meta:{rank_math_title:'Fixture',rank_math_description:'Fixture',rank_math_focus_keyword:'fixture',...(d==='OPURO'?{oxpuro_hero_media_id:900004,oxpuro_editorial:{subtitle:'Fixture',photo_credit:'Fixture'}}:{opmx_editorial:{primary_category:9,subtitle:'Fixture'}})}});
const response=d=>({statusCode:200,body:post(d)});
const category={statusCode:200,body:{id:9,slug:'tecnologia'}};
const guards={OPURO:{statusCode:200,body:{status:'reported',postId:'900001'}},OPOL:{statusCode:200,body:{status:'reported',postId:'900002'}}};
const preflight=()=>checkPublicationPreflight(preparePublication(request,receipt),{OPURO:response('OPURO'),OPOL:response('OPOL')},category,guards);
const published=d=>({statusCode:200,body:{...post(d),status:'publish',modified:'2026-11-02T10:00:00',link:'https://cms.example.invalid/?p=1'}});
test('public tool requires explicit publication and stable identity; draft tool stays draft',()=>{
 const list=classifyFileMcp({jsonrpc:'2.0',id:1,method:'tools/list'}).response.result.tools;
 assert.equal(list.find(t=>t.name==='publicar_nota_opmx').annotations.destructiveHint,true);
 assert.equal(list.find(t=>t.name==='publicar_nota_opmx').annotations.openWorldHint,true);
 const a={destino:'OPURO',request_id:request.request_id};
 for(const confirmar_publicacion of [undefined,false,'BORRADOR'])assert.match(classifyFileMcp({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'publicar_nota_opmx',arguments:{...a,confirmar_publicacion}}}).response.error.message,/PUBLICAR/);
 assert.throws(()=>parseMcpMaster(Buffer.from('{"SEO":{"SLUG":"fixture"},"CONTROL_EDITORIAL":{"ESTADO":"PENDIENTE"}}'),request),/aprobado/);
});
test('cannot publish arbitrary IDs, partial drafts, mismatched request or slugs',()=>{
 for(const mutate of [x=>x.status='PARTIAL_SUCCESS',x=>x.request_id='other',x=>x.targets.oxigenopolitico.slug='other',x=>x.post_id_opuro=33,x=>x.targets.oxigenopuro.status='PUBLISHED']){const bad=clone(receipt);mutate(bad);assert.throws(()=>preparePublication(request,bad));}
 assert.throws(()=>preparePublication({...request,confirmar_publicacion:null},receipt));
});
test('both preflights must pass before any publication; category route comes from WordPress',()=>{
 const plan=preflight();assert.equal(plan.targets.OPURO.public_url,'https://oxigenopuro.com.mx/opmx-fixture-no-publicar/');assert.equal(plan.targets.OPOL.public_url,'https://oxigenopolitico.com.mx/tecnologia/opmx-fixture-no-publicar/');
 for(const mutation of [p=>p.status='publish',p=>p.featured_media=0,p=>p.slug='other',p=>p.meta.rank_math_description='',p=>p.content.raw='{{OPMX:HERO_OPURO}}']){const bad=response('OPOL');mutation(bad.body);assert.throws(()=>checkPublicationPreflight(preparePublication(request,receipt),{OPURO:response('OPURO'),OPOL:bad},category,guards));}
 assert.throws(()=>checkPublicationPreflight(preparePublication(request,receipt),{OPURO:response('OPURO'),OPOL:response('OPOL')},{statusCode:200,body:{id:999,slug:'fake'}},guards));
});
test('lost POST response is resolved only by an independent readback; editorial changes fail',()=>{
 let p=recordPublication(preflight(),'OPURO',published('OPURO'));assert.equal(p.targets.OPURO.status,'PUBLISHED');
 const automatic=published('OPURO');automatic.body.meta.rank_math_seo_score=100;assert.equal(recordPublication(preflight(),'OPURO',automatic).targets.OPURO.status,'PUBLISHED');
 const edits=[x=>x.content.raw+='edited',x=>x.author=999,x=>x.meta.rank_math_title='Changed',x=>x.featured_media=19,x=>x.slug='changed'];
 for(const edit of edits){const r=published('OPURO');edit(r.body);assert.equal(recordPublication(preflight(),'OPURO',r).targets.OPURO.status,'UNCERTAIN');}
 assert.equal(recordPublication(preflight(),'OPURO',{error:'timeout'}).targets.OPURO.status,'UNCERTAIN');
 assert.equal(recordPublication(preflight(),'OPURO',response('OPURO')).targets.OPURO.status,'UNCERTAIN');
});
test('CMS publish is separate from public visibility, exact canonical required',()=>{
 let p=recordPublication(preflight(),'OPURO',published('OPURO'));p=recordPublication(p,'OPOL',published('OPOL'));
 assert.equal(summarizePublication(p).status,'SUCCESS');assert.equal(summarizePublication(p).public_visibility_check,'NOT_CHECKED');
 for(const d of p.requested){assert.equal(recordPublicVisibility(p,d,{statusCode:200,body:'<html>404 not found</html>'}).targets[d].public_verified,false);p=recordPublicVisibility(p,d,{statusCode:200,body:`<link rel="canonical" href="${p.targets[d].public_url}">`});}
 const r=summarizePublication(p);assert.equal(r.status,'SUCCESS');assert.equal(r.retryPermitted,false);assert.equal(JSON.stringify(r).includes('content'),false);
});
test('partial and uncertain results never report full success or invite replay',()=>{
 let p=recordPublication(preflight(),'OPURO',published('OPURO'));const r=summarizePublication(p);assert.equal(r.status,'PARTIAL_SUCCESS');assert.equal(r.targets.OPOL.status,'NOT_ATTEMPTED');assert.equal(r.retryPermitted,false);
 assert.equal(summarizePublication(preflight()).status,'UNCERTAIN');
});
test('single destination requests do not require or touch the other destination',()=>{
 const p=checkPublicationPreflight(preparePublication({...request,destino:'OPURO'},receipt),{OPURO:response('OPURO')},undefined,guards);assert.deepEqual(p.requested,['OPURO']);assert.equal(p.targets.OPOL,undefined);
 const q=checkPublicationPreflight(preparePublication({...request,destino:'OPOL'},receipt),{OPOL:response('OPOL')},category,guards);assert.equal(q.targets.OPURO,undefined);
});
test('existing drafts use original IDs bound by guard; already public targets are read only',()=>{
 const input={...request,operation:'publicar_borradores_opmx',slug:'opmx-fixture-no-publicar',post_id_opuro:900001,post_id_opol:900002};
 const p=prepareExistingPublication(input);
 assert.throws(()=>checkPublicationPreflight(p,{OPURO:response('OPURO'),OPOL:response('OPOL')},category,{...guards,OPOL:{statusCode:200,body:{status:'reported',postId:'123'}}}),/Guard/);
 const checked=checkPublicationPreflight(p,{OPURO:published('OPURO'),OPOL:response('OPOL')},category,guards);
 assert.equal(checked.targets.OPURO.status,'PUBLISHED');assert.equal(checked.targets.OPOL.status,'NOT_ATTEMPTED');
 const result=classifyFileMcp({jsonrpc:'2.0',id:9,method:'tools/call',params:{name:'publicar_borradores_opmx',arguments:input}});assert.equal(result.route,'existing-publication');assert.equal(result.request.post_id_opol,900002);
 const missing=clone(input);delete missing.post_id_opol;assert.equal(classifyFileMcp({jsonrpc:'2.0',id:9,method:'tools/call',params:{name:'publicar_borradores_opmx',arguments:missing}}).response.error.code,-32602);
});
