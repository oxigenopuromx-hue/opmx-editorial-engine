import test from 'node:test';import assert from 'node:assert/strict';import {patchWriterResolverId as patch} from './writer-resolver-id-patch.mjs';
const source=`const c=$('Validar y normalizar OPMX MASTER').first().json.canonical;
const requested=c.categories.opuro.principal;
const norm=s=>String(s??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').trim().toLowerCase();
const rows=$input.all().map(x=>x.json);
const exact=rows.find(x=>norm(x.name)===norm(requested));
if(!exact?.id)throw Error('CATEGORY_NOT_FOUND');return [{json:{id:exact.id}}];`;
const rows=[{id:21,name:'Deporte'},{id:43,name:'Deporte'}];
function run(id,values=rows){const c={categories:{opuro:{principal:'Deporte',...(id===undefined?{}:{principal_id:id})}}};return new Function('$','$input',patch(source,'OPURO'))(()=>({first:()=>({json:{canonical:c}})}),{all:()=>values.map(json=>({json}))});}
test('selects the exact destination-specific ID and blocks ambiguous legacy input',()=>{assert.equal(run(43)[0].json.id,43);assert.equal(run(21)[0].json.id,21);assert.throws(()=>run(),/AMBIGUOUS/)});
test('legacy unique names work and ID must match the name',()=>{assert.equal(run(undefined,[rows[0]])[0].json.id,21);assert.throws(()=>run(999),/UNCONFIRMED/);assert.throws(()=>run('43'),/INVALID/)});
test('rejects changed node source and unsupported site',()=>{assert.throws(()=>patch('return []','OPURO'),/SOURCE_CHANGED/);assert.throws(()=>patch(source,'HORIZONTE'),/INVALID/)});
