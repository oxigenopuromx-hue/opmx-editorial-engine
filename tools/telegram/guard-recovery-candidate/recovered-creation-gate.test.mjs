import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecoveredCreationGate} from './recovered-creation-gate.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
const packageId='tg_'+'a'.repeat(40),revision=9;
const input={requestId:expectedDraftRequestId({packageId,revision,destination:'OPURO'}),destination:'OPURO'};
const payload={title:'Título original que no se reescribe',subtitle:'Primer subtítulo.\nSegundo subtítulo.',html:'<p>Cuerpo original.</p>',gutenberg:'<!-- wp:paragraph --><p>Cuerpo original.</p><!-- /wp:paragraph -->',enriched:'<!-- wp:paragraph --><p>Cuerpo original.</p><!-- /wp:paragraph -->'};
function fixture(options={}){
 let calls=0,commits=0,rollbacks=0;const cmsCalls=[];
 const destination=options.destination??'OPURO';
 const c={async beginTransaction(){},async commit(){commits++},async rollback(){rollbacks++},release(){},async execute(sql){calls++;if(sql.startsWith('SELECT b.package_id'))return [options.rows??[{package_id:packageId,revision,state:'READY',current_revision:revision}]];if(sql.startsWith('SELECT decision_json'))return [options.saved??[]];throw Error('Unexpected SQL: '+sql)}};
 const scope={packageId,revision,contentMode:options.literal?'LITERAL':'EDITORIAL',destination,previewHash:null,...options.scope};
 const proof={packageId,revision,destination,requestId:expectedDraftRequestId({packageId,revision,destination}),mode:'LITERAL',payload,...options.proof};
 const dependencies={pool:{getConnection:async()=>c},readDecision:async()=>options.decision??{action:'CREATE',destination},readScope:async()=>options.scopeThrows?Promise.reject(Error('scope failed')):scope,readLiteralProof:async()=>options.noProof?null:proof};
 if(options.cms)dependencies.readWordPress=async target=>{cmsCalls.push(target);return options.cms(target)};
 return {gate:createRecoveredCreationGate(dependencies),calls:()=>calls,commits:()=>commits,rollbacks:()=>rollbacks,cmsCalls};
}
test('ordinary and historical requests retain their existing downstream guard',async()=>{
 const f=fixture();assert.equal(await f.gate(input),true);assert.equal(await f.gate({requestId:'other-legacy-request'}),true);assert.equal(f.calls(),2);assert.equal(await fixture({rows:[]}).gate(input),true);
});
test('an UPDATE decision cannot enter any creation, media or publication writer',async()=>{assert.equal(await fixture({saved:[{decision_json:'{"action":"UPDATE"}'}]}).gate(input),false)});
test('a recovered creation is limited to the exact confirmed destination label',async()=>{
 const f=fixture({saved:[{decision_json:'{"action":"CREATE"}'}]});assert.equal(await f.gate(input),true);assert.equal(await f.gate({...input,destination:'LIBERAL'}),false);assert.equal(await f.gate({...input,requestId:expectedDraftRequestId({packageId,revision,destination:'TODOS'})}),false);
});
test('stale, malformed, ambiguous or unconfirmed decisions fail closed',async()=>{
 for(const options of [{rows:[{package_id:packageId,revision,state:'OPEN',current_revision:revision+1}]},{saved:[{decision_json:'bad'}]},{saved:[{decision_json:'{}'}]},{saved:[{decision_json:'{"action":"CREATE"}'}],decision:{action:'UPDATE',destination:'OPURO'}},{saved:[{decision_json:'{}'},{decision_json:'{}'}]},{scopeThrows:true},{scope:{packageId:'other'}},{scope:{revision:8}},{scope:{contentMode:'AUTO'}}])assert.equal(await fixture(options).gate(input),false);
});
test('literal media and creation require exact immutable proof without inventing a CMS post',async()=>{
 const f=fixture({literal:true});assert.equal(await f.gate(input),true);assert.equal(f.cmsCalls.length,0);assert.equal(f.commits(),1);
 assert.equal(await fixture({literal:true,noProof:true}).gate(input),false);
 assert.equal(await fixture({literal:true,proof:{requestId:'tg_'+'0'.repeat(64)}}).gate(input),false);
 assert.equal(await fixture({literal:true,proof:{mode:'EDITORIAL'}}).gate(input),false);
 assert.equal(await fixture({literal:true,proof:{payload:null}}).gate(input),false);
 assert.equal(await fixture({literal:true,destination:'TODOS'}).gate(input),false);
 assert.equal(await fixture({literal:true}).gate({...input,destination:'LIBERAL'}),false);
});
const sites=['OPURO','OPOL','LIBERAL'],metaKeys={OPURO:'oxpuro_editorial',OPOL:'opmx_editorial',LIBERAL:'liberalmx_editorial'};
const targets=sites.map((destination,i)=>({destination,postId:100+i}));
const publish={requestId:expectedDraftRequestId({packageId,revision,destination:'TODOS'}),slug:'nota-original',targets};
function cms(target){
 return {statusCode:200,post:{id:target.postId,type:'post',slug:publish.slug,status:'draft',title:{raw:payload.title},content:{raw:target.destination==='OPOL'?payload.gutenberg:payload.enriched},meta:{[metaKeys[target.destination]]:{subtitle:'Primer subtítulo. Segundo subtítulo.'}}}};
}
test('literal publication verifies every already-created CMS target before any publish permit',async()=>{
 const f=fixture({literal:true,destination:'TODOS',cms});assert.equal(await f.gate(publish),true);assert.deepEqual(f.cmsCalls,targets);assert.equal(f.commits(),1);
});
test('literal publication has no permissive CMS-read default',async()=>{
 const f=fixture({literal:true,destination:'TODOS'});assert.equal(await f.gate(publish),false);assert.equal(f.commits(),0);assert.equal(f.rollbacks(),1);
});
for(const [label,change] of [
 ['changed body',p=>p.content.raw='<!-- wp:paragraph --><p>Contenido alterado.</p><!-- /wp:paragraph -->'],['added summary',p=>p.content.raw+='<!-- wp:paragraph --><p>En breve añadido.</p><!-- /wp:paragraph -->'],['unsafe invisible text',p=>p.content.raw+='<span hidden>Extra</span>'],['truncated title',p=>p.title.raw=p.title.raw.slice(0,10)],['changed title punctuation',p=>p.title.raw+='!'],['missing subtitle',p=>p.meta={}],['changed subtitle',p=>{p.meta[metaKeys.OPOL].subtitle='Subtítulo distinto.'}],['wrong post ID',p=>p.id++],['wrong slug',p=>p.slug='otra-nota'],['trash status',p=>p.status='trash'],['wrong object type',p=>p.type='page'],['no raw body',p=>p.content={rendered:p.content.raw}]
])test('literal publication rejects '+label+' in any selected destination',async()=>{
 const f=fixture({literal:true,destination:'TODOS',cms:target=>{const r=cms(target);if(target.destination==='OPOL')change(r.post);return r}});assert.equal(await f.gate(publish),false);assert.equal(f.commits(),0);
});
test('all selected identities remain required even when some destinations already publish',async()=>{
 const f=fixture({literal:true,destination:'TODOS',cms:target=>{const r=cms(target);r.post.status='publish';return r}});assert.equal(await f.gate(publish),true);assert.equal(f.cmsCalls.length,3);
});
test('normalization accepts only presentation whitespaces and safe equivalent formatting',async()=>{
 const f=fixture({literal:true,destination:'TODOS',cms:target=>{const r=cms(target);r.post.title.raw='  '+payload.title+'  ';r.post.content.raw='<!-- wp:paragraph -->\n<p><strong>Cuerpo</strong>\n original.</p>\n<!-- /wp:paragraph -->';return r}});assert.equal(await f.gate(publish),true);
});
test('failed, thrown and incomplete CMS observations preserve the publication block',async()=>{
 for(const get of [()=>null,()=>({statusCode:503}),()=>{throw Error('CMS unavailable')}])assert.equal(await fixture({literal:true,destination:'TODOS',cms:get}).gate(publish),false);
});
test('publication target IDs and destination set cannot be supplied ambiguously',async()=>{
 for(const request of [{...publish,targets:publish.targets.slice(0,2)},{...publish,targets:[targets[0],targets[0],targets[2]]},{...publish,targets:[...targets,{destination:'OTHER',postId:1}]},{...publish,targets:targets.map(t=>({...t,postId:String(t.postId)}))},{...publish,targets:targets.map(t=>({...t,url:'https://attacker.invalid'}))},{...publish,targets:null},{...publish,slug:'../other'}])assert.equal(await fixture({literal:true,destination:'TODOS',cms}).gate(request),false);
});
