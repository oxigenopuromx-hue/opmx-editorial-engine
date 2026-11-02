import {createHash} from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

export function assembleTelegramSource(chunks,{packageId,itemId,stream,sha256=null,maxBytes=10485760}) {
 if(!Array.isArray(chunks)||chunks.length<1||chunks.length>161||!Number.isSafeInteger(maxBytes)||maxBytes<0||maxBytes>10485760)throw Error('Fragmentos inválidos');
 const buffers=[];let offset=0,expectedTotal=null,expectedHash=sha256;
 for(let i=0;i<chunks.length;i++) {
  const c=chunks[i];
  if(c?.status!=='SOURCE_CHUNK'||c.package_id!==packageId||c.item_id!==itemId||c.stream!==stream||c.offset!==offset||!Number.isSafeInteger(c.total_bytes)||c.total_bytes<0||c.total_bytes>maxBytes||!Number.isSafeInteger(c.bytes)||c.bytes<0||c.bytes>65536||typeof c.content_base64!=='string'||c.content_base64.length>87384)throw Error('Identidad o límite de fragmento inválido');
  if(expectedTotal===null){expectedTotal=c.total_bytes;expectedHash??=c.sha256;}
  if(c.total_bytes!==expectedTotal||c.sha256!==expectedHash||c.next_offset!==offset+c.bytes||c.next_offset>expectedTotal||c.eof!==(c.next_offset===expectedTotal)||c.eof!==(i===chunks.length-1)||(!c.bytes&&!c.eof))throw Error('Secuencia de fragmentos inválida');
  const bytes=Buffer.from(c.content_base64,'base64');
  if(bytes.length!==c.bytes||bytes.toString('base64')!==c.content_base64||hash(bytes)!==c.chunk_sha256)throw Error('Huella de fragmento inválida');
  buffers.push(bytes);offset=c.next_offset;
 }
 if(offset!==expectedTotal)throw Error('Original incompleto');
 const original=Buffer.concat(buffers);
 if(hash(original)!==expectedHash)throw Error('Huella del original inválida');
 return original;
}
