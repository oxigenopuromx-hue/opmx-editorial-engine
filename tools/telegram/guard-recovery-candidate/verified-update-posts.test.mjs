import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readVerifiedUpdatePosts,loadVerifiedUpdateTarget} from './verified-update-posts.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {buildCorrectionPreview} from './correction-preview.mjs';
const packageId='tg_'+'a'.repeat(40),ownerKey='b'.repeat(64),actorKey='c'.repeat(64),revision=12,baseRevision=7,destination='AMBOS',requestId=expectedDraftRequestId({packageId,revision:baseRevision,destination});
const input={packageId,revision,baseRevision,ownerKey,actorKey,destination};
function fixture(){
 const state={barrier:{packageId,revision:baseRevision,writesFenced:true,terminalBlocked:true,noActiveAttempts:true,noPublicationSideEffects:false,allPublicationOutcomesVerified:true},prior:{packageId,revision:baseRevision,ownerKey,requestId,destinations:['OPURO','OPOL'],results:[{destination:'OPURO',status:'PUBLISHED',publicationVerdict:'CMS_RECORD_CONFIRMED',cmsVerified:true,wordpressStatus:'publish',postId:123,slug:'nota-opuro'},{destination:'OPOL',status:'DRAFT',publicationVerdict:'CMS_RECORD_CONFIRMED',cmsVerified:true,wordpressStatus:'draft',postId:456,slug:'nota-opol'}]}};
 const ledger=state.prior.results.map(x=>({destination:x.destination,target_key:createHash('sha256').update(`opmx:v1:${x.destination}:${x.slug}`).digest('hex'),status:'reported',post_id:String(x.postId)}));let reads=0;
 const c={async execute(sql,args){if(sql.includes('FROM opmx_tg_revision_snapshots'))return [[{owner_key:ownerKey,snapshot_json:JSON.stringify(state)}]];if(sql.includes('FROM opmx_mcp_target_progress')){reads++;assert.match(sql,/FOR UPDATE/);return [ledger.filter(x=>x.target_key===args[0]&&args[1]===requestId&&x.destination===args[2])]};throw Error(sql)}};
 return {state,ledger,c,get reads(){return reads}};
}
test('binds IDs to the saved revision, verified CMS observations and locked ledger',async()=>{
 const f=fixture(),out=await readVerifiedUpdatePosts(f.c,input);assert.deepEqual(out,{...input,verified:true,posts:{OPURO:123,OPOL:456},slugs:{OPURO:'nota-opuro',OPOL:'nota-opol'}});assert.equal(f.reads,2);
 assert.deepEqual((await readVerifiedUpdatePosts(f.c,{...input,destination:'OPOL'})).posts,{OPOL:456});
});
test('missing or altered proof and deleted or uncertain posts remain unavailable',async()=>{
 for(const change of [f=>f.state.barrier.writesFenced=false,f=>f.state.barrier.noActiveAttempts=false,f=>f.state.barrier.allPublicationOutcomesVerified=false,f=>f.state.prior.requestId='manual_request',f=>f.state.prior.ownerKey=actorKey,f=>f.state.prior.results[0].cmsVerified=false,f=>f.state.prior.results[0].wordpressStatus='trash',f=>f.state.prior.results[0].publicationVerdict='UNKNOWN',f=>f.state.prior.results[0].postId=0,f=>f.state.prior.results[0].slug='different',f=>f.ledger[0].post_id='999',f=>f.ledger[0].status='writing',f=>f.state.prior.results[1].destination='LIBERAL']){
  const f=fixture();change(f);assert.equal(await readVerifiedUpdatePosts(f.c,input),null);
 }
});
test('unrequested or noncanonical destinations cannot infer a new post ID',async()=>{
 const f=fixture();for(const d of ['TODOS','LIBERAL','OPOL,OPURO'])assert.equal(await readVerifiedUpdatePosts(f.c,{...input,destination:d}),null);
});
test('the confirmed decision and locked ledger alone supply the original slug',async()=>{
 const hash=x=>createHash('sha256').update(x).digest('hex'),owner=hash('opmx:telegram:v1:123:123'),item={itemId:'ti_'+'1'.repeat(40),kind:'TEXT',state:'STORED',text:'texto',sha256:hash('texto')};
 const preview=buildCorrectionPreview({packageId,revision:10,baseRevision:7,ownerKey:owner,actorKey:owner,before:[item],after:[item],action:'UPDATE',mode:'LITERAL',destination:'OPURO',verifiedPosts:{OPURO:123}});
 const eventId='evt_'+'d'.repeat(48),receipt='telegram-123-10-100',priorRequest=expectedDraftRequestId({packageId,revision:7,destination:'OPURO'}),key=hash('opmx:v1:OPURO:nota-real');
 const snap={prior:{packageId,revision:7,ownerKey:owner,requestId:priorRequest,destinations:['OPURO'],results:[{destination:'OPURO',status:'PUBLISHED',publicationVerdict:'CMS_RECORD_CONFIRMED',cmsVerified:true,wordpressStatus:'publish',postId:123,slug:'nota-real'}]},barrier:{packageId,revision:7,writesFenced:true,terminalBlocked:true,noActiveAttempts:true,noPublicationSideEffects:false,allPublicationOutcomesVerified:true}};
 const c={async execute(sql){if(sql.startsWith('SELECT owner_key,state,revision'))return [[{owner_key:owner,state:'READY',revision:11}]];if(sql.startsWith('SELECT preview_hash,decision_json'))return [[{preview_hash:preview.previewHash,decision_json:JSON.stringify(preview)}]];if(sql.startsWith('SELECT owner_key,preview_receipt'))return [[{owner_key:owner,preview_receipt:receipt,confirmation_receipt:'telegram-123-11-101',state:'CONFIRMED',event_id:eventId,preview_json:JSON.stringify(preview)}]];if(sql.startsWith('SELECT event_id FROM opmx_tg_events'))return [[{event_id:eventId}]];if(sql.startsWith('SELECT snapshot_revision'))return [[{snapshot_revision:7,actor_key:owner,close_receipt_key:hash(receipt)}]];if(sql.includes('FROM opmx_tg_revision_snapshots'))return [[{owner_key:owner,snapshot_json:JSON.stringify(snap)}]];if(sql.includes('FROM opmx_mcp_target_progress'))return [[{target_key:key,status:'reported',post_id:'123'}]];throw Error(sql)}};
 const scope={packageId,revision:11,destination:'OPURO',postId:123,previewHash:preview.previewHash,payloadHash:'e'.repeat(64)};
 assert.deepEqual(await loadVerifiedUpdateTarget(c,scope),{...scope,slug:'nota-real'});
 assert.equal(await loadVerifiedUpdateTarget(c,{...scope,postId:124}),null);assert.equal(await loadVerifiedUpdateTarget(c,{...scope,previewHash:'f'.repeat(64)}),null);
 snap.prior.results[0].wordpressStatus='trash';assert.equal(await loadVerifiedUpdateTarget(c,scope),null);
});
