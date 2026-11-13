import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalUpdateValue} from './canonical-json.mjs';
import {createDestinationCancellationEnforcement} from './destination-cancellation-enforcement.mjs';
const packageId='tg_00991fbbd87a751fb8513f4d4f6fcebca8469bee',requestId='tg_e6400942bcd85878aaa03f722f03b7644261071d6339593c2dede692f582edbf';
function tombstone(destination){
 const slug='simey-olvera-innovacion-tecnologica-reducir-desigualdades',eventId='evt_'+'a'.repeat(48),actorKey='b'.repeat(64),ownerKey='c'.repeat(64),operationId='requested-20261113-issue29-simey-liberal';
 const e={schema:'opmx.destination-cancellation.v1',packageId,revision:10,requestId,destination:'LIBERAL',postId:393,operationId,eventId,actorKey,ownerKey,results:[['OPURO',10493],['OPOL',3515],['LIBERAL',393]].map(([destination,postId],i)=>({destination,postId,originalSlug:slug,slug:i<2?slug:slug+'__trashed',status:i<2?'PUBLISHED':'TRASH',wordpressStatus:i<2?'publish':'trash',cmsVerified:true,publicationVerdict:'CMS_RECORD_CONFIRMED'})),observedAt:'2026-11-13T15:00:00.000Z',writerRelease:'opmx.fenced-writer-release.v1',processTerminationClaimed:false};
 const evidence_json=canonicalUpdateValue(e),evidence_hash=createHash('sha256').update(evidence_json).digest('hex');
 return {package_id:packageId,revision:10,request_id:requestId,destination,post_id:393,operation_id:operationId,event_id:eventId,actor_key:actorKey,owner_key:ownerKey,evidence_json,evidence_hash};
}
function fixture({cancelled=['LIBERAL'],choice=null,binding=packageId,fail=false,corruptHash=false}={}){
 const queries=[];let released=0;
 const pool={async getConnection(){if(fail)throw Error('DB_UNAVAILABLE');return {async execute(sql,args){queries.push({sql,args});if(sql.includes('request_binding'))return [[{package_id:binding}]];if(sql.includes('destination_cancellations'))return [cancelled.map(destination=>({...tombstone(destination),...(corruptHash?{evidence_hash:'0'.repeat(64)}:{})}))];if(sql.includes('correction_selections'))return [choice?[{destination:choice}]:[]];throw Error('UNEXPECTED_QUERY')},release(){released++}}}};
 return {allow:createDestinationCancellationEnforcement({pool}),queries,get released(){return released}};
}
test('cancelled destination cannot create media/posts or start publication under any later revision',async()=>{
 const f=fixture();
 for(const path of ['/v1/targets/begin','/v1/media/begin','/v1/telegram/publications/begin','/v1/telegram/submissions/begin','/v1/telegram/updates/execute'])assert.equal(await f.allow(path,{packageId,requestId,destination:'TODOS',revision:90}),false);
 assert.equal(f.queries.every(x=>x.sql.startsWith('SELECT ')),true);
});
test('other destinations remain available only to their existing underlying gates',async()=>{
 const f=fixture();assert.equal(await f.allow('/v1/targets/begin',{requestId,destination:'OPURO'}),true);assert.equal(await f.allow('/v1/telegram/corrections/select',{packageId,destination:'AMBOS'}),true);assert.equal(await f.allow('/v1/telegram/corrections/select',{packageId,destination:'OPOL,LIBERAL'}),false);
});
test('inherited selection does not revive a cancelled delivery; explicit current choice may exclude it',async()=>{
 assert.equal(await fixture().allow('/v1/telegram/corrections/preview',{packageId}),false);
 assert.equal(await fixture({choice:'TODOS'}).allow('/v1/telegram/corrections/preview',{packageId}),false);
 assert.equal(await fixture({choice:'AMBOS'}).allow('/v1/telegram/corrections/preview',{packageId}),true);
});
test('scope mismatch, corrupt tombstone and DB failure deny rather than skip enforcement',async()=>{
 assert.equal(await fixture({binding:'tg_'+'c'.repeat(40)}).allow('/v1/media/begin',{packageId,requestId,destination:'OPURO'}),false);
 assert.equal(await fixture({cancelled:['UNKNOWN']}).allow('/v1/media/begin',{requestId,destination:'OPURO'}),false);
 assert.equal(await fixture({cancelled:['OPURO']}).allow('/v1/media/begin',{requestId,destination:'LIBERAL'}),false);
 assert.equal(await fixture({corruptHash:true}).allow('/v1/media/begin',{requestId,destination:'OPURO'}),false);
 assert.equal(await fixture({fail:true}).allow('/v1/media/begin',{requestId,destination:'OPURO'}),false);
});
test('unrelated reads, completion reports and ordinary non-Telegram requests do not acquire this new restriction',async()=>{
 const f=fixture({fail:true});for(const path of ['/v1/telegram/packages/manifest','/v1/telegram/writers/report','/v1/targets/report','/v1/telegram/submissions/report'])assert.equal(await f.allow(path,{packageId,requestId}),true);assert.equal(await f.allow('/v1/reservations',{requestId:'external_request_123'}),true);
});
test('packages without cancellations retain their existing behavior and connection is always released',async()=>{
 const f=fixture({cancelled:[]});assert.equal(await f.allow('/v1/telegram/corrections/preview',{packageId}),true);assert.equal(f.released,1);
});
