// Applies the v4 four-site policy to known n8n Code nodes. This is a pure
// preparation step: it does not update or publish any workflow.
const modern="['publish-todos-v3','publish-ambos-v4']";
const oldRegistry="'publish-todos-v3':Object.freeze(['OPURO','OPOL','LIBERAL','HORIZONTE'])";
const allowed="'publish-ambos-v1','publish-todos-v2','publish-todos-v3'";
const oldHelp='Los paquetes nuevos se publican por defecto en TODOS: OXígeno Puro, OXígeno Político, El Liberal y El Horizonte de California. AMBOS incluye OXígeno Puro y OXígeno Político; ACTIVOS incluye esos dos y El Liberal.';
const newHelp='Los paquetes nuevos se publican por defecto en AMBOS: OXígeno Puro y OXígeno Político. TODOS incluye esos dos, El Liberal y El Horizonte de California; ACTIVOS incluye OXígeno Puro, OXígeno Político y El Liberal.';
export function patchV4Code(code,{receiver=false}={}){
 if(typeof code!=='string')throw Error('V4_CODE_INVALID');
 let s=code;
 s=s.replaceAll(oldRegistry,oldRegistry+",'publish-ambos-v4':Object.freeze(['OPURO','OPOL','LIBERAL','HORIZONTE'])");
 s=s.replaceAll(allowed,allowed+",'publish-ambos-v4'");
 // Every equality here is a switch into the existing four-site behavior.
 s=s.replace(/([\w$]+(?:\?\.[\w$]+|\.[\w$]+)*)==='publish-todos-v3'/g,(_,x)=>`${modern}.includes(${x})`);
 if(receiver){
  s=s.replaceAll(oldHelp,newHelp);
  s=s.replace('Por defecto se PUBLICARÁ EN TODOS: OXígeno Puro, OXígeno Político, El Liberal y El Horizonte de California','Por defecto se PUBLICARÁ EN AMBOS: OXígeno Puro y OXígeno Político');
  s=s.replace("policy==='publish-ambos-v1'?'AMBOS':'TODOS'","['publish-ambos-v1','publish-ambos-v4'].includes(policy)?'AMBOS':'TODOS'");
  s=s.replace('const POLICY="publish-todos-v3";','const POLICY="publish-ambos-v4";');
 }
 return s;
}
export function patchV4Graph(graph,{kind}={}){
 if(!graph||!Array.isArray(graph.nodes)||!['receiver','mcp','writer'].includes(kind))throw Error('V4_GRAPH_INVALID');
 const copy=structuredClone(graph),names=[];
 for(const n of copy.nodes){const code=n.parameters?.jsCode;if(typeof code!=='string')continue;const patched=patchV4Code(code,{receiver:kind==='receiver'});if(patched!==code){new Function('$','$input',`return (async()=>{${patched}\n})()`);n.parameters.jsCode=patched;names.push(n.name)}}
 const required=kind==='receiver'?['Preparar paquete Telegram','Resolver paquete Telegram','Confirmar operación de paquete Telegram','Preparar política tras aviso confirmado']:kind==='mcp'?['Formatear fuente privada MCP','Acreditar alcance Publisher','MASTER — Validación estática Shared']:['Acreditar alcance escritor','Preparar MASTER y binarios','Validar y normalizar OPMX MASTER','Resultado consolidado OPMX','Acuse DRAFT — Preparar'];
 if(required.some(x=>!names.includes(x)))throw Error('V4_GRAPH_ANCHOR_CHANGED');
 return {graph:copy,changedNodes:names};
}
