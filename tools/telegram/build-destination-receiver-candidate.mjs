// Offline candidate only: compiles changes onto the documented receiver snapshot.
// The live workflow is not modified. Verify its version and baseline before use.
import {after as baseline} from './build-default-receiver.mjs';
import {destinationRegistry,resolveDestinations,destinationLabel} from '../mcp-publisher/destinations.mjs';
import {parseDestinationCommand} from './destination-command-candidate.mjs';
const source=[destinationRegistry,resolveDestinations,destinationLabel,parseDestinationCommand].map(f=>f.toString()).join('\n');
const helpers=`${source}\nfunction isMode(s) { try { parseDestinationCommand(s); return true; } catch { return false; } }\nfunction validControl(s) { return s==='/nuevo'||s==='/listo'||isMode(s); }\n`;
function replaceOnce(s,old,replacement){if(s.split(old).length!==2)throw Error('Unexpected receiver baseline: '+old.slice(0,80));return s.replace(old,replacement);}
function build(){
 const nodes=structuredClone(baseline.nodes);
 const get=name=>nodes.find(n=>n.name===name).parameters;
 let n=get('Normalizar entrada Telegram').jsCode;
 n=replaceOnce(n,String.raw`/^\/(?:publicar|borrador)(?:\s+(?:ambos|opuro|opol))?$/i.test(command)`, 'isMode(command)');
 const old=String.raw`/^(?:\/(?:publicar|borrador|nuevo|listo)(?:\s+(?:ambos|opuro|opol))?$|\/imagen\s+generar$|(?:genera|generar|crea|crear)\s+(?:una\s+)?(?:imagen|ilustraci[oó]n)[^\n]{0,180}(?:\n|$))/i.test(m.text.trim())`;
 const replacement=String.raw`(isMode(m.text.trim()) || /^\/(?:nuevo|listo)$/i.test(m.text.trim()) || /^(?:\/imagen\s+generar$|(?:genera|generar|crea|crear)\s+(?:una\s+)?(?:imagen|ilustraci[oó]n)[^\n]{0,180}(?:\n|$))/i.test(m.text.trim()))`;
 if(n.split(old).length!==3)throw Error('Unexpected normalizer controls');n=n.split(old).join(replacement);
 n=n.replace('Usa /publicar ambos, /publicar opuro, /publicar opol o /borrador ambos.','Usa /publicar o /borrador con opuro, opol, liberal, ambos, todos o una lista separada por comas.');
 get('Normalizar entrada Telegram').jsCode=helpers+n;
 let p=get('Resolver paquete Telegram').jsCode;
 p=replaceOnce(p,String.raw`/^\/(?:nuevo|listo|publicar|borrador)(?:\s+(?:ambos|opuro|opol))?$/i.test(command)`, 'validControl(command)');
 p=replaceOnce(p,String.raw`/^\/(?:publicar|borrador)(?:\s+(?:ambos|opuro|opol))?$/i.test(x.text.trim())`, 'isMode(x.text.trim())');
 get('Resolver paquete Telegram').jsCode=helpers+p;
 return nodes;
}
export const candidateNodes=build();
// Complete set of canonical destination labels for request_id correlation.
export function correlationLabels() {
 const keys=Object.keys(destinationRegistry()), labels=[];
 for(let mask=1;mask<(1<<keys.length);mask++)labels.push(destinationLabel(keys.filter((_,i)=>mask&(1<<i))));
 return labels;
}
