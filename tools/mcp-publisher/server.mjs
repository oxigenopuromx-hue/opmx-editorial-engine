import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {toolDescriptor,prepareDraft} from './prepare.mjs';
import {startDraft,queryDraft} from './async-jobs.mjs';

const statusTool = {
  name:'consultar_borrador_opmx', description:'Consulta el estado de una solicitud sin crear otra entrada.',
  inputSchema:{type:'object',properties:{request_id:{type:'string',minLength:16,maxLength:128,pattern:'^[A-Za-z0-9_-]+$'}},required:['request_id'],additionalProperties:false},
  annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},
  securitySchemes:[{type:'oauth2',scopes:['publisher.draft']}],
  _meta:{securitySchemes:[{type:'oauth2',scopes:['publisher.draft']}]},
};

// This transport is experimental: OAuth discovery, network policy, and live
// n8n integration must be implemented and tested before remote deployment.
// Callers must supply an authenticate() implementation; no anonymous mode.
export function createMcpServer({authenticate,ledger,start,read,prepareOptions,resource,issuer}) {
  if (typeof authenticate !== 'function' || !ledger || typeof start !== 'function' || typeof read !== 'function') throw new Error('Falta configuración de autenticación o backend');
  let resourceUrl, issuerUrl;
  try {resourceUrl=new URL(resource);issuerUrl=new URL(issuer);} catch {throw new Error('Metadatos OAuth no configurados');}
  if(resourceUrl.protocol!=='https:' || issuerUrl.protocol!=='https:' || resourceUrl.pathname!=='/mcp' || resourceUrl.search || resourceUrl.hash || resourceUrl.username || resourceUrl.password || issuerUrl.search || issuerUrl.hash || issuerUrl.username || issuerUrl.password) throw new Error('Metadatos OAuth inválidos');
  const metadataUrl=new URL('/.well-known/oauth-protected-resource/mcp',resourceUrl.origin).href;
  return createServer(async (req,res) => {
    const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
    if (req.url === '/.well-known/oauth-protected-resource/mcp' && req.method==='GET') return send(200,{resource:resourceUrl.href,authorization_servers:[issuerUrl.href.replace(/\/$/,'')],scopes_supported:['publisher.draft']});
    if (req.url !== '/mcp' || req.method !== 'POST') return send(404,{error:'not found'});
    const unauthorized=()=>{res.setHeader('WWW-Authenticate',`Bearer resource_metadata="${metadataUrl}", scope="publisher.draft"`);return send(401,{error:'unauthorized'});};
    const header=req.headers.authorization;
    if (typeof header !== 'string' || !/^Bearer [^\s]+$/.test(header)) return unauthorized();
    let subject;
    try { subject=await authenticate(header.slice(7)); } catch { return unauthorized(); }
    if (typeof subject !== 'string' || !subject) return unauthorized();
    const chunks=[]; let bytes=0;
    try {
      for await (const part of req) {bytes+=part.length; if(bytes>2*1024*1024) return send(413,{error:'request too large'}); chunks.push(part);}
    } catch { return send(400,{error:'invalid request'}); }
    let message;try {message=JSON.parse(Buffer.concat(chunks).toString('utf8'))} catch {return send(400,{error:'invalid json'})}
    const id=message?.id ?? null;
    const reply=result=>send(200,{jsonrpc:'2.0',id,result});
    const fail=(code,message)=>send(200,{jsonrpc:'2.0',id,error:{code,message}});
    if (message?.jsonrpc !== '2.0') return fail(-32600,'Invalid Request');
    if (message.method === 'notifications/initialized') {res.writeHead(202);return res.end();}
    if (message.method === 'initialize') return reply({protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'opmx-publisher-draft',version:'0.1.0'}});
    if (message.method === 'tools/list') return reply({tools:[toolDescriptor,statusTool]});
    if (message.method !== 'tools/call' || ![toolDescriptor.name,statusTool.name].includes(message.params?.name)) return fail(-32601,'Method not found');
    const input=message.params.arguments;
    if (!input || typeof input.request_id !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(input.request_id)) return fail(-32602,'Invalid request_id');
    // Scope keys to the authenticated subject without storing the subject itself.
    const requestId=createHash('sha256').update(JSON.stringify([subject,input.request_id])).digest('hex');
    try {
      if (message.params.name === statusTool.name) {
        const result=await queryDraft({ledger,requestId,read});
        return reply({content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result});
      }
      const result=await startDraft({ledger,requestId,input,prepare:value=>prepareDraft({...value,request_id:requestId},prepareOptions),start});
      return reply({content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result,isError:!['complete','pending'].includes(result.status)});
    } catch {return reply({content:[{type:'text',text:'No fue posible procesar la solicitud.'}],isError:true});}
  });
}

