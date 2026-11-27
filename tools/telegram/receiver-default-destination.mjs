// Correct the receiver's generic default and derive its notice from the same
// persisted policy used to save the real order. No package data is rewritten.
const names=['Normalizar entrada Telegram','Resolver paquete Telegram','Confirmar operación de paquete Telegram'];
const replaceOnce=(source,old,value)=>{if(source.split(old).length!==2)throw Error('RECEIVER_DEFAULT_BASE_CHANGED');return source.replace(old,value)};
export function patchReceiverDefaultDestination(input){
 const g=structuredClone(input),get=name=>{const found=g.nodes.filter(n=>n.name===name);if(found.length!==1||typeof found[0].parameters?.jsCode!=='string')throw Error('RECEIVER_DEFAULT_BASE_CHANGED');return found[0]};
 const resolver=get(names[1]).parameters.jsCode,start=resolver.indexOf('const registries=Object.freeze('),end=resolver.indexOf('\nfunction attestedControl(',start);
 if(start<0||end<=start||resolver.includes('RECEIVER_DEFAULT_NOTICE_V1'))throw Error('RECEIVER_DEFAULT_BASE_CHANGED');
 const policyBundle=resolver.slice(start,end);
 for(const declaration of ['function resolveVersionedDestinations(','function versionedDestinationLabel(','function parseVersionedDestinationCommand('])if(policyBundle.split(declaration).length!==2)throw Error('RECEIVER_DEFAULT_POLICY_MISSING');
 if(!policyBundle.includes("'publish-ambos-v4'"))throw Error('RECEIVER_DEFAULT_POLICY_MISSING');
 for(const name of names){const n=get(name);n.parameters.jsCode=replaceOnce(n.parameters.jsCode,"resolveDestinations(match[2] ?? 'TODOS')","resolveDestinations(match[2] ?? 'AMBOS')")}
 const confirm=get(names[2]),old="function modeMatch(s){try{const x=parseDestinationCommand(s);return [null,x.mode==='PUBLISH'?'publicar':'borrador',x.destination];}catch{return null;}}",replacement="function modeMatch(s,policy){try{const x=parseVersionedDestinationCommand(s,policy);return [null,x.mode==='PUBLISH'?'publicar':'borrador',x.destination];}catch{return null;}}";
 confirm.parameters.jsCode='// RECEIVER_DEFAULT_NOTICE_V1\n'+policyBundle+'\n'+replaceOnce(confirm.parameters.jsCode,old,replacement);
 confirm.parameters.jsCode=replaceOnce(confirm.parameters.jsCode,'modeMatch(context.text.trim())','modeMatch(context.text.trim(),context.session_policy)');
 confirm.parameters.jsCode=replaceOnce(confirm.parameters.jsCode,"const image=/^(?:\\/imagen", "if(context.mode_attested===true&&isMode(context.text.trim())&&!mode)return response(context,'La instrucción quedó guardada, pero no pude confirmar sus destinos. Consulta /estado antes de /listo.');const image=/^(?:\\/imagen");
 return g;
}
