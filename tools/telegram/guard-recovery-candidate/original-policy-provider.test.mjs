import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {attestedControl} from './original-destination-policy.mjs';
import {deriveOriginalDecision} from './original-policy-provider.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
const digest=s=>createHash('sha256').update(s).digest('hex');
const packageId='tg_'+'a'.repeat(40),ownerKey='b'.repeat(64);
function textItem(n,text){return {itemId:'ti_'+String(n).repeat(40),ownerKey,actorKey:null,kind:'TEXT',state:'STORED',text,contentBytes:Buffer.byteLength(text),sha256:digest(text)}}
function fixture(command){
 const texts=[attestedControl('/nuevo',packageId,10,11),'Texto editorial'];
 if(command)texts.push(attestedControl(command,packageId,12));
 texts.push(attestedControl('/listo',packageId,20));
 return {packageId,revision:7,ownerKey,items:texts.map((s,i)=>textItem(i+1,s))};
}
test('derive all authenticated destination combinations and stable request ID',()=>{
 for(const [command,label,sites] of [[null,'TODOS',['OPURO','OPOL','LIBERAL']],['/publicar OPOL,LIBERAL','OPOL,LIBERAL',['OPOL','LIBERAL']],['/publicar OPURO,LIBERAL','OPURO,LIBERAL',['OPURO','LIBERAL']],['/publicar OPURO,OPOL','AMBOS',['OPURO','OPOL']],['/publicar OPURO,OPOL,LIBERAL','TODOS',['OPURO','OPOL','LIBERAL']]]){
  const result=deriveOriginalDecision(fixture(command));assert.deepEqual(result.destinations,sites);assert.equal(result.requestId,expectedDraftRequestId({packageId,revision:7,destination:label}));assert.equal(result.authorization.authorized,true);
 }
});
test('derive old announced default without upgrading it to TODOS',()=>{
 const f=fixture();f.items[0]=textItem(1,f.items[0].text.replace('publish-todos-v2','publish-ambos-v1'));assert.deepEqual(deriveOriginalDecision(f).destinations,['OPURO','OPOL']);
});
test('reject unverified text, wrong owner and incomplete control records',()=>{
 for(const mutate of [f=>f.items[1].text='cambiado',f=>f.items[1].ownerKey='c'.repeat(64),f=>f.items[1].actorKey='d'.repeat(64),f=>delete f.items[1].actorKey,f=>f.items.pop()]){const f=fixture();mutate(f);assert.throws(()=>deriveOriginalDecision(f),/ORIGINAL_POLICY_UNCONFIRMED/);}
});

test('capture binds derived request and destinations to trusted transactional outcomes',async()=>{
 const {createOriginalRevisionCapture}=await import('./original-policy-provider.mjs');const f=fixture('/publicar OPOL,LIBERAL'),conn={};let calls=0;
 const capture=createOriginalRevisionCapture({lockVerifiedBlockedOutcomes:async(c,d)=>{assert.equal(c,conn);calls++;assert.deepEqual(d.destinations,['OPOL','LIBERAL']);return d.destinations.map(destination=>({destination,status:'BLOCKED',publicationVerdict:'NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'}))}});
 const result=await capture(conn,packageId,7,ownerKey,f.items);assert.equal(calls,1);assert.equal(result.results.length,2);
});
test('capture rejects incomplete or uncertain outcomes and never fabricates them',async()=>{
 const {createOriginalRevisionCapture}=await import('./original-policy-provider.mjs');const f=fixture();
 for(const outcomes of [null,[],[{destination:'OPURO',status:'BLOCKED'}]]){
  const capture=createOriginalRevisionCapture({lockVerifiedBlockedOutcomes:async()=>outcomes});assert.equal(await capture({},packageId,7,ownerKey,f.items),null);
 }
 assert.throws(()=>createOriginalRevisionCapture({}),/MISSING_BLOCKED_OUTCOME_PROVIDER/);
});
