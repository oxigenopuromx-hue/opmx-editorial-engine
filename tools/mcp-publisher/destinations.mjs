// Ordered registry: AMBOS is permanently the original pair; TODOS expands here.
export function destinationRegistry() {
 return {
  OPURO:{cms:'https://cms.oxigenopuro.com.mx',publicOrigin:'https://oxigenopuro.com.mx',resultKey:'oxigenopuro',postIdKey:'post_id_opuro',heroMeta:'oxpuro_hero_media_id',editorialMeta:'oxpuro_editorial',hero:true},
  OPOL:{cms:'https://cms.oxigenopolitico.com.mx',publicOrigin:'https://oxigenopolitico.com.mx',resultKey:'oxigenopolitico',postIdKey:'post_id_opol',hero:false},
  LIBERAL:{cms:'https://cms.elliberal.mx',publicOrigin:'https://elliberal.mx',resultKey:'elliberal',postIdKey:'post_id_liberal',heroMeta:'liberalmx_hero_media_id',editorialMeta:'liberalmx_editorial',hero:true},
 };
}
export function resolveDestinations(value) {
 if(Array.isArray(value)){if(!value.every(v=>typeof v==='string'))throw Error('Destino inválido');value=value.join(',');}
 if(typeof value!=='string'||!value.trim()||value.length>256)throw Error('Destino inválido');
 const registry=destinationRegistry(),selected=new Set();
 for(const item of value.split(',')){
  const token=item.trim().toUpperCase();if(!token)throw Error('Destino vacío entre comas');
  const expanded=token==='AMBOS'?['OPURO','OPOL']:token==='TODOS'?Object.keys(registry):[token];
  for(const destination of expanded){if(!Object.hasOwn(registry,destination))throw Error('Destino desconocido: '+destination);selected.add(destination);}
 }
 return Object.keys(registry).filter(d=>selected.has(d));
}
export function destinationLabel(destinations) {
 const all=Object.keys(destinationRegistry()),set=new Set(destinations),items=all.filter(d=>set.has(d));
 if(items.length!==set.size||!items.length)throw Error('Destino inválido');
 if(items.length===all.length)return 'TODOS';
 if(items.length===2&&items[0]==='OPURO'&&items[1]==='OPOL')return 'AMBOS';
 return items.join(',');
}
export function destinationRuntimeSource(){return [destinationRegistry,resolveDestinations,destinationLabel].map(f=>f.toString()).join('\n');}
