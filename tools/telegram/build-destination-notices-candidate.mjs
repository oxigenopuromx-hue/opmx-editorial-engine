// Offline compiler. It builds n8n node source but does not update or publish workflows.
import {destinationRegistry,resolveDestinations,destinationLabel} from '../mcp-publisher/destinations.mjs';
import {requestTargets,prepareDraftNotice,preparePublicationNotice} from './destination-notices-candidate.mjs';
import {correlationLabels} from './build-destination-receiver-candidate.mjs';
const names={OPURO:'OXígeno Puro',OPOL:'OXígeno Político',LIBERAL:'El Liberal'};
const prelude=[destinationRegistry,resolveDestinations,destinationLabel,requestTargets].map(fn=>fn.toString()).join('\n')+'\nconst names='+JSON.stringify(names)+';\n';
function replacePrepare(source,oldName,finishName,replacement){
 const start=source.indexOf('function '+oldName+'('),end=source.indexOf('function '+finishName+'(');
 if(start<0||end<=start||source.indexOf('function '+oldName+'(',start+1)!==-1)throw Error('PUBLISHER_BASELINE_CHANGED');
 const renamed=replacement.toString().replace(/^function\s+\w+/, 'function '+oldName);
 return prelude+source.slice(0,start)+renamed+'\n'+source.slice(end);
}
export function compileDraftNotice(activeCode){return replacePrepare(activeCode,'prepareDraftNotification','finishDraftNotification',prepareDraftNotice);}
export function compilePublicationNotice(activeCode){return replacePrepare(activeCode,'preparePublicationNotice','finishPublicationNotice',preparePublicationNotice);}
export function compileCorrelations(){const labels=correlationLabels();return `const x=$input.first().json;if(!/^tg_[a-f0-9]{40}$/.test(x.package_id??'')||!Number.isSafeInteger(x.revision)||!/^([1-9][0-9]{0,15})$/.test(x.chat_id??''))return [];return ${JSON.stringify(labels)}.map(destino=>({json:{...x,destino}}));`;}
