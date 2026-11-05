import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyFileMcp} from '../mcp-publisher/files-mcp-protocol.mjs';
import {classifyTelegramReader,formatTelegramReaderResult} from './mcp-reader.mjs';
import {validatePackageRequest,createTelegramPackageStore} from './package-store.mjs';
import {buildTelegramReaderOperations} from './build-mcp-reader.mjs';
const identity={owner:'1001',chat:'1001'},pkg='tg_'+'a'.repeat(40),item='ti_'+'b'.repeat(40);
const invoke=(name,args)=>classifyTelegramReader({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}},identity,classifyFileMcp);
test('reader adds only two readonly tools and preserves four Publisher tools',()=>{
 const r=classifyTelegramReader({jsonrpc:'2.0',id:1,method:'tools/list'},identity,classifyFileMcp).response.result.tools;
 assert.equal(r.length,6);assert.equal(r.filter(t=>t.name.startsWith('leer_')).length,2);for(const t of r.filter(t=>t.name.startsWith('leer_')))assert.equal(t.annotations.readOnlyHint,true);
});
test('reader binds owner privately and rejects caller supplied owner, URLs and oversized ranges',()=>{
 const r=invoke('leer_fuente_telegram_opmx',{package_id:pkg,item_id:item,stream:'original'});assert.equal(r.route,'telegram-read');assert.equal(r.request.body.owner,'1001');assert.equal(r.request.body.length,65536);
 for(const extra of [{owner:'2002'},{url:'https://example.com'},{length:65537},{offset:-1},{stream:'publish'}])assert.ok(invoke('leer_fuente_telegram_opmx',{package_id:pkg,item_id:item,stream:'original',...extra}).response.error);
});
test('unknown calls and unauthorised publication still delegate to established guardrails',()=>{
 assert.ok(invoke('publicar_borradores_opmx',{destino:'AMBOS'}).response.error);
 assert.ok(invoke('unknown',{}).response.error);
});
test('manifest returns inventory without source text or captions',()=>{
 const req=invoke('leer_paquete_telegram_opmx',{package_id:pkg}).request;
 const r=formatTelegramReaderResult(req,{status:'FOUND',packageId:pkg,state:'READY',revision:4,items:[{item_id:item,kind:'TEXT',state:'STORED',text_content:'private source text',content_bytes:19,sha256:'a'.repeat(64)}]});
 assert.equal(r.response.result.structuredContent.status,'PACKAGE_FOUND');assert.equal(JSON.stringify(r).includes('private source text'),false);
});
test('fragment formatter rejects wrong owner binding, item, offset and noncanonical Base64',()=>{
 const req=invoke('leer_fuente_telegram_opmx',{package_id:pkg,item_id:item,stream:'original'}).request;
 const good={status:'FOUND',packageId:pkg,itemId:item,stream:'original',offset:0,bytes:1,totalBytes:1,nextOffset:1,eof:true,sha256:'a'.repeat(64),chunkSha256:'b'.repeat(64),contentBase64:'YQ==',mime_type:'image/jpeg'};
 assert.equal(formatTelegramReaderResult(req,good).response.result.structuredContent.status,'SOURCE_CHUNK');
 for(const change of [{packageId:'tg_'+'b'.repeat(40)},{itemId:'ti_'+'c'.repeat(40)},{offset:1},{contentBase64:'YR=='}])assert.equal(formatTelegramReaderResult(req,{...good,...change}).response.result.isError,true);
});
test('backend range validation forbids oversized, fractional and negative reads',()=>{
 const input={...identity,packageId:pkg,itemId:item,stream:'original',offset:0,length:65536};assert.ok(validatePackageRequest('chunk',input));
 for(const change of [{length:65537},{length:0},{offset:-1},{offset:0.5},{stream:'url'}])assert.throws(()=>validatePackageRequest('chunk',{...input,...change}));
});
test('original range uses bounded SQL SUBSTRING, not complete blob transfer',async()=>{
 const seen=[];const c={async beginTransaction(){},async commit(){},async rollback(){},release(){},async execute(sql,args){seen.push([sql,args]);
 if(sql.startsWith('CREATE')||sql.startsWith('INSERT IGNORE'))return [{}];
 if(sql.includes('FROM opmx_tg_quota'))return [[{used_bytes:5,package_count:1}]];
 if(sql.includes('FROM opmx_tg_packages'))return [[{package_id:pkg,state:'READY',revision:4}]];
 if(sql.includes('SUBSTRING'))return [[{content_bytes:5,blob_bytes:5,sha256:'a'.repeat(64),attachment_json:JSON.stringify({mime_type:'image/jpeg'}),chunk_blob:Buffer.from('bc')}]];
 throw Error('Unexpected SQL');}};
 const out=await createTelegramPackageStore({async getConnection(){return c;}}).run('chunk',{...identity,packageId:pkg,itemId:item,stream:'original',offset:1,length:2});assert.equal(out.contentBase64,'YmM=');assert.equal(out.eof,false);assert.equal(out.nextOffset,3);const query=seen.find(([s])=>s.includes('SUBSTRING'));assert.deepEqual(query[1].slice(0,2),[2,2]);assert.equal(query[0].includes('SELECT content_blob,'),false);
});
test('reader branch bypasses all Publisher write paths and embedded code compiles',()=>{
 const ops=buildTelegramReaderOperations({identity,guardCredential:{id:'observed',name:'Existing guard'}});
 const edges=ops.filter(x=>x.type==='addConnection');
 assert.ok(edges.some(x=>x.source==='¿Leer fuente Telegram?'&&x.target==='Leer fuente privada desde guard'&&x.sourceIndex===0));
 assert.ok(edges.some(x=>x.source==='¿Leer fuente Telegram?'&&x.target==='¿Publicar borradores existentes?'&&x.sourceIndex===1));
 for(const op of ops){const code=op.parameters?.jsCode??op.node?.parameters?.jsCode;if(code)assert.doesNotThrow(()=>new Function('$input','$',code));}
 assert.equal(ops.some(x=>x.type==='setWorkflowSettings'||x.type==='setNodeCredential'),false);
});

