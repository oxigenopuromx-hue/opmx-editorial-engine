// Apply only to a freshly read graph, after the CMS endpoint is deployed.
// Both Publisher and the writer independently fetch the authorized contract.
export function patchHorizonteAuthorityGraph(input,{kind,normalizerCode,credentials}={}) {
 if(!['MCP','WRITER'].includes(kind)||!Array.isArray(input?.nodes)||!input.connections||typeof normalizerCode!=='string'||!normalizerCode.includes('function normalizeHorizonteEditorialClassification(')||!credentials?.id||!credentials?.name)throw Error('HORIZONTE_AUTHORITY_GRAPH_INVALID');
 const g=structuredClone(input),get=name=>{const rows=g.nodes.filter(n=>n.name===name);if(rows.length!==1)throw Error('HORIZONTE_AUTHORITY_GRAPH_CHANGED');return rows[0]};
 const before=kind==='MCP'?'Consultar catálogo Horizonte':'HORIZONTE — Consultar autores';
 const target=kind==='MCP'?'Validar clasificación Horizonte':'HORIZONTE — Confirmar clasificación';
 const endpoint='HORIZONTE — Consultar clasificación editorial';
 get(before);const node=get(target);if(g.nodes.some(n=>n.name===endpoint))throw Error('HORIZONTE_AUTHORITY_GRAPH_CHANGED');
 const lane=g.connections[before]?.main?.[0];if(!Array.isArray(lane)||lane.length!==1||lane[0].node!==target)throw Error('HORIZONTE_AUTHORITY_GRAPH_CHANGED');
 let code=node.parameters?.jsCode;
 const replace=(old,next)=>{if(typeof code!=='string'||code.split(old).length!==2)throw Error('HORIZONTE_AUTHORITY_SOURCE_CHANGED');code=code.replace(old,next)};
 replace(" const errors=[],h=master?.CATEGORIAS?.HORIZONTE;"," const errors=[],h=master?.CATEGORIAS?.HORIZONTE;\n const acceptedTopics=Array.isArray(catalog?.editorialSlugs)?catalog.editorialSlugs:[];");
 replace('!topics.includes(h.PRINCIPAL)','!acceptedTopics.includes(h.PRINCIPAL)');
 replace('!topics.includes(h.TEMA)','!acceptedTopics.includes(h.TEMA)');
 const inline=normalizerCode.replace('export function ','function ');
 code=inline+'\n'+code;
 if(kind==='MCP') {
  replace("horizonteCatalog=normalizeHorizonteCatalog(await fetchHorizonteCatalog())","horizonteCatalog=normalizeHorizonteCatalog(await fetchHorizonteCatalog());horizonteCatalog.editorialSlugs=normalizeHorizonteEditorialClassification($('HORIZONTE — Consultar clasificación editorial').first().json,horizonteCatalog)");
  replace('fetchHorizonteCatalog:async()=>$input.first().json',"fetchHorizonteCatalog:async()=>$('Consultar catálogo Horizonte').first().json");
 } else {
  replace("const catalog=normalizeHorizonteCatalog($('HORIZONTE — Consultar catálogo').first().json),r=$input.first().json;","const catalog=normalizeHorizonteCatalog($('HORIZONTE — Consultar catálogo').first().json),r=$('HORIZONTE — Consultar autores').first().json;\ncatalog.editorialSlugs=normalizeHorizonteEditorialClassification($('HORIZONTE — Consultar clasificación editorial').first().json,catalog);");
  const old="!['politica','economia','sociedad-y-derechos','horizonte-verde','cultura-e-identidad'].includes(topic)",next="(!Array.isArray(catalog?.editorialSlugs)||!catalog.editorialSlugs.includes(topic))";
  for(const name of ['HORIZONTE — Preparar borrador','HORIZONTE — Verificar borrador']){
   const build=get(name),source=build.parameters?.jsCode;
   if(typeof source!=='string'||source.split(old).length!==2)throw Error('HORIZONTE_AUTHORITY_SOURCE_CHANGED');
   build.parameters.jsCode=source.replace(old,next);
  }
 }
 node.parameters.jsCode=code;
 const src=get(before),p=src.position??[0,0];
 g.nodes.push({id:'horizonte-editorial-authority-'+kind.toLowerCase(),name:endpoint,type:'n8n-nodes-base.httpRequest',typeVersion:4.5,position:[p[0]+100,p[1]+100],parameters:{method:'GET',url:'https://cms.horizontedecalifornia.mx/wp-json/ehc/v1/editorial-classification',authentication:'genericCredentialType',genericAuthType:'httpBasicAuth',options:{timeout:15000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json',fullResponse:true,neverError:true}}}},credentials:{httpBasicAuth:{id:credentials.id,name:credentials.name}},onError:'continueRegularOutput',alwaysOutputData:true});
 lane[0].node=endpoint;g.connections[endpoint]={main:[[{node:target,type:'main',index:0}]]};
 return g;
}
