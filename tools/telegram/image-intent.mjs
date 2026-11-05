import {createHash} from 'node:crypto';
const marker='OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d\n';
export function chooseGeneratedImage(inventory,sources){
 if(!inventory||inventory.state!=='READY'||!Array.isArray(inventory.items)||!Array.isArray(sources))throw Error('Inventario inválido');
 let requested=false;
 for(const item of inventory.items){
  if(item.kind!=='TEXT')continue;
  const found=sources.filter(s=>s.item_id===item.item_id&&s.stream==='text');
  if(found.length!==1||!Buffer.isBuffer(found[0].bytes)||found[0].bytes.length!==item.text_bytes||createHash('sha256').update(found[0].bytes).digest('hex')!==item.sha256)throw Error('Texto no verificado');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(found[0].bytes).trim();
  if(text.startsWith(marker)&&/^(?:\/imagen\s+generar$|(?:genera|generar|crea|crear)\s+(?:una\s+)?(?:imagen|ilustraci[oó]n)[^\n]{0,180}(?:\n|$))/i.test(text.slice(marker.length)))requested=true;
 }
 return {generate:requested};
}

