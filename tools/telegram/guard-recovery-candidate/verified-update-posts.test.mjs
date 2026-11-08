import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readVerifiedUpdatePosts} from './verified-update-posts.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
const packageId='tg_'+'a'.repeat(40),ownerKey='b'.repeat(64),actorKey='c'.repeat(64),revision=12,baseRevision=7,destination='AMBOS',requestId=expectedDraftRequestId({packageId,revision:baseRevision,destination});
const input={packageId,revision,baseRevision,ownerKey,actorKey,destination};
function fixture(){
 const state={barrier:{packageId,revision:baseRevision,writesFenced:true,terminalBlocked:true,noActiveAttempts:true,noPublicationSideEffects:false,allPublicationOutcomesVerified:true},prior:{packageId,revision:baseRevision,ownerKey,requestId,destinations:['OPURO','OPOL'],results:[{destination:'OPURO',status:'PUBLISHED',publicationVerdict:'CMS_RECORD_CONFIRMED',cmsVerified:true,wordpressStatus:'publish',postId:123,slug:'nota-opuro'},{destination:'OPOL',status:'DRAFT',publicationVerdict:'CMS_RECORD_CONFIRMED',cmsVerified:true,wordpressStatus:'draft',postId:456,slug:'nota-opol'}]}};
 const ledger=state.prior.results.map(x=>({destination:x.destination,target_key:createHash('sha256').update(`opmx:v1:${x.destination}:${x.slug}`).digest('hex'),status:'reported',post_id:String(x.postId)}));let reads=0;
 const c={async execute(sql,args){if(sql.includes('FROM opmx_tg_revision_snapshots'))return [[{owner_key:ownerKey,snapshot_json:JSON.stringify(state)}]];if(sql.includes('FROM opmx_mcp_target_progress')){reads++;assert.match(sql,/FOR UPDATE/);return [ledger.filter(x=>x.target_key===args[0]&&args[1]===requestId&&x.destination===args[2])]};throw Error(sql)}};
 return {state,ledger,c,get reads(){return reads}};
}
test('binds IDs to the saved revision, verified CMS observations and locked ledger',async()=>{
 const f=fixture(),out=await readVerifiedUpdatePosts(f.c,input);assert.deepEqual(out,{...input,verified:true,posts:{OPURO:123,OPOL:456}});assert.equal(f.reads,2);
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
