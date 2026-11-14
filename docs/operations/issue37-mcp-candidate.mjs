// Candidate transformation; coordinate the resulting workflow with the
// inspected writer release and the Guard release manifest before activation.
export function acceptOpolHero(graph,writerVersionId){
 if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(writerVersionId))throw Error('INVALID_WRITER_VERSION');
 const out=structuredClone(graph),find=name=>{const n=out.nodes.find(x=>x.name===name);if(!n)throw Error('MISSING_NODE '+name);return n};
 const replace=(s,a,b)=>{if(s.split(a).length!==2)throw Error('UNEXPECTED_SOURCE');return s.replace(a,b)};
 const proto=find('Protocolo MCP archivos');
 proto.parameters.jsCode=replace(proto.parameters.jsCode,"const roles=requested.length===1&&requested[0]==='OPOL'?['master_file','destacada']:['master_file','hero','destacada'];","const roles=requested.length===1&&requested[0]==='OPOL'&&!Object.hasOwn(a,'hero')?['master_file','destacada']:['master_file','hero','destacada'];");
 const decision=find('¿Requiere Hero?');
 decision.parameters.conditions.conditions[0].leftValue="={{ !!$('Protocolo MCP archivos').first().json.request.files.hero }}";
 const shared=find('MASTER — Validación estática Shared');
 const original='\"versionId\":\"bef4649d-38eb-436a-9a13-728750da6b8f\"';
 shared.parameters.jsCode=replace(shared.parameters.jsCode,original,`\"versionId\":\"${writerVersionId}\"`);
 return out;
}
