import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ownerForPackage, ownerForRequest} from './operator-routing.mjs';

const p='tg_'+'a'.repeat(40),q='tg_'+'b'.repeat(40);
const rows=[{package_id:p,revision:4,stage:'QUEUED',chat_id:'11'},{package_id:q,revision:4,stage:'QUEUED',chat_id:'22'}];
const rid=(packageId,destination='AMBOS')=>'tg_'+createHash('sha256').update(`${packageId}:4:${destination}:draft-v1`).digest('hex');
test('resuelve cada paquete y solicitud por su operador',()=>{
  assert.deepEqual(ownerForPackage(rows,p,4),{owner:'11',chat:'11'});
  assert.deepEqual(ownerForRequest(rows,rid(q)),{owner:'22',chat:'22'});
  assert.deepEqual(ownerForRequest(rows,rid(p,'OPOL')),{owner:'11',chat:'11'});
});
test('falla cerrado sin identidad y ante identidades contradictorias o inválidas',()=>{
  assert.throws(()=>ownerForPackage(rows,p,3));
  assert.throws(()=>ownerForRequest(rows,'tg_'+'0'.repeat(64)));
  assert.throws(()=>ownerForPackage([...rows,{package_id:p,revision:4,stage:'ROUTING',chat_id:'22'}],p,4));
  assert.throws(()=>ownerForPackage([{package_id:p,revision:4,stage:'QUEUED',chat_id:'invalid'}],p,4));
  assert.throws(()=>ownerForPackage([{package_id:p,revision:4,stage:'PROGRESS_START',chat_id:'11'}],p,4));
  assert.deepEqual(ownerForPackage([...rows,{package_id:p,revision:4,stage:'PROGRESS_START',chat_id:null}],p,4),{owner:'11',chat:'11'});
});
