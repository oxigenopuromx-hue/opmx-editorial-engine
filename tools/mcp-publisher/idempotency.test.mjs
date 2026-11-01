import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openRequestLedger,fingerprint,runOnce} from './idempotency.mjs';

const id='0123456789abcdef';
const input={master:{b:2,a:1},destino:'OPURO',hero:{file_id:'file-hero',download_url:'https://secret'},destacada:{file_id:'file-cover'}};
const complete={status:'SUCCESS',mode:'DRAFT',summary:{opuro:'DRAFT'}};
function setup(t){const dir=mkdtempSync(join(tmpdir(),'opmx-ledger-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return join(dir,'ledger.db');}
test('la huella ignora URL temporal y orden de claves',()=>assert.equal(fingerprint(input),fingerprint({...input,master:{a:1,b:2},hero:{...input.hero,download_url:'https://otra'}})));
test('repetición y reinicio no vuelven a crear',async t=>{
 const path=setup(t);let ledger=openRequestLedger(path);let count=0;
 const opts={requestId:id,input,prepare:async()=>({}),submit:async()=>{count++;return complete}};
 assert.equal((await runOnce({ledger,...opts})).status,'complete');ledger.close();ledger=openRequestLedger(path);
 assert.equal((await runOnce({ledger,...opts})).replay,true);assert.equal(count,1);ledger.close();
});
test('timeout durante envío conserva estado incierto y evita reintento',async t=>{
 const ledger=openRequestLedger(setup(t));let count=0;
 const opts={ledger,requestId:id,input,prepare:async()=>({}),submit:async()=>{count++;throw Error('timeout')}};
 assert.equal((await runOnce(opts)).status,'needs_reconciliation');
 assert.equal((await runOnce(opts)).status,'needs_reconciliation');assert.equal(count,1);ledger.close();
});
test('solicitudes concurrentes no duplican',async t=>{
 const ledger=openRequestLedger(setup(t));let count=0;
 const opts={ledger,requestId:id,input,prepare:async()=>({}),submit:async()=>{count++; await new Promise(r=>setTimeout(r,15));return complete}};
 const values=await Promise.all([runOnce(opts),runOnce(opts)]);
 assert.equal(count,1);assert.deepEqual(values.map(x=>x.status).sort(),['complete','needs_reconciliation']);ledger.close();
});
test('rechaza reutilizar ID para otro contenido',async t=>{
 const ledger=openRequestLedger(setup(t));const opts={ledger,requestId:id,input,prepare:async()=>({}),submit:async()=>complete};
 await runOnce(opts);await assert.rejects(runOnce({...opts,input:{...input,destino:'AMBOS'}}),/otros datos/);ledger.close();
});
test('error previo al envío no llama n8n',async t=>{
 const ledger=openRequestLedger(setup(t));let count=0;
 const res=await runOnce({ledger,requestId:id,input,prepare:async()=>{throw Error('fallo')},submit:async()=>{count++;}});
 assert.equal(res.status,'failed_before_send');assert.equal(count,0);ledger.close();
});
