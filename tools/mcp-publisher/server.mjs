import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {toolDescriptor,prepareDraft} from './prepare.mjs';
import {runOnce} from './idempotency.mjs';

const statusTool = {
  name:'consultar_borrador_opmx', description:'Consulta el estado de una solicitud sin crear otra entrada.',
  inputSchema:{type:'object',properties:{request_id:{type:'string',minLength:16,maxLength:128,pattern:'^[A-Za-z0-9_-]+$'}},required:['request_id'],additionalProperties:false},
  annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},
};

// This transport is experimental: OAuth discovery, network policy, and live
// n8n integration must be implemented and tested before remote deployment.
// Callers must supply an authenticate() implementation; no anonymous mode.
export function createMcpServer({authenticate,ledger,submit,prepareOptions}) {
  if (typeof authenticate !== 'function' || !ledger || typeof submit !== 'function') throw new Error('Falta configuración de autenticación o backend');
  return createServer(async (req,res) => {
    const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
    if (req.url !== '/mcp' || req.method !== 'POST') return send(404,{error:'not found'});
    const header=req.headers.authorization;
    if (typeof header !== 'string' || !/^Bearer [^\s]+$/.test(header)) return send(401,{error:'unauthorized'});
    let subject;
    try { subject=await authenticate(header.slice(7)); } catch { return send(401,{error:'unauthorized'}); }
    if (typeof subject !== 'string' || !subject) return send(401,{error:'unauthorized'});
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
        const status=await ledger.getStatus(requestId);
        const result=status ?? {status:'not_found'};
        return reply({content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result});
      }
      const result=await runOnce({ledger,requestId,input,prepare:value=>prepareDraft(value,prepareOptions),submit});
      return reply({content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result,isError:result.status!=='complete'});
    } catch {return reply({content:[{type:'text',text:'No fue posible procesar la solicitud.'}],isError:true});}
  });
}
