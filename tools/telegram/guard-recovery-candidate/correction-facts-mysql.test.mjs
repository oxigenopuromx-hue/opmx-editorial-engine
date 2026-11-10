import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCorrectionFactsReader} from './correction-facts-mysql.mjs';
import {buildCorrectionPreview} from './correction-preview.mjs';
import {readVerifiedUpdatePosts} from './verified-update-posts.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
const digest=x=>createHash('sha256').update(x).digest('hex');
const packageId='tg_'+'a'.repeat(40),ownerKey='b'.repeat(64),revision=12,baseRevision=7;
const prefix='OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d\n';
function item(n,text,actor=null){return {itemId:'ti_'+String(n).repeat(40),ownerKey,receiptKey:digest('receipt'+n),fingerprint:digest('fingerprint'+n),kind:'TEXT',state:'STORED',text,attachment:null,reservedBytes:Buffer.byteLength(text),contentBytes:Buffer.byteLength(text),sha256:digest(text),actorKey:actor}}
function setup(){
 const old=[item(1,prefix+'/nuevo\n'+JSON.stringify({policy:'publish-todos-v2',package_id:packageId,message_id:1,notice_message_id:2})),item(2,'Material original'),item(3,prefix+'/listo\n'+JSON.stringify({policy:'publish-todos-v2',package_id:packageId,message_id:3}))];
 const close=item(5,prefix+'/listo\n'+JSON.stringify({policy:'publish-todos-v2',package_id:packageId,message_id:5}),ownerKey);
 const s={lease:{actor_key:ownerKey,owner_key:ownerKey,opening_revision:8},session:packageId,snapshot:{prior:{packageId,ownerKey,revision:baseRevision,destinations:['OPURO'],results:[{destination:'OPURO',status:'BLOCKED',publicationVerdict:'NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'}],authorization:{mode:'PUBLISH',authorized:true,explicit:true,authorization:'DIRECT_MODE_COMMAND'},controls:[old[0].itemId,old[2].itemId]},items:structuredClone(old)},items:[...structuredClone(old),item(4,'Aclaración',ownerKey),close],selection:{packageId,revision,ownerKey,action:'CREATE',mode:'LITERAL',destination:'LIBERAL'}};
 const c={async execute(sql){if(sql.includes('FROM opmx_tg_recovery_leases'))return [[s.lease]];if(sql.includes('FROM opmx_tg_sessions'))return [[{package_id:s.session}]];if(sql.includes('FROM opmx_tg_revision_snapshots'))return [[{owner_key:ownerKey,snapshot_json:JSON.stringify(s.snapshot)}]];if(sql.includes('FROM opmx_tg_items'))return [s.items.map(x=>({item_id:x.itemId,owner_key:x.ownerKey,receipt_key:x.receiptKey,fingerprint:x.fingerprint,kind:x.kind,state:x.state,text_content:x.text,attachment_json:x.attachment?JSON.stringify(x.attachment):null,reserved_bytes:x.reservedBytes,content_bytes:x.contentBytes,sha256:x.sha256,actor_key:x.actorKey}))];throw Error(sql)}};
 return {s,c,read:createCorrectionFactsReader({readLockedSelection:async()=>s.selection})};
}
test('locked guard records produce a preview using the separately authenticated selection',async()=>{
 const {read,c}=setup(),facts=await read(c,{packageId,revision,ownerKey});const preview=buildCorrectionPreview({...facts,packageId,revision,ownerKey,actorKey:ownerKey});assert.equal(preview.destination,'LIBERAL');assert.equal(preview.mode,'LITERAL');assert.equal(preview.changes[0].text,'Aclaración');
});
test('administrator facts require the active lease and retain the original owner',async()=>{
 const {s,c,read}=setup(),actorKey='c'.repeat(64);
 s.lease.actor_key=actorKey;s.items[3].actorKey=actorKey;s.items[4].actorKey=actorKey;
 const facts=await read(c,{packageId,revision,ownerKey,actorKey});
 const preview=buildCorrectionPreview({...facts,packageId,revision,ownerKey,actorKey});
 assert.equal(preview.ownerKey,ownerKey);assert.equal(preview.actorKey,actorKey);
 await assert.rejects(()=>read(c,{packageId,revision,ownerKey,actorKey:'d'.repeat(64)}),/CORRECTION_FACTS_UNCONFIRMED/);
});
test('file metadata and caption are taken from the locked inventory',async()=>{
 const {s,c,read}=setup(),file={...item(6,'Foto: fuente del evento',ownerKey),kind:'FILE',attachment:{file_name:'evento.jpg',mime_type:'image/jpeg'}};
 s.items.splice(s.items.length-1,0,file);const facts=await read(c,{packageId,revision,ownerKey});
 const p=buildCorrectionPreview({...facts,packageId,revision,ownerKey,actorKey:ownerKey});
 assert.equal(p.materials.find(x=>x.itemId===file.itemId).caption,file.text);assert.equal(p.materials.find(x=>x.itemId===file.itemId).fileName,'evento.jpg');
 file.attachment=null;await assert.rejects(()=>read(c,{packageId,revision,ownerKey}),/CORRECTION_FACTS_UNCONFIRMED/);
});
test('incorrect lease, session, material, selection or pending files fail closed',async()=>{
 for(const change of [s=>s.lease.actor_key='c'.repeat(64),s=>s.session='tg_'+'c'.repeat(40),s=>s.items[1].text='Alterado',s=>s.items[3].state='PENDING',s=>s.selection.revision--,s=>s.selection.action='UPDATE',s=>s.selection.destination='LIBERAL,OPOL']){
  const {s,c,read}=setup();change(s);await assert.rejects(()=>read(c,{packageId,revision,ownerKey}),/CORRECTION_FACTS_UNCONFIRMED/);
 }
});
test('update preview requires server-verified IDs bound to the exact revision and actor',async()=>{
 const {s,c}=setup();s.selection.action='UPDATE';s.selection.destination='AMBOS';
 const input={packageId,revision,ownerKey,actorKey:ownerKey};
 let evidence={...input,baseRevision,destination:'AMBOS',verified:true,posts:{OPURO:123,OPOL:456}};
 const read=createCorrectionFactsReader({readLockedSelection:async()=>s.selection,readVerifiedUpdatePosts:async()=>evidence});
 const facts=await read(c,input),preview=buildCorrectionPreview({...facts,...input});
 assert.equal(preview.action,'UPDATE');assert.deepEqual(preview.posts,[{destination:'OPURO',postId:123},{destination:'OPOL',postId:456}]);
 for(const bad of [{...evidence,revision:revision-1},{...evidence,baseRevision:baseRevision-1},{...evidence,actorKey:'c'.repeat(64)},{...evidence,verified:false},{...evidence,posts:{OPURO:123}},{...evidence,posts:{OPURO:123,OPOL:0}},{...evidence,posts:{OPURO:123,OPOL:456,LIBERAL:9}}]){
  evidence=bad;await assert.rejects(()=>read(c,input),/CORRECTION_FACTS_UNCONFIRMED/);
 }
});
test('creation cannot proceed if any previous result is published or uncertain',async()=>{
 for(const results of [[],[{destination:'OPURO',status:'PUBLISHED',publicationVerdict:'CMS_RECORD_CONFIRMED'}],[{destination:'OPURO',status:'BLOCKED',publicationVerdict:'UNKNOWN'}]]){
  const {s,c,read}=setup();s.snapshot.prior.results=results;await assert.rejects(()=>read(c,{packageId,revision,ownerKey}),/CORRECTION_FACTS_UNCONFIRMED/);
 }
});
test('the snapshot and target ledger feed the exact ID into an update preview',async()=>{
 const {s,c}=setup(),requestId=expectedDraftRequestId({packageId,revision:baseRevision,destination:'OPURO'}),key=digest('opmx:v1:OPURO:nota-original');
 s.snapshot.prior.requestId=requestId;s.snapshot.prior.results=[{destination:'OPURO',status:'PUBLISHED',publicationVerdict:'CMS_RECORD_CONFIRMED',cmsVerified:true,wordpressStatus:'publish',postId:321,slug:'nota-original'}];
 s.snapshot.barrier={packageId,revision:baseRevision,writesFenced:true,terminalBlocked:true,noActiveAttempts:true,noPublicationSideEffects:false,allPublicationOutcomesVerified:true};
 s.selection.action='UPDATE';s.selection.destination='OPURO';const execute=c.execute.bind(c);
 c.execute=async(sql,args)=>sql.includes('FROM opmx_mcp_target_progress')?[[{target_key:key,status:'reported',post_id:'321'}]]:execute(sql,args);
 const read=createCorrectionFactsReader({readLockedSelection:async()=>s.selection,readVerifiedUpdatePosts});
 const facts=await read(c,{packageId,revision,ownerKey,actorKey:ownerKey}),preview=buildCorrectionPreview({...facts,packageId,revision,ownerKey,actorKey:ownerKey});
 assert.equal(preview.action,'UPDATE');assert.deepEqual(preview.posts,[{destination:'OPURO',postId:321}]);
 s.selection.action='CREATE';await assert.rejects(()=>read(c,{packageId,revision,ownerKey,actorKey:ownerKey}),/CORRECTION_FACTS_UNCONFIRMED/);
});

test('a missing generated payload yields only a bound generation scope',async()=>{
 const {s,c}=setup();s.selection.action='UPDATE';s.selection.destination='OPURO';
 const read=createCorrectionFactsReader({readLockedSelection:async()=>s.selection,readVerifiedUpdatePosts:async(c,scope)=>({...scope,verified:true,posts:{OPURO:123}}),readFinalPayloads:async()=>null});
 assert.deepEqual(await read(c,{packageId,revision,ownerKey,actorKey:ownerKey}),{previewGenerationRequired:true,previewScope:{packageId,revision,baseRevision,ownerKey,actorKey:ownerKey,destination:'OPURO'}});
});
