import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareLocalPayload} from './prepare-local.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aN0AAAAASUVORK5CYII=','base64');
async function fixture(t){const d=await mkdtemp(join(tmpdir(),'opmx-local-'));t.after(()=>rm(d,{recursive:true,force:true}));const masterPath=join(d,'master.json'),heroPath=join(d,'hero.png'),featuredPath=join(d,'featured.png');const master={CONTROL_EDITORIAL:{ESTADO:'LISTO'},GUTENBERG_FINAL:'<!-- wp:paragraph --><p>QA</p><!-- /wp:paragraph -->',GUTENBERG_ENRIQUECIDO_FINAL:'<!-- wp:paragraph --><p>QA</p><!-- /wp:paragraph -->'};await writeFile(masterPath,JSON.stringify(master));await writeFile(heroPath,png);await writeFile(featuredPath,png);return {master,masterPath,heroPath,featuredPath,destination:'AMBOS',requestId:'opmx_local_fixture_123'};}
test('puente conserva bytes, MASTER e identidad y fuerza borrador',async t=>{const f=await fixture(t);const {payload,files}=await prepareLocalPayload(f);assert.deepEqual(payload.master,f.master);assert.equal(payload.request_id,f.requestId);assert.equal(payload.PUBLICAR,false);assert.ok(Buffer.from(payload.hero_file.base64,'base64').equals(png));assert.equal(files.length,2);assert.equal(files[0].mime_type,'image/png');});
test('OPOL usa sólo destacada y no requiere Hero',async t=>{const f=await fixture(t);const {payload}=await prepareLocalPayload({...f,destination:'OPOL',heroPath:undefined});assert.equal(payload.hero_file,undefined);assert.equal(payload.CREAR_EN,'OPOL');});
test('rechaza paquetes sin aprobación e imágenes inválidas o demasiado grandes',async t=>{const f=await fixture(t);await assert.rejects(prepareLocalPayload({...f,maxBytes:1}),/grande/);await writeFile(f.featuredPath,'no es imagen');await assert.rejects(prepareLocalPayload(f),/Formato/);await writeFile(f.masterPath,JSON.stringify({...f.master,CONTROL_EDITORIAL:{ESTADO:'REQUIERE_REVISION'}}));await assert.rejects(prepareLocalPayload(f),/no aprobado/);});
