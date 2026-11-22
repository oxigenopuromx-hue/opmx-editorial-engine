import test from 'node:test';
import assert from 'node:assert/strict';
import {rejectAmbiguousCategoryMatches} from './category-ambiguity-patch.mjs';

const source = `const norm=s=>String(s??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/\\s+/g,' ').trim().toLocaleLowerCase('es-MX');
const requested='Política';
const rows=$input.all().map(i=>i.json);
const exact=rows.find(x=>norm(x.name)===norm(requested));
if(!exact?.id) throw Error('CATEGORY_NOT_FOUND');
return [{json:{category_id:Number(exact.id)}}];`;
function run(rows) { return new Function('$input', rejectAmbiguousCategoryMatches(source))({all:()=>rows.map(json=>({json}))}); }
test('accepts a single normalized match', () => assert.equal(run([{id:7,name:'POLITICA'}])[0].json.category_id,7));
test('refuses duplicate normalized names instead of choosing the first', () => assert.throws(()=>run([{id:7,name:'Política'},{id:8,name:'Politica'}]),/CATEGORY_SELECTION_AMBIGUOUS/));
test('preserves missing-category failure', () => assert.throws(()=>run([{id:7,name:'Cultura'}]),/CATEGORY_NOT_FOUND/));
test('requires exactly the expected source before patching', () => {
  assert.throws(()=>rejectAmbiguousCategoryMatches('return []'),/SOURCE_CHANGED/);
  assert.throws(()=>rejectAmbiguousCategoryMatches(source+'\n'+source),/SOURCE_CHANGED/);
});
