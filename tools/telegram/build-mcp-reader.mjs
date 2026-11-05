import {classifyFileMcp} from '../mcp-publisher/files-mcp-protocol.mjs';
import {classifyTelegramReader,formatTelegramReaderResult} from './mcp-reader.mjs';

export function buildTelegramReaderOperations({identity,guardCredential}) {
 if(typeof identity?.owner!=='string'||identity.owner!==identity.chat||!/^[1-9][0-9]{0,15}$/.test(identity.owner)||!guardCredential?.id||!guardCredential?.name)throw Error('Observar identidad privada y credencial existente antes de configurar');
 const classifier=classifyFileMcp.toString()+'\n'+classifyTelegramReader.toString()+`\nreturn [{json:classifyTelegramReader($input.first().json,${JSON.stringify(identity)},classifyFileMcp)}];`;
 const format=formatTelegramReaderResult.toString()+`\nreturn [{json:formatTelegramReaderResult($('Protocolo MCP archivos').first(0,0).json.request,$input.first().json)}];`;
 return [
  {type:'updateNodeParameters',nodeName:'Protocolo MCP archivos',parameters:{mode:'runOnceForAllItems',jsCode:classifier}},
  {type:'addNode',node:{name:'¿Leer fuente Telegram?',type:'n8n-nodes-base.if',typeVersion:2.2,position:[672,-320],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{leftValue:'={{ $json.route }}',rightValue:'telegram-read',operator:{type:'string',operation:'equals'}}],combinator:'and'},options:{}}}},
  {type:'addNode',node:{name:'Leer fuente privada desde guard',type:'n8n-nodes-base.httpRequest',typeVersion:4.3,position:[896,-320],parameters:{method:'POST',url:"={{ 'https://publisher.oxigenopuro.com.mx/v1/telegram/packages/' + $json.request.action }}",authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',jsonBody:'={{ JSON.stringify($json.request.body) }}',options:{timeout:30000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json'}}}},credentials:{httpHeaderAuth:guardCredential}}},
  {type:'setNodeSettings',nodeName:'Leer fuente privada desde guard',settings:{onError:'continueRegularOutput',retryOnFail:false}},
  {type:'addNode',node:{name:'Formatear fuente privada MCP',type:'n8n-nodes-base.code',typeVersion:2,position:[1120,-320],parameters:{mode:'runOnceForAllItems',jsCode:format}}},
  {type:'removeConnection',source:'¿Notificación MCP?',target:'¿Publicar borradores existentes?',sourceIndex:1,targetIndex:0},
  {type:'addConnection',source:'¿Notificación MCP?',target:'¿Leer fuente Telegram?',sourceIndex:1,targetIndex:0},
  {type:'addConnection',source:'¿Leer fuente Telegram?',target:'Leer fuente privada desde guard',sourceIndex:0,targetIndex:0},
  {type:'addConnection',source:'¿Leer fuente Telegram?',target:'¿Publicar borradores existentes?',sourceIndex:1,targetIndex:0},
  {type:'addConnection',source:'Leer fuente privada desde guard',target:'Formatear fuente privada MCP',sourceIndex:0,targetIndex:0},
  {type:'addConnection',source:'Formatear fuente privada MCP',target:'Responder MCP',sourceIndex:0,targetIndex:0}
 ];
}

