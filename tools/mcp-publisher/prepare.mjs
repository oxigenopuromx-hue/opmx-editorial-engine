// Offline prototype: no MCP transport, OAuth, or live n8n submission.
const fileSchema = {
  type: 'object',
  properties: {
    download_url: {type: 'string'}, file_id: {type: 'string'},
    mime_type: {type: 'string'}, file_name: {type: 'string'},
  },
  required: ['download_url', 'file_id'], additionalProperties: false,
};

export const toolDescriptor = {
  name: 'preparar_borrador_opmx',
  description: 'Prepara un borrador OPMX; no publica.',
  inputSchema: {
    type: 'object',
    properties: {
      master: {type: 'object'},
      request_id: {type: 'string', minLength: 16, maxLength: 128, pattern: '^[A-Za-z0-9_-]+$'},
      destino: {type: 'string', enum: ['OPURO', 'OPOL', 'AMBOS']},
      hero: fileSchema, destacada: fileSchema,
    },
    required: ['request_id', 'master', 'destino', 'destacada'], additionalProperties: false,
  },
  annotations: {readOnlyHint: false, destructiveHint: false, openWorldHint: false},
  _meta: {'openai/fileParams': ['hero', 'destacada']},
};

function imageType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.subarray(0,4).toString() === 'RIFF' && buffer.subarray(8,12).toString() === 'WEBP') return 'image/webp';
  throw new Error('Formato de imagen no admitido');
}

// fetchImpl must be trusted infrastructure. allowHosts must be exact hostnames
// supplied by the operator after verifying ChatGPT download origins.
async function download(file, {fetchImpl, allowHosts, maxBytes}) {
  if (!file || typeof file.file_id !== 'string' || !file.file_id || typeof file.download_url !== 'string') throw new Error('Falta el archivo');
  let url;
  try { url = new URL(file.download_url); } catch { throw new Error('URL de archivo inválida'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowHosts.includes(url.hostname)) throw new Error('Origen de archivo no autorizado');
  // Reject redirects: signed URLs must not be forwarded to a different origin.
  let response;
  try { response = await fetchImpl(url.href, {redirect:'error', signal: AbortSignal.timeout(15000)}); }
  catch { throw new Error('No fue posible descargar el archivo'); }
  if (!response.ok || !response.body) throw new Error('No fue posible descargar el archivo');
  const length = response.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new Error('Archivo demasiado grande');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > maxBytes) { await response.body.cancel().catch(() => {}); throw new Error('Archivo demasiado grande'); }
    chunks.push(Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);
  const mime = imageType(buffer);
  if (file.mime_type && file.mime_type !== mime) throw new Error('Tipo de imagen inconsistente');
  return {base64: buffer.toString('base64')};
}

export async function prepareDraft(input, {fetchImpl = fetch, allowHosts = [], maxBytes = 10 * 1024 * 1024} = {}) {
  if (!input || !input.master || typeof input.master !== 'object' || Array.isArray(input.master)) throw new Error('MASTER inválido');
  if (!['OPURO','OPOL','AMBOS'].includes(input.destino)) throw new Error('Destino inválido');
  if (input.destino !== 'OPOL' && !input.hero) throw new Error('Falta HERO');
  if (!input.destacada) throw new Error('Falta destacada');
  if (!Array.isArray(allowHosts) || !allowHosts.length) throw new Error('Orígenes de archivos no configurados');
  const featured_file = await download(input.destacada, {fetchImpl, allowHosts, maxBytes});
  const result = {master: input.master, CREAR_EN: input.destino, PUBLICAR: false, featured_file};
  if (input.destino !== 'OPOL') result.hero_file = await download(input.hero, {fetchImpl, allowHosts, maxBytes});
  return result;
}
