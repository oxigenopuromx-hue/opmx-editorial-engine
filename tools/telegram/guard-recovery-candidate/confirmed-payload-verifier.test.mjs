import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildCorrectionPreview} from './correction-preview.mjs';
import {renderCorrectionPreview} from './correction-preview-renderer.mjs';
import {canonicalUpdateValue} from './canonical-json.mjs';
import {verifyConfirmedUpdatePayload} from './confirmed-payload-verifier.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const packageId='tg_'+'a'.repeat(40),owner=hash('opmx:telegram:v1:123:123'),event='evt_'+'b'.repeat(48),item={itemId:'ti_'+'d'.repeat(40),kind:'TEXT',state:'STORED',sha256:hash('texto'),text:'texto'};
function fixture(finalPayloads={OPURO:{content:'<p>Texto exacto</p>',title:'Título'}}){
 const args={packageId,revision:10,ownerKey:owner,actorKey:owner,baseRevision:7,before:[item],after:[item],action:'UPDATE',mode:'EDITORIAL',destination:'OPURO',verifiedPosts:{OPURO:123}};
 const p=buildCorrectionPreview({...args,finalPayloads}),state={preview:p};
 const c={async execute(sql){
  if(sql.startsWith('SELECT owner_key,state,revision'))return [[{owner_key:owner,state:'READY',revision:11}]];
  if(sql.startsWith('SELECT preview_hash,decision_json'))return [[{preview_hash:state.preview.previewHash,decision_json:JSON.stringify(state.preview)}]];
  if(sql.startsWith('SELECT owner_key,preview_receipt'))return [[{owner_key:owner,preview_receipt:'telegram-123-10-100',confirmation_receipt:'telegram-123-11-101',state:'CONFIRMED',event_id:event,preview_json:JSON.stringify(state.preview)}]];
  if(sql.startsWith('SELECT event_id FROM opmx_tg_events'))return [[{event_id:event}]];
  if(sql.startsWith('SELECT snapshot_revision'))return [[{snapshot_revision:7,actor_key:owner,close_receipt_key:hash('telegram-123-10-100')}]];
  throw Error(sql);
 }};
 const payload={content:'<p>Texto exacto</p>',title:'Título'};
 const input={packageId,revision:11,destination:'OPURO',previewHash:p.previewHash,postId:123,payloadHash:hash(canonicalUpdateValue(payload)),contentMode:'EDITORIAL',payload};
 return {p,c,input,state,args};
}
test('only the exact confirmed output and target are accepted',async()=>{
 const {p,c,input}=fixture();const r=await verifyConfirmedUpdatePayload(c,input);assert.equal(r.exactPayload,true);
 const text=renderCorrectionPreview({status:'PREVIEW_READY',preview:p}).messages.join('');assert.match(text,/Contenido exacto de actualización para OPURO/);assert.match(text,/Texto exacto/);
 for(const change of [{postId:124},{destination:'OPOL'},{previewHash:'c'.repeat(64)},{contentMode:'LITERAL'},{payload:{...input.payload,title:'Alterado'}},{payloadHash:'c'.repeat(64)}])assert.equal(await verifyConfirmedUpdatePayload(c,{...input,...change}),null);
});
test('a material-only confirmation cannot approve arbitrary generated output',async()=>{
 const f=fixture(null);assert.equal(await verifyConfirmedUpdatePayload(f.c,f.input),null);
 const x=fixture();x.state.preview.finalPayloads.OPURO.title='Alterado';assert.equal(await verifyConfirmedUpdatePayload(x.c,x.input),null);
});
test('preview binds a separate exact output for every update destination',()=>{
 const f=fixture();assert.throws(()=>buildCorrectionPreview({...f.args,finalPayloads:{OPOL:{content:'otro'}}}),/CORRECTION_PREVIEW_UNCONFIRMED/);
 const p=buildCorrectionPreview({...f.args,finalPayloads:{OPURO:{title:'Distinto'}}});assert.notEqual(p.previewHash,f.p.previewHash);
 assert.throws(()=>buildCorrectionPreview({...f.args,finalPayloads:{OPURO:{content:'x'.repeat(17000)}}}),/CORRECTION_PREVIEW_UNCONFIRMED/);
});
