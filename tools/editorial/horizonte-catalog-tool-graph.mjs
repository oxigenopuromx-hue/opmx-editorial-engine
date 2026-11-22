// Extend the already-patched read-only catalog tool with Horizonte's paired
// terms and actual CMS editorial contract, both from fixed authenticated URLs.
export function patchHorizonteCatalogToolGraph(input,{termsCode,authorityCode,formatterCode,credentials}={}) {
 if(!Array.isArray(input?.nodes)||!input.connections||!termsCode?.includes('function normalizeHorizonteCatalog(')||!authorityCode?.includes('function normalizeHorizonteEditorialClassification(')||!formatterCode?.includes('function formatHorizonteCategoryCatalog(')||!credentials?.id||!credentials?.name)throw Error('HORIZONTE_TOOL_GRAPH_INVALID');
 const g=structuredClone(input),get=name=>{const n=g.nodes.filter(x=>x.name===name);if(n.length!==1)throw Error('HORIZONTE_TOOL_GRAPH_CHANGED');return n[0]};
 const last=get('¿Catálogo LIBERAL?'),sink=get('Formatear catálogo editorial'),names=['¿Catálogo HORIZONTE?','Catálogo HORIZONTE términos','Catálogo HORIZONTE autorizadas','Formatear catálogo HORIZONTE'];
 if(names.some(name=>g.nodes.some(n=>n.name===name)))throw Error('HORIZONTE_TOOL_GRAPH_CHANGED');
 const lane=g.connections[last.name]?.main?.[1];if(!Array.isArray(lane)||lane.length!==1||lane[0].node!==sink.name)throw Error('HORIZONTE_TOOL_GRAPH_CHANGED');
 const p=last.position??[0,0],edge=name=>[{node:name,type:'main',index:0}];
 const gate={id:'cat-if-horizonte-v1',name:names[0],type:'n8n-nodes-base.if',typeVersion:2.2,position:[p[0]+200,p[1]],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{leftValue:"={{ $('Protocolo MCP archivos').first().json.request.site === 'HORIZONTE' }}",rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}};
 const http=(name,path,i)=>({id:'cat-horizonte-http-'+i,name,type:'n8n-nodes-base.httpRequest',typeVersion:4.5,position:[p[0]+400+i*180,p[1]],parameters:{method:'GET',url:'https://cms.horizontedecalifornia.mx/wp-json/ehc/v1/'+path,authentication:'genericCredentialType',genericAuthType:'httpBasicAuth',options:{timeout:15000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json',fullResponse:true,neverError:true}}}},credentials:{httpBasicAuth:{id:credentials.id,name:credentials.name}},onError:'continueRegularOutput',alwaysOutputData:true});
 const inline=[termsCode,authorityCode,formatterCode].map(s=>s.replaceAll('export function ','function ')).join('\n');
 const format={id:'cat-horizonte-format-v1',name:names[3],type:'n8n-nodes-base.code',typeVersion:2,position:[p[0]+1000,p[1]],parameters:{jsCode:inline+"\nreturn [{json:formatHorizonteCategoryCatalog($('Protocolo MCP archivos').first().json.request,$('Catálogo HORIZONTE términos').first().json,$input.first().json,normalizeHorizonteCatalog,normalizeHorizonteEditorialClassification)}];"}};
 g.nodes.push(gate,http(names[1],'categories',0),http(names[2],'editorial-classification',1),format);
 lane[0].node=gate.name;g.connections[gate.name]={main:[edge(names[1]),edge(sink.name)]};g.connections[names[1]]={main:[edge(names[2])]};g.connections[names[2]]={main:[edge(names[3])]};g.connections[names[3]]={main:[edge('Responder MCP')]};return g;
}
