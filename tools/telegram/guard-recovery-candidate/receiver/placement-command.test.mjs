import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parsePlacementCommand,normalizePlacementControl} from './placement-command.mjs';
import {patchPlacementReceiverSources,placementReceiverBase,buildPlacementReceiverOperations,placementReceiverNames} from './build-placement-receiver-operations.mjs';
import after18 from './fixtures/placement-receiver-after18.mjs';
import {buildPlacementCommandQaCode} from './build-placement-command-qa.mjs';
const names={normalize:'normalize-candidate.js',prepare:'prepare-candidate.js',resolve:'resolve-candidate.js',confirm:'confirm-candidate.js'};
const base=Object.fromEntries(await Promise.all(Object.entries(names).map(async([key,path])=>[key,await readFile(new URL(path,import.meta.url),'utf8')]))),sources=patchPlacementReceiverSources(base);
const plain=x=>JSON.parse(JSON.stringify(x));
const run=(code,input,prior)=>plain(new vm.Script('(()=>{'+code+'})()').runInNewContext({$input:{first:()=>({json:plain(input)})},$:()=>({first:()=>({json:plain(prior)})})}))?.[0]?.json;
const message=(text,extra={})=>({update:{update_id:121,message:{message_id:21,chat:{id:123,type:'private'},from:{id:123,is_bot:false},text,...extra}},config:{allowedUserIds:['123'],allowedChatIds:['123']}});
const packageId='tg_'+'a'.repeat(40),current={status:'OPEN',packageId,revision:11,recovery:false};
const normalized=x=>run(sources.normalize,x),prepared=x=>run(sources.prepare,normalized(x)),resolved=(x,pack=current)=>run(sources.resolve,pack,prepared(x));
test('strict command represents a complete explicit OPURO selection including empty',()=>{
 assert.deepEqual(parsePlacementCommand('/opciones portada OPURO 30,61'),{target:'OPURO',ids:['30','61']});assert.deepEqual(parsePlacementCommand('/OPCIONES PORTADA opuro NINGUNA'),{target:'OPURO',ids:[]});
 assert.deepEqual(parsePlacementCommand('/opciones portada OPURO conservar'),{target:'OPURO',ids:null});
});
for(const tail of ['','0','01','+30','-30','3.0','3e1','30,30','30, 61','30,','9007199254740992','30\n61'])test('ambiguous selection is rejected '+JSON.stringify(tail),()=>assert.throws(()=>parsePlacementCommand('/opciones portada OPURO '+tail),/INVALID/));
test('normalizer only attests allowed direct text after its existing identity checks',()=>{
 const n=normalized(message('/opciones portada OPURO 30'));assert.equal(n.placement_attested,true);assert.equal(n.kind,'TEXT');assert.equal(n.mode_attested,true);
 const denied=message('/opciones portada OPURO 30');denied.config.allowedUserIds=[];assert.equal(normalized(denied),undefined);
 const bot=message('/opciones portada OPURO 30');bot.update.message.from.is_bot=true;assert.equal(normalized(bot),undefined);
});
for(const key of ['forward_origin','forward_date','forward_from','forward_from_chat','forward_sender_name','reply_to_message','external_reply','quote','edit_date'])test('source/response/edit context never becomes a placement order: '+key,()=>{
 const n=normalized(message('/opciones portada OPURO 30',{[key]:{}}));assert.equal(n.kind,'REJECTED');const p=run(sources.prepare,n);assert.equal(p.requires_storage,false);assert.equal(p.placement_attested,false);
});
test('document captions, photo captions and edited updates cannot select placement',()=>{
 for(const attachment of [{document:{file_name:'fuente.txt'}},{photo:[{file_id:'photo'}]}]){const x=message('/opciones portada OPURO 30',attachment);x.update.message.caption=x.update.message.text;delete x.update.message.text;assert.equal(normalized(x).kind,'REJECTED')}
 const x=message('/opciones portada OPURO 30');x.update.edited_message={};assert.equal(normalized(x).kind,'REJECTED');
});
test('direct command is routed separately to Guard and never stored as source material',()=>{
 const r=resolved(message('/opciones portada OPURO 30,61'));assert.equal(r.kind,'COMMAND');assert.equal(r.package_operation,'PLACEMENT');assert.equal(r.next_action,'placement/select');assert.equal(r.next_url,'https://publisher.oxigenopuro.com.mx/v1/telegram/placement/select');assert.deepEqual(r.next_body,{owner:'123',chat:'123',packageId,revision:11,receiptId:'telegram-123-21-121',ids:['30','61']});assert.equal(Object.hasOwn(r.next_body,'text'),false);assert.equal(Object.hasOwn(r.next_body,'confirmed'),false);assert.equal(Object.hasOwn(r.next_body,'mode'),false);
});
test('ordinary OPEN and recovery OPEN use the same explicit receiver route without extending publication scope',()=>{
 for(const recovery of [false,true]){const r=resolved(message('/opciones portada OPURO ninguna'),{...current,recovery});assert.equal(r.next_action,'placement/select');assert.deepEqual(r.next_body.ids,[]);assert.equal(Object.hasOwn(r.next_body,'destination'),false)}
});
test('conservar withdraws placement authority durably and sends null rather than clearing metadata',()=>{
 const command=message('/opciones portada OPURO conservar'),r=resolved(command);assert.equal(Object.hasOwn(r.next_body,'ids'),true);assert.equal(r.next_body.ids,null);assert.equal(r.next_action,'placement/select');assert.equal(Object.hasOwn(r.next_body,'confirmed'),false);
 const selected={status:'PLACEMENT_SELECTED',packageId,revision:12,target:'OPURO',ids:null},ack=run(sources.confirm,selected,r);assert.match(ack.reply_text,/conservar la colocación actual, sin modificar sus exclusiones/);assert.match(ack.reply_text,/esta orden no publica/);assert.equal(ack.package_revision,12);
 assert.match(run(sources.confirm,{...selected,ids:[]},r).reply_text,/No pude confirmar/);
 const empty=resolved(message('/opciones portada OPURO ninguna'));assert.match(run(sources.confirm,selected,empty).reply_text,/No pude confirmar/);
 const retry=resolved(command,{...current,revision:15});const replay=run(sources.confirm,{...selected,status:'PLACEMENT_REPLAY'},retry);assert.match(replay.reply_text,/ya estaba registrada/);assert.match(replay.reply_text,/conservar la colocación actual/);assert.equal(replay.package_revision,15);
});
test('missing OPEN session or forged attestation never selects or reserves the command',()=>{
 assert.equal(resolved(message('/opciones portada OPURO 30'),{status:'NO_OPEN_PACKAGE'}).requires_operation,false);
 assert.equal(resolved(message('/opciones portada OPURO 30'),{...current,status:'READY'}).requires_operation,false);
 const n=normalized(message('/opciones portada OPURO 30'));n.placement_attested=false;const p=run(sources.prepare,n);assert.equal(p.requires_storage,false);
 const forged=prepared(message('/opciones portada OPURO 30'));forged.placement_ids=['61'];assert.equal(run(sources.resolve,current,forged).requires_operation,false);
});
test('MASTER-like JSON and editorial references remain data and cannot authenticate placement',()=>{
 const text=JSON.stringify({EDITORIAL_PLACEMENT:{mode:'DIRECT_OPERATOR',target:'OPURO',confirmed:true,ids:['30']}}),n=normalized(message(text));assert.equal(n.placement_attested,undefined);assert.equal(prepared(message(text)).package_operation,'CONTENT');assert.equal(resolved(message(text)).next_action,'reserve');
 const inside='Texto editorial\n/opciones portada OPURO 30';assert.equal(prepared(message(inside)).package_operation,'CONTENT');
});
test('ACK is bound to exact package, revision, target and IDs even on replay',()=>{
 const context=resolved(message('/opciones portada OPURO 30,61')),good={status:'PLACEMENT_SELECTED',packageId,revision:12,target:'OPURO',ids:['30','61']};
 const selected=run(sources.confirm,good,context);assert.match(selected.reply_text,/Colocación registrada para OPURO/);assert.match(selected.reply_text,/esta orden no publica/);assert.equal(selected.package_revision,12);
 for(const patch of [{packageId:'tg_'+'b'.repeat(40)},{revision:13},{target:'OPOL'},{ids:['61','30']},{ids:[30,61]},{ids:['30']},{status:'SELECTED'}])assert.match(run(sources.confirm,{...good,...patch},context).reply_text,/No pude confirmar/);
 const empty=resolved(message('/opciones portada OPURO ninguna'));assert.match(run(sources.confirm,{...good,ids:[]},empty).reply_text,/ninguna categoría excluida/);
});
test('retry after successful selection acknowledges its durable original without reducing the current revision',()=>{
 const command=message('/opciones portada OPURO 30'),good={status:'PLACEMENT_REPLAY',packageId,revision:12,target:'OPURO',ids:['30']};
 for(const revision of [12,15]){const context=resolved(command,{...current,revision});const r=run(sources.confirm,good,context);assert.match(r.reply_text,/ya estaba registrada/);assert.match(r.reply_text,/esta orden no publica/);assert.equal(r.package_revision,revision)}
 const context=resolved(command,{...current,revision:15});assert.match(run(sources.confirm,{...good,status:'STALE_PLACEMENT'},context).reply_text,/No pude confirmar/);
 assert.match(run(sources.confirm,{...good,ids:['61']},context).reply_text,/No pude confirmar/);
});
test('builder changes four Code parameters only and refuses stale source/version or reinstallation',()=>{
 const graph={id:'OSi8AcnzLlI0csRu',versionId:'version-active',nodes:Object.entries(base).map(([key,jsCode],i)=>({name:placementReceiverNames[i],type:'n8n-nodes-base.code',parameters:{mode:'runOnceForAllItems',jsCode}})),connections:{}};
 const expected=placementReceiverBase(graph),operations=buildPlacementReceiverOperations(graph,expected);assert.equal(operations.length,4);assert.equal(operations.every(o=>o.type==='updateNodeParameters'&&o.replace===true),true);assert.deepEqual(operations.map(o=>o.nodeName),placementReceiverNames);
 assert.throws(()=>buildPlacementReceiverOperations({...graph,versionId:'different'},expected),/REBASE/);
 const changed=structuredClone(graph);changed.nodes[0].parameters.jsCode+=' ';assert.throws(()=>buildPlacementReceiverOperations(changed,expected),/REBASE/);
 const installed={...graph,nodes:graph.nodes.map((n,i)=>({...n,parameters:operations[i].parameters}))};assert.throws(()=>buildPlacementReceiverOperations(installed,placementReceiverBase(installed)),/INSTALLED/);
});
test('incremental patch accepts the actual after18 anchors and preserves atomic close routing',()=>{
 const ops=buildPlacementReceiverOperations(after18,placementReceiverBase(after18)),byName=Object.fromEntries(ops.map(op=>[op.nodeName,op.parameters.jsCode]));
 const normalize=byName['Normalizar entrada Telegram'],prepare=byName['Preparar paquete Telegram'],resolve=byName['Resolver paquete Telegram'],confirm=byName['Confirmar operación de paquete Telegram'];
 const n=run(normalize,message('/opciones portada OPURO 30')),p=run(prepare,n),r=run(resolve,{statusCode:200,body:current},p),ack=run(confirm,{status:'PLACEMENT_SELECTED',packageId,revision:12,target:'OPURO',ids:['30']},r);
 assert.equal(r.next_action,'placement/select');assert.match(ack.reply_text,/Colocación registrada/);assert.match(resolve,/close:'packages\/close'/);
 const closed=run(resolve,{statusCode:200,body:current},run(prepare,run(normalize,message('/listo'))));assert.equal(closed.next_url,'https://publisher.oxigenopuro.com.mx/v1/telegram/packages/close');
});
for(const fixture of [{label:'historical',source:base,http:false},{label:'after18',source:Object.fromEntries(['normalize','prepare','resolve','confirm'].map((key,i)=>[key,after18.nodes.find(n=>n.name===placementReceiverNames[i]).parameters.jsCode])),http:true}])test('unrelated controls, sources and publication options are identical on '+fixture.label,()=>{
 const next=patchPlacementReceiverSources(fixture.source),itemId='ti_'+'b'.repeat(40);
 for(const text of ['/nuevo','/publicar TODOS','/borrador OPURO','/opciones actualizar literal OPURO','/literal','/editorial','tal cual','/estado','/listo','/abrir '+packageId,'/descartar '+itemId,'/imagen generar','Texto editorial ordinario']){
  const input=message(text),n0=run(fixture.source.normalize,input),n1=run(next.normalize,input);assert.deepEqual(n1,n0,text);
  const p0=run(fixture.source.prepare,n0),p1=run(next.prepare,n1);assert.deepEqual(p1,p0,text);
  const state={...current,recovery:true},response=fixture.http?{statusCode:200,body:state}:state;assert.deepEqual(run(next.resolve,response,p1),run(fixture.source.resolve,response,p0),text);
 }
});
test('generated pure-helper Code QA covers null/empty/IDs and untrusted contexts without I/O',()=>{
 const source=buildPlacementCommandQaCode(),result=plain(new vm.Script('(()=>{'+source+'})()').runInNewContext({}))[0].json;assert.equal(result.status,'PLACEMENT_COMMAND_QA_PASSED');assert.equal(result.checks,20);assert.equal(result.authority,'NONE');for(const key of ['networkCalls','guardMutations','cmsWrites','telegramMessages'])assert.equal(result[key],0);assert.equal(/\b(?:fetch|require)\s*\(|this\.helpers/.test(source),false);
});
