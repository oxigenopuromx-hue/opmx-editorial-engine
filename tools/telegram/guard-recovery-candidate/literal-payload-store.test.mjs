import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {attestedControl,ORDER_PREFIX} from './original-destination-policy.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {canonicalUpdateValue} from './canonical-json.mjs';
import {createLiteralPayloadStore,readLiteralScopeInTransaction,readLiteralProofInTransaction,literalPayloadSchema} from './literal-payload-store.mjs';
import {readRecoveredPolicyInTransaction} from './recovered-policy-mysql.mjs';
import {readConfirmedCorrectionInTransaction} from './confirmed-correction-reader.mjs';
import {chooseMotorPolicy} from './motor-policy.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const packageId='tg_'+'a'.repeat(40),revision=8,owner='b'.repeat(64),eventId='evt_'+'c'.repeat(48);
const requestId=expectedDraftRequestId({packageId,revision,destination:'TODOS'});
const title='Título original completo de más de sesenta caracteres que no se debe truncar ni reescribir';
const subtitle='Primer subtítulo completo.\n\nSegundo subtítulo completo.';
const body=['La Paz, Baja California Sur, 30 de octubre de 2026.','El texto original conserva cifras, fecha y el signo & sin añadir fuentes.'];
const escape=x=>x.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const html=body.map(p=>'<p>'+escape(p)+'</p>').join('\n');
const gutenberg=body.map(p=>'<!-- wp:paragraph -->\n<p>'+escape(p)+'</p>\n<!-- /wp:paragraph -->').join('\n\n');
const candidate={requestId,declaredMode:'LITERAL',title,subtitle,html,gutenberg,enriched:gutenberg};
function item(text,index){return {item_id:'ti_'+String(index).repeat(40),owner_key:owner,kind:'TEXT',state:'STORED',text_content:text,content_bytes:Buffer.byteLength(text),sha256:hash(text),actor_key:null};}
function fixture({literal=true}={}){
 const texts=[attestedControl('/nuevo',packageId,10,11),[title,subtitle,...body].join('\n\n'),...(literal?[attestedControl('/literal',packageId,12)]:[]),attestedControl('/publicar TODOS',packageId,13),attestedControl('/listo',packageId,14)];
 const f={state:{package:{state:'READY',revision,owner_key:owner},attempt:{state:'RUNNING',event_id:eventId},fence:{state:'READY_TO_WRITE'},items:texts.map(item),bindings:[{package_id:packageId,revision}],classes:[{kind:'TELEGRAM'}],closures:[],decisions:[],proofs:[]},queries:[],releaseCalls:[],commits:0,rollbacks:0,releases:0,destroys:0,releaseOk:true,commitThrows:false,rollbackThrows:false,insertConflict:false,connections:0};
 // File is deliberately retained in the source fingerprint but is not prose.
 f.state.items.splice(f.state.items.length-1,0,{item_id:'ti_'+'f'.repeat(40),owner_key:owner,kind:'FILE',state:'STORED',text_content:'',content_bytes:1234,sha256:'e'.repeat(64),actor_key:null});
 let snapshot=null,active=false;
 const rows=value=>[structuredClone(value)],changed=n=>[{affectedRows:n}];
 const c={
  async beginTransaction(){assert.equal(active,false);active=true;snapshot=structuredClone(f.state)},
  async commit(){assert.equal(active,true);f.commits++;active=false;snapshot=null;if(f.commitThrows)throw Error('COMMIT acknowledgement lost')},
  async rollback(){f.rollbacks++;if(f.rollbackThrows)throw Error('rollback failed');if(active){f.state=snapshot;active=false;snapshot=null}},
  release(){f.releases++},destroy(){f.destroys++},
  async execute(sql,args=[]){
   assert.equal(active,true,'all reads and changes hold a transaction');f.queries.push({sql,args:structuredClone(args)});const s=f.state;
   if(sql==='SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE')return rows([{id:1}]);
   if(sql.startsWith('SELECT package_id,revision FROM opmx_tg_request_binding_v1'))return rows(args[0]===requestId?s.bindings:[]);
   if(sql.startsWith('SELECT state,revision FROM opmx_tg_packages_v1'))return rows(s.package?[s.package]:[]);
   if(sql.startsWith('SELECT owner_key,state,revision FROM opmx_tg_packages_v1'))return rows(s.package?[s.package]:[]);
   if(sql.startsWith('SELECT state,event_id FROM opmx_tg_motor_attempts_v1'))return rows(s.attempt?[s.attempt]:[]);
   if(sql.startsWith('SELECT state FROM opmx_tg_publication_fence_v1'))return rows(s.fence?[s.fence]:[]);
   if(sql.startsWith('SELECT i.item_id'))return rows(s.items);
   if(sql.startsWith('SELECT package_id FROM opmx_tg_recovery_closures_v1'))return rows(s.closures);
   if(sql.startsWith('SELECT snapshot_revision,actor_key'))return rows(s.closures);
   if(sql.startsWith('SELECT owner_key,snapshot_json'))return rows(s.snapshot?[{owner_key:owner,snapshot_json:JSON.stringify(s.snapshot)}]:[]);
   if(sql.startsWith('SELECT decision_json FROM opmx_tg_confirmed_decisions_v1'))return rows(s.decisions);
   if(sql.startsWith('SELECT preview_hash,decision_json FROM opmx_tg_confirmed_decisions_v1'))return rows(s.decisions);
   if(sql.startsWith('SELECT owner_key,preview_receipt,confirmation_receipt,state,event_id,preview_json FROM opmx_tg_correction_previews_v1'))return rows(s.preview?[s.preview]:[]);
   if(sql.startsWith('SELECT event_id FROM opmx_tg_events_v1'))return rows([{event_id:eventId}]);
   if(sql.startsWith('SELECT kind FROM opmx_tg_request_class_v1'))return rows(s.classes);
   if(sql.startsWith('SELECT package_id,revision,destination,content_mode,preview_hash,payload_hash,source_hash,payload_json,source_json FROM opmx_tg_literal_payloads_v1'))return rows(args[0]===requestId?s.proofs:[]);
   if(sql.startsWith('INSERT INTO opmx_tg_literal_payloads_v1')){
    if(f.insertConflict)return changed(0);
    assert.equal(s.proofs.length,0,'proof is immutable');
    const [request_id,package_id,revision,destination,content_mode,preview_hash,payload_hash,source_hash,payload_json,source_json]=args;
    s.proofs.push({request_id,package_id,revision,destination,content_mode,preview_hash,payload_hash,source_hash,payload_json,source_json});return changed(1);
   }
   // No WordPress, sources, fence, attempt or session mutation is supported.
   throw Error('Unexpected SQL: '+sql);
  }
 };
 f.connection=c;f.store=createLiteralPayloadStore({pool:{getConnection:async()=>{f.connections++;return c}},verifyRelease:async(connection,scope)=>{assert.equal(connection,c);assert.equal(active,true);f.releaseCalls.push(scope);return f.releaseOk}});
 f.readScope=async()=>{await c.beginTransaction();try{return await readLiteralScopeInTransaction(c,{packageId,revision})}finally{await c.rollback()}};
 f.readProof=async extra=>{await c.beginTransaction();try{return await readLiteralProofInTransaction(c,{packageId,revision,destination:'TODOS',...extra})}finally{await c.rollback()}};
 return f;
}
function recoveredFixture({inheritedLiteral=false,confirmedLiteral=true}={}){
 const f=fixture({literal:inheritedLiteral}),actor=hash('opmx:telegram:v1:12345:12345'),receipt='telegram-12345-50-100';
 for(const [index,r] of f.state.items.entries())Object.assign(r,{receipt_key:hash('old-receipt-'+index),fingerprint:hash('old-fingerprint-'+index),reserved_bytes:r.content_bytes,attachment_json:null});
 const oldItems=f.state.items.map(r=>({itemId:r.item_id,ownerKey:r.owner_key,kind:r.kind,state:r.state,text:r.text_content,contentBytes:r.content_bytes,sha256:r.sha256,receiptKey:r.receipt_key,fingerprint:r.fingerprint,reservedBytes:r.reserved_bytes,attachment:null,actorKey:r.actor_key}));
 const controls=f.state.items.filter(r=>r.text_content?.startsWith(ORDER_PREFIX)).map(r=>r.item_id);
 const contentControls=inheritedLiteral?[f.state.items.find(r=>r.text_content?.includes('/literal\n')).item_id]:[];
 f.state.snapshot={prior:{packageId,ownerKey:owner,revision:6,destinations:['OPURO','OPOL','LIBERAL'],authorization:{mode:'PUBLISH',authorized:true,explicit:true,authorization:'DIRECT_MODE_COMMAND'},controls,contentMode:inheritedLiteral?'LITERAL':'EDITORIAL',contentControlItemIds:contentControls},items:oldItems};
 const close=item(attestedControl('/listo',packageId,50),8);Object.assign(close,{receipt_key:hash(receipt),fingerprint:hash('new-fingerprint'),reserved_bytes:close.content_bytes,attachment_json:null,actor_key:actor});f.state.items.push(close);
 f.state.closures=[{package_id:packageId,revision,snapshot_revision:6,actor_key:actor,close_item_id:close.item_id,close_receipt_key:hash(receipt)}];
 if(confirmedLiteral){
  const content={packageId,revision:revision-1,ownerKey:owner,actorKey:actor,baseRevision:6,action:'CREATE',mode:'LITERAL',destination:'TODOS',posts:['OPURO','OPOL','LIBERAL'].map(destination=>({destination,postId:null}))};
  const previewHash=hash(JSON.stringify(content)),decision={...content,previewHash},encoded=JSON.stringify(decision);
  f.state.decisions=[{decision_json:encoded,preview_hash:previewHash}];
  f.state.preview={owner_key:actor,preview_receipt:receipt,confirmation_receipt:'telegram-12345-51-101',state:'CONFIRMED',event_id:eventId,preview_json:encoded};
 }
 f.state.fence.state='AWAITING_DECISION';return f;
}
function withHistoricalInstruction(f,{discarded=true}={}){
 const raw=item('La publicación va tal cual, sin agregarle nada.',9);
 assert.equal(raw.content_bytes,48);
 Object.assign(raw,{receipt_key:hash('historical-instruction-receipt'),fingerprint:hash('historical-instruction-fingerprint'),reserved_bytes:raw.content_bytes,attachment_json:null});
 f.state.snapshot.items.push({itemId:raw.item_id,ownerKey:owner,kind:raw.kind,state:'STORED',text:raw.text_content,contentBytes:raw.content_bytes,sha256:raw.sha256,receiptKey:raw.receipt_key,fingerprint:raw.fingerprint,reservedBytes:raw.reserved_bytes,attachment:null,actorKey:null});
 raw.state=discarded?'DISCARDED':'STORED';f.state.items.splice(-1,0,raw);
 return raw;
}
async function recoveredMotorPolicy(f,{omitTextId}={}){
 const c=f.connection;await c.beginTransaction();
 try{
  const recovered=await readRecoveredPolicyInTransaction(c,packageId,revision);
  const confirmed=await readConfirmedCorrectionInTransaction(c,packageId,revision);
  const inventory={status:'PACKAGE_FOUND',package_id:packageId,revision,state:'READY',recovered_policy:recovered,confirmed_correction:{package_id:packageId,revision,action:confirmed.action,content_mode:confirmed.content_mode,destination:confirmed.destination,preview_hash:confirmed.preview_hash},items:f.state.items.map(r=>({item_id:r.item_id,kind:r.kind,state:r.state,text_bytes:r.content_bytes,sha256:r.sha256}))};
  // Chunk reads are available only for active STORED text. No buffer is
  // supplied for the retained historical instruction after /descartar.
  const sources=f.state.items.filter(r=>r.state==='STORED'&&r.kind==='TEXT'&&r.item_id!==omitTextId).map(r=>({item_id:r.item_id,stream:'text',bytes:Buffer.from(r.text_content)}));
  return chooseMotorPolicy(inventory,sources,{packageId,revision});
 }finally{await c.rollback()}
}
function assertNoAuthority(result){assert.equal(result.retryPermitted,false);assert.equal(Object.hasOwn(result,'token'),false);assert.equal(Object.hasOwn(result,'writeAuthorized'),false)}
function assertFailure(result){assert.equal(result.status,'LITERAL_TEXT_UNCONFIRMED');assert.equal(result.writesStarted,false);assertNoAuthority(result)}

test('schema stores immutable proof, not a capability or source instruction',()=>{
 assert.match(literalPayloadSchema,/PRIMARY KEY/);assert.match(literalPayloadSchema,/preview_hash/);assert.doesNotMatch(literalPayloadSchema,/token|password|url/i);
});
test('real original-control provider chooses LITERAL and preserves the complete source corpus',async()=>{
 const f=fixture(),s=await f.readScope();assert.equal(s.contentMode,'LITERAL');assert.equal(s.destination,'TODOS');assert.equal(s.sourceText,[title,subtitle,...body].join('\n\n'));assert.equal(s.sourceHash,hash(s.sourceJson));
 assert.equal(s.sourceItems.length,f.state.items.length);assert.equal(s.controlItemIds.length,4);assert.equal(s.previewHash,null);
});
test('original mode remains EDITORIAL without an authenticated content command',async()=>{
 const f=fixture({literal:false}),s=await f.readScope();assert.equal(s.contentMode,'EDITORIAL');
 const r=await f.store.validate({...candidate,declaredMode:'EDITORIAL'});assert.equal(r.status,'EDITORIAL_PROFILE_UNCHANGED');assert.equal(f.releaseCalls.length,0);assert.equal(f.state.proofs.length,0);assert.equal(f.commits,0);
});
test('the editorial profile does not replace legacy writer guards with a new attempt requirement',async()=>{
 const f=fixture({literal:false});f.state.attempt=null;f.state.fence=null;
 const r=await f.store.validate({...candidate,declaredMode:'EDITORIAL'});assert.equal(r.status,'EDITORIAL_PROFILE_UNCHANGED');assert.equal(f.releaseCalls.length,0);assert.equal(f.state.proofs.length,0);assert.equal(f.commits,0);assert.equal(f.rollbacks,1);
});
test('a MASTER flag cannot create literal authority or downgrade a literal decision',async()=>{
 assertFailure(await fixture({literal:false}).store.validate(candidate));
 assertFailure(await fixture().store.validate({...candidate,declaredMode:'EDITORIAL'}));
});
test('records proof only after real original bytes, canonical equality and release attestation',async()=>{
 const f=fixture(),before=structuredClone(f.state),r=await f.store.validate(candidate);assert.equal(r.status,'LITERAL_TEXT_VERIFIED');assertNoAuthority(r);
 assert.equal(r.requestId,requestId);assert.equal(r.destination,'TODOS');assert.equal(r.packageId,packageId);assert.equal(r.revision,revision);assert.equal(r.mode,'LITERAL');assert.equal(r.previewHash,null);assert.match(r.payloadHash,/^[a-f0-9]{64}$/);assert.match(r.sourceHash,/^[a-f0-9]{64}$/);
 assert.equal(f.commits,1);assert.equal(f.rollbacks,0);assert.deepEqual(f.state.package,before.package);assert.deepEqual(f.state.attempt,before.attempt);assert.deepEqual(f.state.fence,before.fence);assert.deepEqual(f.state.items,before.items);
 assert.deepEqual(f.releaseCalls,[{packageId,revision,eventId}]);assert.equal(f.state.proofs.length,1);assert.equal(f.state.proofs[0].payload_hash,r.payloadHash);
 const mutations=f.queries.filter(q=>/^(UPDATE|DELETE|INSERT)/.test(q.sql));assert.equal(mutations.length,1);assert.match(mutations[0].sql,/INSERT INTO opmx_tg_literal_payloads_v1/);assert.equal(f.queries.some(q=>q.sql.includes('token_hash')),false);
});
test('the reader rechecks stored evidence against real current source scope',async()=>{
 const f=fixture();const made=await f.store.validate(candidate),proof=await f.readProof();assert.equal(proof.payloadHash,made.payloadHash);assert.equal(proof.sourceHash,made.sourceHash);assert.equal(proof.requestId,requestId);assert.equal(proof.mode,'LITERAL');
});
test('proof can precede acknowledgement while a confirmed-decision fence is still closed',async()=>{
 const f=fixture();f.state.fence.state='AWAITING_DECISION';assert.equal((await f.store.validate(candidate)).status,'LITERAL_TEXT_VERIFIED');assert.equal(f.state.fence.state,'AWAITING_DECISION');
});
test('a recovered literal mode is inherited from a real verified snapshot and closure',async()=>{
 const f=recoveredFixture({inheritedLiteral:true,confirmedLiteral:false}),scope=await f.readScope();assert.equal(scope.contentMode,'LITERAL');assert.equal(scope.previewHash,null);assert.equal(scope.sourceText,[title,subtitle,...body].join('\n\n'));
 assert.equal((await f.store.validate(candidate)).status,'LITERAL_TEXT_VERIFIED');assert.equal((await f.readProof()).mode,'LITERAL');
});
test('a confirmed CREATE literal decision overrides an editorial snapshot and binds the exact preview',async()=>{
 const f=recoveredFixture(),scope=await f.readScope();assert.equal(scope.contentMode,'LITERAL');assert.equal(scope.previewHash,f.state.decisions[0].preview_hash);
 const r=await f.store.validate(candidate);assert.equal(r.status,'LITERAL_TEXT_VERIFIED');assert.equal(r.previewHash,scope.previewHash);
 assert.equal((await f.readProof({previewHash:scope.previewHash})).payloadHash,r.payloadHash);assert.equal(await f.readProof({previewHash:'f'.repeat(64)}),null);
});
test('a discarded historical 48-byte instruction remains auditable without being downloaded or becoming literal source',async()=>{
 const f=recoveredFixture(),raw=withHistoricalInstruction(f),retained=structuredClone(raw);
 const policy=await recoveredMotorPolicy(f);assert.equal(policy.content_mode,'LITERAL');assert.equal(policy.destination,'TODOS');
 const scope=await f.readScope();assert.equal(scope.sourceText,[title,subtitle,...body].join('\n\n'));assert.equal(scope.sourceItems.some(s=>s.itemId===raw.item_id),false);assert.equal(scope.controlItemIds.includes(raw.item_id),false);
 const result=await f.store.validate(candidate);assert.equal(result.status,'LITERAL_TEXT_VERIFIED');assert.equal((await f.readProof()).payloadHash,result.payloadHash);
 assert.deepEqual(f.state.items.find(r=>r.item_id===raw.item_id),retained);assert.equal(f.state.snapshot.items.find(r=>r.itemId===raw.item_id).state,'STORED');assert.equal(raw.reserved_bytes,48);
 assert.equal(f.queries.filter(q=>/^(UPDATE|DELETE|INSERT)/.test(q.sql)).every(q=>q.sql.startsWith('INSERT INTO opmx_tg_literal_payloads_v1')),true);
});
test('an active historical instruction cannot disappear by omitting its source buffer',async()=>{
 const f=recoveredFixture(),raw=withHistoricalInstruction(f,{discarded:false});
 await assert.rejects(()=>recoveredMotorPolicy(f,{omitTextId:raw.item_id}),/RECOVERED_POLICY_UNCONFIRMED/);
 assert.match((await f.readScope()).sourceText,/La publicación va tal cual, sin agregarle nada/);
 assertFailure(await f.store.validate(candidate));assert.equal(f.state.proofs.length,0);
});
test('discarding is not a permit to alter retained original instruction bytes',async()=>{
 const f=recoveredFixture(),raw=withHistoricalInstruction(f);raw.text_content+='.';raw.content_bytes=Buffer.byteLength(raw.text_content);raw.sha256=hash(raw.text_content);
 await assert.rejects(()=>f.readScope(),/RECOVERY_POLICY_UNCONFIRMED/);assertFailure(await f.store.validate(candidate));
});
for(const [label,mutate] of [
 ['modified retained source',f=>f.state.items[1].text_content+='!'],['missing snapshot',f=>delete f.state.snapshot],['forged actor receipt',f=>f.state.preview.confirmation_receipt='telegram-99999-51-101'],['unconfirmed preview',f=>f.state.preview.state='DRAFT'],['modified confirmed decision',f=>f.state.decisions[0].decision_json=f.state.decisions[0].decision_json.replace('LITERAL','EDITORIAL')],['missing closure',f=>f.state.closures=[]]
])test('recovered literal proof rejects '+label,async()=>{const f=recoveredFixture();mutate(f);assertFailure(await f.store.validate(candidate));assert.equal(f.state.proofs.length,0)});
test('an exact replay while writing is observational and cannot overwrite the proof',async()=>{
 const f=fixture();const first=await f.store.validate(candidate),saved=structuredClone(f.state.proofs);f.state.fence.state='WRITING';const second=await f.store.validate(candidate);
 assert.deepEqual(second,first);assert.equal(f.commits,1);assert.equal(f.rollbacks,1);assert.deepEqual(f.state.proofs,saved);assert.equal(f.releaseCalls.length,2);
});
test('a new proof cannot be invented after a writer started',async()=>{
 const f=fixture();f.state.fence.state='WRITING';assertFailure(await f.store.validate(candidate));assert.equal(f.state.proofs.length,0);assert.equal(f.commits,0);
});
test('changed formatting with equal visible text still cannot mutate an immutable request payload',async()=>{
 const f=fixture();await f.store.validate(candidate);const saved=structuredClone(f.state.proofs);assertFailure(await f.store.validate({...candidate,html:'<div>'+html+'</div>'}));assert.deepEqual(f.state.proofs,saved);
});
for(const [label,alter] of [
 ['title remainder moved into body',x=>{const cut=x.title.lastIndexOf(' '),rest=x.title.slice(cut+1);x.title=x.title.slice(0,cut);x.html='<p>'+rest+'</p>'+x.html;x.gutenberg='<!-- wp:paragraph --><p>'+rest+'</p><!-- /wp:paragraph -->'+x.gutenberg;x.enriched=x.gutenberg}],
 ['subtitle fragment moved into body',x=>{const cut=x.subtitle.indexOf(' '),rest=x.subtitle.slice(cut+1);x.subtitle=x.subtitle.slice(0,cut);x.html='<p>'+escape(rest)+'</p>'+x.html;x.gutenberg='<!-- wp:paragraph --><p>'+escape(rest)+'</p><!-- /wp:paragraph -->'+x.gutenberg;x.enriched=x.gutenberg}],
 ['unseen link on original words',x=>{for(const field of ['html','gutenberg','enriched'])x[field]=x[field].replace(escape(body[0]),'<a href="https://new.example">'+escape(body[0])+'</a>')}],
 ['unseen tooltip on original words',x=>{for(const field of ['html','gutenberg','enriched'])x[field]=x[field].replace('<p>','<p title="Un dato añadido">')}],
 ['truncated title',x=>x.title=x.title.slice(0,60)],['changed case',x=>x.title=x.title.toUpperCase()],['added subtitle',x=>x.subtitle+=' Una frase nueva.'],['missing paragraph',x=>{x.html='<p>'+escape(body[0])+'</p>';x.gutenberg='<!-- wp:paragraph --><p>'+escape(body[0])+'</p><!-- /wp:paragraph -->';x.enriched=x.gutenberg}],['extra summary',x=>x.enriched+='<!-- wp:paragraph --><p>En breve: resumen añadido.</p><!-- /wp:paragraph -->'],['unsafe body',x=>x.enriched='<script>alert(1)</script>'+x.enriched],['body variants diverge',x=>x.html+='<p>Otro texto.</p>']
])test(label+' fails before proof or CMS writes',async()=>{const f=fixture(),input=structuredClone(candidate);alter(input);assertFailure(await f.store.validate(input));assert.equal(f.state.proofs.length,0);assert.equal(f.commits,0)});
for(const [label,change] of [
 ['source bytes altered',f=>f.state.items[1].text_content+='!'],['source digest altered',f=>f.state.items[1].sha256='1'.repeat(64)],['source provenance altered',f=>f.state.items[1].actor_key='d'.repeat(64)],['duplicate item',f=>f.state.items.splice(1,0,structuredClone(f.state.items[1]))],['pending item',f=>f.state.items[1].state='PENDING'],['mode marker malformed',f=>{const x=f.state.items.find(x=>x.text_content?.includes('/literal\n'));x.text_content=ORDER_PREFIX+'/literal\n{}';x.content_bytes=Buffer.byteLength(x.text_content);x.sha256=hash(x.text_content)}],['unsupported marked control',f=>{const x=f.state.items[1];x.text_content=ORDER_PREFIX+'/unsupported';x.content_bytes=Buffer.byteLength(x.text_content);x.sha256=hash(x.text_content)}],['file hash unconfirmed',f=>f.state.items.find(x=>x.kind==='FILE').sha256=null],['ambiguous closure',f=>f.state.closures=[{},{}]],['UPDATE cannot use creation profile',f=>f.state.decisions=[{decision_json:'{"action":"UPDATE"}'}]],['unbound CREATE cannot use creation profile',f=>f.state.decisions=[{decision_json:'{"action":"CREATE"}'}]],['stale revision',f=>f.state.package.revision++],['unbound request',f=>f.state.bindings=[]],['ambiguous request',f=>f.state.bindings.push(f.state.bindings[0])],['non Telegram class',f=>f.state.classes=[{kind:'MANUAL'}]],['release mismatch',f=>f.releaseOk=false]
])test(label+' fails closed',async()=>{const f=fixture();change(f);assertFailure(await f.store.validate(candidate));assert.equal(f.state.proofs.length,0);assert.equal(f.commits,0)});
for(const state of ['QUEUED','BLOCKED','COMPLETED','REVOKED'])test('attempt '+state+' cannot register proof',async()=>{const f=fixture();f.state.attempt.state=state;assertFailure(await f.store.validate(candidate));assert.equal(f.state.proofs.length,0)});
for(const state of ['RECONCILING','SETTLED','SAFE_TO_REOPEN','MISSING'])test('fence '+state+' cannot validate or replay proof',async()=>{const f=fixture();await f.store.validate(candidate);f.state.fence.state=state;assertFailure(await f.store.validate(candidate));assert.equal(f.commits,1)});
test('release proof has no permissive default',async()=>{
 const f=fixture();const s=createLiteralPayloadStore({pool:{getConnection:async()=>f.connection}});assertFailure(await s.validate(candidate));assert.equal(f.state.proofs.length,0);
});
test('an uncertain commit is never represented as confirmed or retryable',async()=>{
 const f=fixture();f.commitThrows=true;const r=await f.store.validate(candidate);assert.equal(r.status,'LITERAL_PROOF_COMMIT_UNCONFIRMED');assert.equal(r.writesStarted,false);assertNoAuthority(r);assert.equal(f.commits,1);assert.equal(f.state.proofs.length,1);assert.equal(f.releases,1);
});
test('rollback uncertainty removes a positive observational replay result',async()=>{
 const f=fixture();await f.store.validate(candidate);f.rollbackThrows=true;assertFailure(await f.store.validate(candidate));assert.equal(f.destroys,1);
});
test('insert conflict rolls back without a proof acknowledgement',async()=>{
 const f=fixture();f.insertConflict=true;assertFailure(await f.store.validate(candidate));assert.equal(f.state.proofs.length,0);assert.equal(f.commits,0);assert.equal(f.rollbacks,1);
});
for(const [label,alter] of [
 ['bad payload digest',r=>r.payload_hash='0'.repeat(64)],['bad source digest',r=>r.source_hash='0'.repeat(64)],['changed source list',r=>r.source_json='[]'],['wrong package',r=>r.package_id='tg_'+'b'.repeat(40)],['wrong revision',r=>r.revision++],['wrong destination',r=>r.destination='OPURO'],['wrong mode',r=>r.content_mode='EDITORIAL'],['wrong preview',r=>r.preview_hash='a'.repeat(64)],['malformed payload JSON',r=>r.payload_json='{'],['extra payload authority',r=>{const p=JSON.parse(r.payload_json);p.writeAuthorized=true;r.payload_json=canonicalUpdateValue(p);r.payload_hash=hash(r.payload_json)}]
])test('reader rejects '+label,async()=>{const f=fixture();await f.store.validate(candidate);alter(f.state.proofs[0]);assert.equal(await f.readProof(),null)});
test('reader rejects missing, ambiguous and stale-source evidence',async()=>{
 const f=fixture();assert.equal(await f.readProof(),null);await f.store.validate(candidate);f.state.proofs.push(structuredClone(f.state.proofs[0]));assert.equal(await f.readProof(),null);f.state.proofs.pop();f.state.items[1].text_content+='!';assert.equal(await f.readProof(),null);
});
test('reader binds an acknowledging preview hash rather than trusting the caller',async()=>{const f=fixture();await f.store.validate(candidate);assert.equal(await f.readProof({previewHash:'a'.repeat(64)}),null)});
test('schema input rejects source IDs, tokens and other caller assertions without a connection',async()=>{
 for(const input of [null,[],{...candidate,writeAuthorized:true},{...candidate,sourceText:'trusted'},{...candidate,token:'a'.repeat(64)},{...candidate,requestId:'tg_bad'},{...candidate,declaredMode:'literal'},{...candidate,title:null}]){const f=fixture();assertFailure(await f.store.validate(input));assert.equal(f.connections,0)}
});
