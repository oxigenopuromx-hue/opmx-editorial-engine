import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMariaDbLedger,schemaSql} from './mariadb-ledger.mjs';
import {runOnce} from './idempotency.mjs';

// Unit-test double only. It does not prove MariaDB transaction, lock or crash behaviour.
function fakePool() {
  const rows=new Map();
  return {async execute(sql,args) {
    if(sql.startsWith('INSERT')) {
      if(rows.has(args[0])) {const e=new Error('duplicate');e.code='ER_DUP_ENTRY';throw e;}
      rows.set(args[0],{fingerprint:args[1],status:'claimed',result_json:null});return [{affectedRows:1}];
    }
    if(sql.startsWith('SELECT')) return [[rows.get(args[0])].filter(Boolean)];
    if(sql.startsWith('UPDATE')) {const row=rows.get(args[2]);if(!row||row.status!==args[3]) return [{affectedRows:0}];row.status=args[0];row.result_json=args[1];return [{affectedRows:1}];}
    throw Error('Unexpected query');
  }};
}
test('usa clave primaria binaria y motor transaccional',()=>{assert.match(schemaSql,/PRIMARY KEY/);assert.match(schemaSql,/ascii_bin/);assert.match(schemaSql,/InnoDB/)});
test('claim atómico simulado y replay evitan segundo envío',async()=>{
 const ledger=createMariaDbLedger(fakePool());let sent=0;
 const options={ledger,requestId:'request_123456789',input:{master:{a:1},destino:'OPOL',destacada:{file_id:'x'}},prepare:async()=>({}),submit:async()=>{sent++;return {status:'SUCCESS',mode:'DRAFT',summary:{opol:'DRAFT'}}}};
 const out=await Promise.all([runOnce(options),runOnce(options)]);
 assert.equal(sent,1);assert.ok(out.some(x=>x.status==='complete'));
 const again=await runOnce(options);assert.equal(again.replay,true);assert.equal(sent,1);
});
test('otros errores de base no son tratados como duplicados',async()=>{
 const ledger=createMariaDbLedger({execute:async()=>{throw new Error('desconectado')}});
 await assert.rejects(ledger.claim('request_123456789','a'.repeat(64)),/No se pudo registrar/);
});
test('la reserva MariaDB cancela la transacción completa ante un destino duplicado',async()=>{
 const calls=[];let inserts=0;
 const connection={beginTransaction:async()=>calls.push('begin'),commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),release:()=>calls.push('release'),execute:async()=>{if(++inserts===2){const error=new Error('duplicado');error.code='ER_DUP_ENTRY';throw error;}calls.push('insert')}};
 const ledger=createMariaDbLedger({execute:async()=>[],getConnection:async()=>connection});
 assert.equal(await ledger.reserveTargets('request_123456789',['a'.repeat(64),'b'.repeat(64)]),false);
 assert.deepEqual(calls,['begin','insert','rollback','release']);
});

