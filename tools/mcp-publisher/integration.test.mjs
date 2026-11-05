import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAuthenticator} from './auth.mjs';
import {createN8nSubmit} from './n8n.mjs';

const active={active:true,iss:'https://issuer.example',aud:'https://mcp.example',scope:'publisher.draft',sub:'user',exp:2000000000};
const authOpts={endpoint:'https://issuer.example/introspect',clientId:'client',clientSecret:'secret',issuer:active.iss,audience:active.aud,scope:active.scope,now:()=>1000};
test('OAuth valida sujeto, emisor, audiencia, alcance y expiración',async()=>{
 const auth=data=>createAuthenticator({...authOpts,fetchImpl:async()=>new Response(JSON.stringify(data))});
 assert.equal(await auth(active)('sample'),'user');
 for(const bad of [{...active,active:false},{...active,aud:'other'},{...active,scope:'read'},{...active,iss:'other'},{...active,exp:0},{...active,nbf:2},{...active,nbf:'invalid'}]) await assert.rejects(auth(bad)('sample'),/No autorizado/);
});
test('n8n sólo confirma cuando todos los destinos están en borrador',async()=>{
 const result={status:'SUCCESS',mode:'DRAFT',summary:{opuro:'DRAFT',opol:'DRAFT'}};let sent;
 const submit=createN8nSubmit({endpoint:'https://n8n.example/webhook/test',getToken:async()=>'test-token',fetchImpl:async(url,options)=>{sent=options;return new Response(JSON.stringify(result))}});
 assert.equal((await submit({PUBLICAR:false,CREAR_EN:'AMBOS'})).status,'SUCCESS');
 assert.equal(sent.redirect,'error');assert.equal(sent.headers.authorization,'Bearer test-token');
 await assert.rejects(submit({PUBLICAR:true,CREAR_EN:'AMBOS'}),/borradores/);
 const partial=createN8nSubmit({endpoint:'https://n8n.example/webhook/test',getToken:async()=>'test',fetchImpl:async()=>new Response(JSON.stringify({...result,summary:{opuro:'DRAFT',opol:'FAILED'}}))});
 await assert.rejects(partial({PUBLICAR:false,CREAR_EN:'AMBOS'}),/no confirmado/);
});
test('un timeout n8n no se reintenta ni expone credenciales',async()=>{
 let attempts=0;const submit=createN8nSubmit({endpoint:'https://n8n.example/webhook/test',getToken:async()=>'secret',fetchImpl:async()=>{attempts++;throw Error('secret')}});
 await assert.rejects(submit({PUBLICAR:false,CREAR_EN:'OPURO'}),e=>e.message==='Resultado n8n desconocido');assert.equal(attempts,1);
});

