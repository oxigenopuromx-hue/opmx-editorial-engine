import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync('workflows/publisher/OPMX_RECUPERACION_SOLO_LECTURA.n8n.js','utf8');
const code=[...source.matchAll(/jsCode:("(?:[^"\\]|\\.)*")/g)].map(x=>JSON.parse(x[1]));
const [validate,gate,report]=code.map(x=>new Function('$input','$',x));
const identity={requestId:'opmx_request_example_123',slug:'prueba-editorial',destination:'OPURO',fingerprint:'a'.repeat(64)};
const input=json=>({first:()=>({json})});
const guard={observed:{reservation:{status:'claimed',identity:'matched'},target:{status:'reported',postId:'42'}},retryPermitted:false};
test('la recuperación comprueba identidad y no expone un camino de escritura',()=>{
 assert.equal(validate(input(identity))[0].json.slug,identity.slug);
 assert.throws(()=>validate(input({...identity,slug:'../../wp'})),/inválida/);
 assert.throws(()=>gate(input({statusCode:200,body:{...guard,observed:{reservation:{status:'identity_mismatch'}}}})),/no confirmados/);
 assert.doesNotMatch(source,/\/wp-json\/wp\/v2\/(posts|media).*method:\s*['"]POST['"]/);
});
test('el informe compara IDs sin autorizar reintento o presumir ausencia de medios',()=>{
 const lookup=name=>({first:()=>({json:name==='Validar identidad'?identity:{guard}})});
 const ok=report(input({statusCode:200,body:[{id:42,slug:identity.slug,status:'draft',featured_media:8}]}),lookup)[0].json;
 assert.equal(ok.wordpress.reportedPostIdFound,true);assert.equal(ok.retryPermitted,false);assert.equal(ok.consistentSnapshot,false);
 const missing=report(input({statusCode:200,body:[]}),lookup)[0].json;assert.equal(missing.wordpress.reportedPostIdFound,false);assert.equal(missing.retryPermitted,false);
 assert.throws(()=>report(input({statusCode:403,body:{}}),lookup),/no confirmada/);
});
