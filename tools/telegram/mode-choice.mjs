import {createHash} from 'node:crypto';
const digest=b=>createHash('sha256').update(b).digest('hex');

// Only individual TEXT messages become choices. FILE captions, documents and
// web pages never grant permission to publish. Intake rejects forwarded exact
// commands before they reach storage. The manifest preserves reception order.
export function chooseTelegramMode(inventory,sources) {
 if(!inventory||inventory.state!=='READY'||!Array.isArray(inventory.items)||!Array.isArray(sources))throw Error('Inventario inválido');
 let choice={mode:'DRAFT',destination:'AMBOS',explicit:false};
 for(const item of inventory.items){
  if(item.kind!=='TEXT')continue;
  const found=sources.filter(s=>s.item_id===item.item_id&&s.stream==='text');
  if(found.length!==1||!Buffer.isBuffer(found[0].bytes)||found[0].bytes.length!==item.text_bytes||digest(found[0].bytes)!==item.sha256)throw Error('Texto no verificado');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(found[0].bytes).trim();
  const prefix='OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d\n';
  const match=text.startsWith(prefix)?/^\/(publicar|borrador)(?:\s+(ambos|opuro|opol))?$/i.exec(text.slice(prefix.length)):null;
  if(match)choice={mode:match[1].toLowerCase()==='publicar'?'PUBLISH':'DRAFT',destination:(match[2]??'ambos').toUpperCase(),explicit:true};
 }
 return choice;
}

