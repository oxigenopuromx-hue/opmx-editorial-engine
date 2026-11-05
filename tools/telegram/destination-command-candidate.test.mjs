import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDestinationCommand as parse } from './destination-command-candidate.mjs';

test('legacy default and AMBOS retain their original two destinations', () => {
  assert.deepEqual(parse('/publicar').destinations, ['OPURO','OPOL']);
  assert.deepEqual(parse('/borrador ambos').destinations, ['OPURO','OPOL']);
});
test('single sites and explicit all derive from Publisher registry', () => {
  for (const name of ['OPURO','OPOL','LIBERAL']) assert.deepEqual(parse('/publicar '+name).destinations,[name]);
  assert.deepEqual(parse('/publicar todos').destinations,['OPURO','OPOL','LIBERAL']);
  assert.equal(parse('/borrador liberal').mode,'DRAFT');
});
test('combinations are normalized and invalid selections fail closed', () => {
  assert.equal(parse('/publicar liberal, opuro').destination,'OPURO,LIBERAL');
  for (const cmd of ['/publicar desconocido','/publicar opuro,,opol','/publicar liberal\ntexto','/publicar en ambos','/publicar\nliberal']) assert.throws(()=>parse(cmd));
});
