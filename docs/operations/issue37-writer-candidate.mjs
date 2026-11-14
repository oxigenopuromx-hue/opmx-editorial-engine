import {randomUUID} from 'node:crypto';

// Candidate transformation; pass a verified clone of the live writer graph.
// The caller must coordinate MCP preflight and Guard writer-release pins.
export function addOpolHero(graph) {
 const out=structuredClone(graph), byName=name=>{const n=out.nodes.find(x=>x.name===name);if(!n)throw Error('MISSING_NODE '+name);return n};
 const rep=(s,from,to)=>{if(s.split(from).length!==2)throw Error('UNEXPECTED_SOURCE '+from);return s.replace(from,to)};
 const pairs=[['GUARD OPOL — Iniciar destacada','GUARD OPOL — Iniciar Hero'],['GUARD OPOL — Verificar inicio destacada','GUARD OPOL — Verificar inicio Hero'],['OPOL — Recuperar binario destacada','OPOL — Recuperar binario Hero'],['OPOL — Subir DESTACADA','OPOL — Subir HERO'],['GUARD OPOL — Reportar destacada','GUARD OPOL — Reportar Hero'],['GUARD OPOL — Verificar reporte destacada','GUARD OPOL — Verificar reporte Hero'],['OPOL — Metadata DESTACADA','OPOL — Metadata HERO'],['OPOL — Leer destacada','OPOL — Leer Hero'],['OPOL — Verificar destacada','OPOL — Verificar Hero']];
 for(const [old,name] of pairs){
  if(out.nodes.some(n=>n.name===name))throw Error('NODE_EXISTS '+name);
  const n=structuredClone(byName(old));n.id=randomUUID();n.name=name;n.position=[n.position[0],n.position[1]-160];
  let p=JSON.stringify(n.parameters).replaceAll("role:'featured'","role:'hero'").replaceAll('featured_file','hero_file').replaceAll('OPOL — Subir DESTACADA','OPOL — Subir HERO').replaceAll('featured_opol','hero_opuro').replaceAll('DESTACADA_OPOL_VERIFICADA','HERO_OPOL_VERIFICADA').replaceAll('Destacada OPOL no coincide','Hero OPOL no coincide');
  n.parameters=JSON.parse(p);out.nodes.push(n);
 }
 for(let i=0;i<pairs.length;i++)out.connections[pairs[i][1]]={main:[[{node:i===pairs.length-1?'GUARD OPOL — Iniciar destacada':pairs[i+1][1],type:'main',index:0}],[{node:'OPOL — Requiere conciliación',type:'main',index:0}]]};
 const branchName='OPOL — ¿Hero disponible?';
 if(out.nodes.some(n=>n.name===branchName))throw Error('NODE_EXISTS '+branchName);
 out.nodes.push({id:randomUUID(),name:branchName,type:'n8n-nodes-base.if',typeVersion:2.2,position:[0,0],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{leftValue:"={{ !!$('Validar y normalizar OPMX MASTER').first().binary?.hero_file }}",operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}});
 out.connections[branchName]={main:[[{node:pairs[0][1],type:'main',index:0}],[{node:'GUARD OPOL — Iniciar destacada',type:'main',index:0}]]};
 const entry=out.connections['GUARD OPOL — Verificar destino']?.main?.[0]?.[0];
 if(entry?.node!=='GUARD OPOL — Iniciar destacada')throw Error('UNEXPECTED_ENTRY');entry.node=branchName;
 const meta=byName('OPOL — Escribir metadata editorial');
 meta.parameters.jsonBody=rep(meta.parameters.jsonBody,'  meta: {\n    opmx_editorial: {',"  meta: {\n    ...($('Validar y normalizar OPMX MASTER').first().binary?.hero_file ? {opmx_hero_media_id: Number($('OPOL — Subir HERO').first().json.id)} : {}),\n    opmx_editorial: {");
 const readback=byName('OPOL — Validar antes de publicar');
 readback.parameters.jsCode=rep(readback.parameters.jsCode,"p.featured_media!==$('OPOL — Subir DESTACADA').first().json.id", "p.featured_media!==$('OPOL — Subir DESTACADA').first().json.id||($('Validar y normalizar OPMX MASTER').first().binary?.hero_file&&Number(p.meta?.opmx_hero_media_id)!==Number($('OPOL — Subir HERO').first().json.id))");
 return out;
}
