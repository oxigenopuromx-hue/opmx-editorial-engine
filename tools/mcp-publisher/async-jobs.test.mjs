import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openRequestLedger} from './idempotency.mjs';
import {startDraft,queryDraft} from './async-jobs.mjs';

const id='1234567890123456';
const input={master:{test:true},destino:'AMBOS',hero:{file_id:'h'},destacada:{file_id:'d'}};
const payload={PUBLICAR:false,CREAR_EN:'AMBOS'};
const result={status:'SUCCESS',mode:'DRAFT',summary:{opuro:'DRAFT',opol:'DRAFT'}};
test('inicia una sola vez, consulta y confirma los dos borradores',async()=>{
 const ledger=openRequestLedger(':memory:');let calls=0;
 const options={ledger,requestId:id,input,prepare:async()=>payload,start:async()=>{calls++;return {executionId:'42'}}};
 assert.equal((await startDraft(options)).status,'pending');
 assert.equal((await startDraft(options)).replay,true);assert.equal(calls,1);
 assert.equal((await queryDraft({ledger,requestId:id,read:async()=>({state:'running'})})).status,'pending');
 assert.equal((await queryDraft({ledger,requestId:id,read:async()=>({state:'success',result})})).status,'complete');
 assert.equal((await queryDraft({ledger,requestId:id,read:async()=>{throw Error('no debe llamar')}})).status,'complete');ledger.close();
});
test('si se pierde la respuesta inicial no vuelve a iniciar',async()=>{
 const ledger=openRequestLedger(':memory:');let calls=0;
 const options={ledger,requestId:id,input,prepare:async()=>payload,start:async()=>{calls++;throw Error('timeout')}};
 assert.equal((await startDraft(options)).status,'needs_reconciliation');
 assert.equal((await startDraft(options)).status,'needs_reconciliation');assert.equal(calls,1);ledger.close();
});
test('rechaza publicación y resultado parcial',async()=>{
 const ledger=openRequestLedger(':memory:');let calls=0;
 const opts={ledger,requestId:id,input,prepare:async()=>({...payload,PUBLICAR:true}),start:async()=>{calls++}};
 assert.equal((await startDraft(opts)).status,'failed_before_send');assert.equal(calls,0);ledger.close();
 const ledger2=openRequestLedger(':memory:');await startDraft({...opts,ledger:ledger2,prepare:async()=>payload,start:async()=>({executionId:'7'})});
 const out=await queryDraft({ledger:ledger2,requestId:id,read:async()=>({state:'success',result:{...result,summary:{opuro:'DRAFT',opol:'FAILED'}}})});
 assert.equal(out.status,'needs_reconciliation');ledger2.close();
});
test('consulta fallida conserva estado para posterior recuperación',async()=>{
 const ledger=openRequestLedger(':memory:');await startDraft({ledger,requestId:id,input,prepare:async()=>payload,start:async()=>({executionId:'7'})});
 assert.equal((await queryDraft({ledger,requestId:id,read:async()=>{throw Error('offline')}})).status,'pending');
 assert.equal((await queryDraft({ledger,requestId:id,read:async()=>({state:'success',result})})).status,'complete');ledger.close();
});
