import test from 'node:test';import assert from 'node:assert/strict';import {readPackageDiagnostic} from './package-diagnostic.mjs';
test('diagnostic distinguishes editorial text from operational controls and never treats URL-only input as full text',async()=>{
 const c={execute(){throw Error('Unexpected write or read')}},pack={package_id:'tg_'+'a'.repeat(40),revision:13},base={pack,lease:null,actorKey:'a',ownerKey:'b'};
 const items=[{kind:'TEXT',state:'STORED',text_content:'OPMX-TELEGRAM-ORDER-x\n/listo'},{kind:'TEXT',state:'STORED',text_content:'https://example.com/article'},{kind:'FILE',state:'STORED',attachment_json:'{"mime_type":"image/jpeg"}'}];
 const d=await readPackageDiagnostic(c,{...base,items});assert.equal(d.origin,'OTHER_ACCOUNT');assert.equal(d.substantiveTexts,0);assert.equal(d.images,1);assert.deepEqual(d.urls,['https://example.com/article']);
 const richer=await readPackageDiagnostic(c,{...base,items:[...items,{kind:'TEXT',state:'STORED',text_content:'Material editorial suficientemente extenso para comprobar que el paquete ya tiene el texto de respaldo requerido.'}]});assert.equal(richer.substantiveTexts,1);assert.equal(richer.pending,0);
});
