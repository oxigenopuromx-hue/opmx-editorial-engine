import {patchWriterSitesLiveProof} from './writer-sites-live-proof-patch.mjs';
import {patchWriterResolverId} from './writer-resolver-id-patch.mjs';

// Add OPURO/LIBERAL proof branches on a clone which already has the OPOL
// proof graph. The MCP and writer each query independently before writes.
export function patchSitesLiveGraph(input,{kind,proofCode,credentials}={}) {
 if(!['MCP','WRITER'].includes(kind)||!Array.isArray(input?.nodes)||!input.connections||typeof proofCode!=='string'||!proofCode.includes('function buildSiteCategoryProof('))throw Error('SITE_GRAPH_INVALID');
 for(const site of ['OPURO','LIBERAL'])if(!credentials?.[site]?.id||!credentials[site].name||!credentials[site].key)throw Error('SITE_CREDENTIAL_MISSING');
 const g=structuredClone(input),get=name=>{const x=g.nodes.filter(n=>n.name===name);if(x.length!==1)throw Error('SITE_GRAPH_CHANGED');return x[0]};
 const target=get(kind==='MCP'?'MASTER — Validación estática Shared':'Validar y normalizar OPMX MASTER');
 get('Acreditar alcance '+(kind==='MCP'?'Publisher':'escritor'));
 const entryName='Categorías por sitio — Entrada';if(g.nodes.some(n=>n.name===entryName))throw Error('SITE_GRAPH_CHANGED');
 let changed=0;for(const v of Object.values(g.connections))for(const lanes of Object.values(v))if(Array.isArray(lanes))for(const lane of lanes??[])for(const edge of lane??[])if(edge.node===target.name){edge.node=entryName;changed++}
 if(changed!==2)throw Error('SITE_GRAPH_CHANGED');
 target.parameters.jsCode=patchWriterSitesLiveProof(target.parameters.jsCode);
 if(kind==='WRITER')for(const site of ['OPURO','LIBERAL']){const resolver=get(`${site} — Resolver categoría`);resolver.parameters.jsCode=patchWriterResolverId(resolver.parameters.jsCode,site);if(site==='LIBERAL'){const preflight=get('LIBERAL — Verificar categoría preflight');preflight.parameters.jsCode=patchWriterResolverId(preflight.parameters.jsCode,site)}}
 const p=target.position??[0,0],entry={id:`site-entry-${kind.toLowerCase()}-v1`,name:entryName,type:'n8n-nodes-base.code',typeVersion:2,position:[p[0]-900,p[1]-400],parameters:{jsCode:'return $input.all();'}};
 const nodes=[entry],edge=name=>[{node:name,type:'main',index:0}],routes={},sites=['OPURO','LIBERAL'];
 for(const [i,site] of sites.entries()){
  const gateName=`¿Catálogo ${site} vivo?`,httpName=`${site} — Leer catálogo vivo`,proofName=`Categoría ${site} — Verificar catálogo`,c=credentials[site],host=site==='OPURO'?'https://cms.oxigenopuro.com.mx':'https://cms.elliberal.mx';
  if([gateName,httpName,proofName].some(name=>g.nodes.some(n=>n.name===name)))throw Error('SITE_GRAPH_CHANGED');
  const dest=kind==='MCP'?"$('Acreditar alcance Publisher').first().json.request.destino":"$json.CREAR_EN",accepted=site==='OPURO'?['OPURO','AMBOS','ACTIVOS','TODOS']:['LIBERAL','ACTIVOS','TODOS'];
  const expr=`={{ String(${dest} ?? '').split(',').map(x => x.trim().toUpperCase()).some(x => ${JSON.stringify(accepted)}.includes(x)) }}`;
  const gate={id:`site-gate-${kind.toLowerCase()}-${site.toLowerCase()}`,name:gateName,type:'n8n-nodes-base.if',typeVersion:2.2,position:[p[0]-700+i*260,p[1]-400],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{leftValue:expr,rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}};
  const http={id:`site-http-${kind.toLowerCase()}-${site.toLowerCase()}`,name:httpName,type:'n8n-nodes-base.httpRequest',typeVersion:4.5,position:[p[0]-600+i*260,p[1]-560],parameters:{method:'GET',url:`${host}/wp-json/wp/v2/categories?per_page=100&orderby=id&order=asc&hide_empty=false&_fields=id,name,slug,parent`,authentication:c.key==='wordpressApi'?'predefinedCredentialType':'genericCredentialType',...(c.key==='wordpressApi'?{nodeCredentialType:'wordpressApi'}:{genericAuthType:'httpBasicAuth'}),options:{timeout:15000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json',fullResponse:true,neverError:true}},pagination:{pagination:{paginationMode:'updateAParameterInEachRequest',parameters:{parameters:[{type:'qs',name:'page',value:'={{ $pageCount + 1 }}'}]},paginationCompleteWhen:'other',completeExpression:"={{ $response.statusCode !== 200 || !/^[1-9][0-9]{0,2}$/.test(String($response.headers?.['x-wp-totalpages'] ?? '')) || $pageCount >= Number($response.headers['x-wp-totalpages']) }}",limitPagesFetched:true,maxRequests:100}}}},credentials:{[c.key]:{id:c.id,name:c.name}},onError:'continueRegularOutput',alwaysOutputData:true};
  const prep=kind==='MCP'?`const ctx=$('Acreditar alcance Publisher').first().json,r=ctx.request,scope=ctx.scope,m=original.json?.payload?.master;const sentinel=m?.CONTROL_EDITORIAL?.MODO_CONTENIDO==='LITERAL'?m?.CONTROL_EDITORIAL?.LITERAL?.REQUEST_ID:'opmx_static_preflight_no_write';const prepared={json:JSON.stringify(m),CREAR_EN:r.destino,request_id:r.request_id??sentinel};`:`const ctx=$('Acreditar alcance escritor').first().json,scope=ctx.scope,prepared=original.json;`;
  const tail=`\nconst original=$('${entryName}').first();${prep}const categoryProof=buildSiteCategoryProof({site:'${site}',prepared,scopeApproved:ctx.scopeApproved,scope,responses:$input.all().map(x=>x.json)});return [{json:{...original.json,categoryProof},binary:original.binary}];`;
  const verify={id:`site-proof-${kind.toLowerCase()}-${site.toLowerCase()}`,name:proofName,type:'n8n-nodes-base.code',typeVersion:2,position:[p[0]-460+i*260,p[1]-560],parameters:{mode:'runOnceForAllItems',jsCode:proofCode+tail}};
  nodes.push(gate,http,verify);routes[site]={gateName,httpName,proofName};
 }
 g.nodes.push(...nodes);g.connections[entryName]={main:[edge(routes.OPURO.gateName)]};
 for(const [i,site] of sites.entries()){const r=routes[site],next=i+1<sites.length?routes[sites[i+1]].gateName:target.name;g.connections[r.gateName]={main:[edge(r.httpName),edge(next)]};g.connections[r.httpName]={main:[edge(r.proofName)]};g.connections[r.proofName]={main:[edge(next)]}}
 return g;
}
