import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareDraft, toolDescriptor} from './prepare.mjs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aN0AAAAASUVORK5CYII=', 'base64');
const file = {file_id:'file-test',download_url:'https://files.example/test',mime_type:'image/png'};
const options = {allowHosts:['files.example'],fetchImpl:async () => new Response(png)};
const input = {master:{CONTROL_EDITORIAL:{ESTADO:'LISTO'}},destino:'AMBOS',hero:file,destacada:file};

test('descriptor expone los dos archivos y esquema compatible', () => {
  assert.deepEqual(toolDescriptor._meta['openai/fileParams'],['hero','destacada']);
  for (const name of ['hero','destacada']) assert.deepEqual(toolDescriptor.inputSchema.properties[name].required,['download_url','file_id']);
});
test('convierte dos imágenes y fuerza modo borrador',async () => {
  const result=await prepareDraft({...input,PUBLICAR:true},options);
  assert.equal(result.PUBLICAR,false); assert.equal(result.CREAR_EN,'AMBOS');
  assert.equal(result.hero_file.base64,png.toString('base64'));
  assert.equal(result.featured_file.base64,png.toString('base64'));
});
test('OPOL acepta sólo destacada',async () => {
  const result=await prepareDraft({...input,destino:'OPOL',hero:undefined},options);
  assert.equal(result.hero_file,undefined); assert.equal(result.CREAR_EN,'OPOL');
});
test('rechaza URLs no permitidas antes de descargar',async () => {
  let calls=0; const fetchImpl=async()=>{calls++;return new Response(png)};
  await assert.rejects(prepareDraft({...input,destacada:{...file,download_url:'https://127.0.0.1/test'}},{...options,fetchImpl}),/Origen/);
  assert.equal(calls,0);
});
test('rechaza tamaños, firmas y MIME inconsistentes',async () => {
  await assert.rejects(prepareDraft(input,{...options,maxBytes:10}),/grande/);
  await assert.rejects(prepareDraft(input,{...options,fetchImpl:async()=>new Response('no es imagen')}),/Formato/);
  await assert.rejects(prepareDraft({...input,destacada:{...file,mime_type:'image/jpeg'}},options),/inconsistente/);
});
test('bloquea redirecciones y no incluye el URL en errores',async () => {
  let seen;
  await assert.rejects(prepareDraft(input,{...options,fetchImpl:async (url,opts)=>{seen=opts;return new Response(null,{status:302,headers:{location:'https://evil.example'}})}}),/descargar/);
  assert.equal(seen.redirect,'error');
});
