import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildReceiverRelease} from './receiver/build-receiver-release.mjs';
const mapping={normalize:'normalize-candidate.js',prepare:'prepare-candidate.js',resolve:'resolve-candidate.js',seal:'seal-candidate.js',confirm:'confirm-candidate.js',identity:'preview-delivery-identity-candidate.js',next:'preview-delivery-next-candidate.js',send:'preview-delivery-send-candidate.js',ack:'preview-delivery-ack-candidate.js'};
const scripts=Object.fromEntries(await Promise.all(Object.entries(mapping).map(async([k,v])=>[k,await readFile(new URL('./receiver/'+v,import.meta.url),'utf8')])));
const guardCredential={id:'guard',name:'guard'},telegramCredential={id:'bot',name:'bot'},version='69c2a2c7-3fc0-4221-99a3-3eeaba784c1c';
function fixture(){const names=['Normalizar entrada Telegram','Preparar paquete Telegram','Resolver paquete Telegram','Preparar sellado con cierre acreditado','Confirmar operación de paquete Telegram'];return {id:'OSi8AcnzLlI0csRu',active:true,versionId:version,activeVersionId:version,nodes:[...names.map(name=>({name,type:'n8n-nodes-base.code'})),{name:'Operar paquete Telegram',type:'n8n-nodes-base.httpRequest',parameters:{url:"={{ 'https://publisher.oxigenopuro.com.mx/v1/telegram/packages/' + $json.next_action }}"},credentials:{httpHeaderAuth:guardCredential}},{name:'Confirmar recepción Telegram',credentials:{telegramApi:telegramCredential}}],connections:{'¿Cierre acreditado guardado?':{main:[[{node:'Sellar paquete con cierre acreditado'}],[{node:'Conservar operación sin sellado'}]]}}};}
test('builds one atomic update for the existing receiver and its preview branch',()=>{
 const {operations,baseVersion}=buildReceiverRelease({workflow:fixture(),scripts,guardCredential,telegramCredential});assert.equal(baseVersion,version);
 assert.equal(operations.filter(x=>x.type==='updateNodeParameters').length,6);assert.ok(operations.some(x=>x.nodeName==='Operar paquete Telegram'&&x.parameters.url==='={{ $json.next_url }}'));
 assert.ok(operations.filter(x=>x.type==='addNode').every(x=>!x.node.type.includes('Trigger')));
});
test('refuses a changed version, route, credentials or an existing candidate node',()=>{
 for(const mutate of [w=>w.versionId='other',w=>w.activeVersionId='other',w=>w.nodes.find(x=>x.name==='Operar paquete Telegram').parameters.url='elsewhere',w=>w.nodes.find(x=>x.name==='Confirmar recepción Telegram').credentials.telegramApi.id='else',w=>w.nodes.push({name:'Preparar identidad de vista'})]){const w=structuredClone(fixture());mutate(w);assert.throws(()=>buildReceiverRelease({workflow:w,scripts,guardCredential,telegramCredential}),/RECEIVER_(VERSION|GRAPH)_CHANGED/);}
});
