import {featuredBlockerEntries} from './featured-blocker-diagnostic.mjs';

// Append codes consistently to every in-graph copy. No outcome, recipient,
// message text from an external source, or existing code is changed.
export function patchFeaturedBlockerGraph(input) {
 if(!Array.isArray(input?.nodes))throw Error('FEATURED_BLOCKER_GRAPH_INVALID');
 const g=structuredClone(input),required=['Protocolo MCP archivos','Preparar aviso de bloqueo','Resultado de bloqueo Telegram','Bloqueo no confirmado','Preparar registro de avance'];
 const all=g.nodes.filter(n=>typeof n.parameters?.jsCode==='string'&&n.parameters.jsCode.includes('const BLOCKER_DIAGNOSTIC_ENTRIES='));
 if(all.length!==required.length||required.some(name=>all.filter(n=>n.name===name).length!==1))throw Error('FEATURED_BLOCKER_GRAPH_CHANGED');
 let original=null;
 for(const n of all){
  const source=n.parameters.jsCode,marker='const BLOCKER_DIAGNOSTIC_ENTRIES=',start=source.indexOf(marker),end=source.indexOf(';\nfunction blockerDiagnosticSpec(',start);
  if(start<0||end<0||source.indexOf(marker,start+marker.length)!==-1)throw Error('FEATURED_BLOCKER_GRAPH_CHANGED');
  let entries;try{entries=JSON.parse(source.slice(start+marker.length,end))}catch{throw Error('FEATURED_BLOCKER_GRAPH_CHANGED')}
  if(!Array.isArray(entries)||entries.length!==46||entries.some((x,i)=>!Array.isArray(x)||x[0]!==i+1)||entries[45]?.[1]!=='PUBLISHER_PERMISSION_DENIED_LIBERAL')throw Error('FEATURED_BLOCKER_GRAPH_CHANGED');
  const snapshot=JSON.stringify(entries);if(original!==null&&original!==snapshot)throw Error('FEATURED_BLOCKER_GRAPH_CHANGED');original=snapshot;
  n.parameters.jsCode=source.slice(0,start)+marker+JSON.stringify([...entries,...featuredBlockerEntries])+source.slice(end);
 }
 return g;
}
