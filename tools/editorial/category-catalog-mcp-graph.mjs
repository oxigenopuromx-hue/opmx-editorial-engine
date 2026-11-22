// Candidate graph only. Apply to a freshly fetched active version and verify a
// matching lease before publication. The MCP connection must be refreshed and
// tested separately so the Motor can actually discover the new tool.
export function patchCategoryCatalogGraph(input,{adapterCode,credentials}={}) {
 if(!input||!Array.isArray(input.nodes)||!input.connections||typeof adapterCode!=='string'||!adapterCode.includes('function classifyCategoryCatalog(')||!adapterCode.includes('function formatCategoryCatalog('))throw Error('CATEGORY_GRAPH_INVALID');
 const sites=['OPURO','OPOL','LIBERAL'];
 const urls={OPURO:'https://cms.oxigenopuro.com.mx',OPOL:'https://cms.oxigenopolitico.com.mx',LIBERAL:'https://cms.elliberal.mx'};
 for(const site of sites)if(!credentials?.[site]?.key||!credentials[site].id||!credentials[site].name)throw Error('CATEGORY_CREDENTIAL_MISSING');
 const g=structuredClone(input),node=name=>{const a=g.nodes.filter(n=>n.name===name);if(a.length!==1)throw Error('CATEGORY_GRAPH_CHANGED');return a[0]};
 const protocol=node('Protocolo MCP archivos');node('¿Notificación MCP?');
 const source=protocol.parameters?.jsCode,old=g.connections[protocol.name]?.main?.[0];
 if(typeof source!=='string'||!source.includes('unackRecovery.classifyUnacknowledgedRecovery(')||/\bawait\b/.test(source)||!Array.isArray(old)||old.length!==1||old[0].node!=='¿Notificación MCP?')throw Error('CATEGORY_GRAPH_CHANGED');
 const names=['¿Ruta catálogo editorial?','¿Catálogo OPURO?','¿Catálogo OPOL?','¿Catálogo LIBERAL?','Catálogo OPURO','Catálogo OPOL','Catálogo LIBERAL','Formatear catálogo editorial'];
 if(names.some(name=>g.nodes.some(n=>n.name===name)))throw Error('CATEGORY_GRAPH_CHANGED');
 const inline=adapterCode.replaceAll('export function ','function ');
 protocol.parameters.jsCode=`${inline}\nconst base=(()=>{${source}\n})();\nconst resolved=$input.first().json;let message=resolved.envelope?.body??resolved.envelope;if(typeof message==='string'){try{message=JSON.parse(message)}catch{message={}}}\nreturn [{json:classifyCategoryCatalog(message,base[0].json,resolved.identity)}];`;
 const condition=(name,id,expr,pos)=>({id,name,type:'n8n-nodes-base.if',typeVersion:2.2,position:pos,parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{leftValue:expr,rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}});
 const p=protocol.position??[0,0],gate=condition(names[0],'cat-gate-v1',"={{ $json.route === 'editorial-category-catalog' }}",[p[0]+200,p[1]]);
 const ifs=sites.map((site,i)=>condition(`¿Catálogo ${site}?`,`cat-if-${site.toLowerCase()}-v1`,`={{ $('Protocolo MCP archivos').first().json.request.site === '${site}' }}`,[p[0]+400+i*180,p[1]-200]));
 const https=sites.map((site,i)=>{const c=credentials[site],base=urls[site];return {id:`cat-http-${site.toLowerCase()}-v1`,name:`Catálogo ${site}`,type:'n8n-nodes-base.httpRequest',typeVersion:4.5,position:[p[0]+500+i*180,p[1]-400],parameters:{method:'GET',url:`={{ '${base}/wp-json/wp/v2/categories?per_page=100&orderby=id&order=asc&hide_empty=false&_fields=id,name,slug,parent&page=' + $('Protocolo MCP archivos').first().json.request.page }}`,authentication:c.key==='wordpressApi'?'predefinedCredentialType':'genericCredentialType',...(c.key==='wordpressApi'?{nodeCredentialType:'wordpressApi'}:{genericAuthType:'httpBasicAuth'}),options:{timeout:15000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json',fullResponse:true,neverError:true}}}},credentials:{[c.key]:{id:c.id,name:c.name}},onError:'continueRegularOutput',alwaysOutputData:true}});
 const format={id:'cat-format-v1',name:names[7],type:'n8n-nodes-base.code',typeVersion:2,position:[p[0]+1100,p[1]-400],parameters:{jsCode:`${inline}\nreturn [{json:formatCategoryCatalog($('Protocolo MCP archivos').first().json.request,$input.first().json)}];`}};
 g.nodes.push(gate,...ifs,...https,format);const edge=name=>[{node:name,type:'main',index:0}];
 g.connections[protocol.name].main[0]=edge(gate.name);g.connections[gate.name]={main:[edge(ifs[0].name),edge('¿Notificación MCP?')]};
 for(let i=0;i<sites.length;i++){g.connections[ifs[i].name]={main:[edge(https[i].name),i<sites.length-1?edge(ifs[i+1].name):edge(format.name)]};g.connections[https[i].name]={main:[edge(format.name)]}}
 g.connections[format.name]={main:[edge('Responder MCP')]};return g;
}
