import {patchWriterNormalizerIds} from './writer-normalizer-id-patch.mjs';
import {patchWriterOpolLiveProof} from './writer-opol-live-proof-patch.mjs';

// Candidate only. Its authenticated proof node must remain between the file
// checks and static normalizer, and the writer must independently revalidate.
export function patchMcpOpolLiveGraph(input,{proofCode,credential}={}) {
 if(!input||!Array.isArray(input.nodes)||!input.connections||typeof proofCode!=='string'||!proofCode.includes('function buildOpolCategoryProof(')||!credential?.id||!credential?.name)throw Error('MCP_OPOL_GRAPH_INVALID');
 const g=structuredClone(input),get=name=>{const x=g.nodes.filter(n=>n.name===name);if(x.length!==1)throw Error('MCP_OPOL_GRAPH_CHANGED');return x[0]};
 const shared=get('MASTER — Validación estática Shared'),rejected=get('Archivo rechazado');get('¿Requiere Hero?');get('Comprobar Hero');get('Acreditar alcance Publisher');
 for(const name of ['Categoría OPOL — Entrada','¿MCP catálogo OPOL?','MCP OPOL — Leer páginas','Categoría OPOL — Verificar catálogo'])if(g.nodes.some(x=>x.name===name))throw Error('MCP_OPOL_GRAPH_CHANGED');
 const oldNames=['¿Requiere Hero?','Comprobar Hero'];let rewired=0;
 for(const name of oldNames){const lanes=g.connections[name]?.main;if(!Array.isArray(lanes))throw Error('MCP_OPOL_GRAPH_CHANGED');for(const lane of lanes??[])for(const edge of lane??[])if(edge.node===shared.name){edge.node='Categoría OPOL — Entrada';rewired++}}
 if(rewired!==2)throw Error('MCP_OPOL_GRAPH_CHANGED');
 let js=patchWriterOpolLiveProof(patchWriterNormalizerIds(shared.parameters.jsCode));
 const prefix="['CATEGORIA_OPOL_NO_AUTORIZADA:'";
 if(js.split(prefix).length!==2)throw Error('MCP_OPOL_GRAPH_CHANGED');
 js=js.replace(prefix,"['OPOL_CATEGORY_PROOF_','OPOL_CATEGORY',['CATEGORIAS.OPOL.PRINCIPAL']],\n  "+prefix);
 const legacy="\"normalizerSha256\":\"2538657e6a8310295898dd5459d7cdfa4dd078db9852e4bc88ea6fffb0f632eb\"";
 if(js.split(legacy).length!==2)throw Error('MCP_OPOL_GRAPH_CHANGED');
 js=js.replace(legacy,'"normalizerSha256":"CANDIDATE_NOT_RELEASED"');shared.parameters.jsCode=js;
 const errorAnchor="else if(raw.includes('HORIZONTE_PREFLIGHT_UNCONFIRMED'))";
 if(typeof rejected.parameters?.jsCode!=='string'||rejected.parameters.jsCode.split(errorAnchor).length!==2)throw Error('MCP_OPOL_GRAPH_CHANGED');
 rejected.parameters.jsCode=rejected.parameters.jsCode.replace(errorAnchor,"else if(raw.includes('OPOL_CATEGORY_PROOF_UNCONFIRMED'))result={status:'VALIDATION_FAILED',field:'CATEGORIAS.OPOL',message:'No se pudo confirmar la categoría de OPOL en su catálogo actual.',writesStarted:false,retryPermitted:false};\n"+errorAnchor);
 const p=shared.position??[0,0],entry={id:'mcp-opol-entry-v1',name:'Categoría OPOL — Entrada',type:'n8n-nodes-base.code',typeVersion:2,position:[p[0]-700,p[1]-200],parameters:{jsCode:'return $input.all();'}};
 const gate={id:'mcp-opol-gate-v1',name:'¿MCP catálogo OPOL?',type:'n8n-nodes-base.if',typeVersion:2.2,position:[p[0]-500,p[1]-200],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{leftValue:"={{ String($('Acreditar alcance Publisher').first().json.request.destino ?? '').split(',').map(x => x.trim().toUpperCase()).some(x => ['OPOL','AMBOS','ACTIVOS','TODOS'].includes(x)) }}",rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}};
 const http={id:'mcp-opol-pages-v1',name:'MCP OPOL — Leer páginas',type:'n8n-nodes-base.httpRequest',typeVersion:4.5,position:[p[0]-320,p[1]-300],parameters:{method:'GET',url:'https://cms.oxigenopolitico.com.mx/wp-json/wp/v2/categories?per_page=100&orderby=id&order=asc&hide_empty=false&_fields=id,name,slug,parent',authentication:'genericCredentialType',genericAuthType:'httpBasicAuth',options:{timeout:15000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json',fullResponse:true,neverError:true}},pagination:{pagination:{paginationMode:'updateAParameterInEachRequest',parameters:{parameters:[{type:'qs',name:'page',value:'={{ $pageCount + 1 }}'}]},paginationCompleteWhen:'other',completeExpression:"={{ $response.statusCode !== 200 || !/^[1-9][0-9]{0,2}$/.test(String($response.headers?.['x-wp-totalpages'] ?? '')) || $pageCount >= Number($response.headers['x-wp-totalpages']) }}",limitPagesFetched:true,maxRequests:100}}}},credentials:{httpBasicAuth:{id:credential.id,name:credential.name}},onError:'continueRegularOutput',alwaysOutputData:true};
 const tail=`\ntry{const original=$('Categoría OPOL — Entrada').first(),ctx=$('Acreditar alcance Publisher').first().json,r=ctx.request,scope=ctx.scope;const m=original.json?.payload?.master;const declared=m?.CONTROL_EDITORIAL?.MODO_CONTENIDO;const sentinel=declared==='LITERAL'?m?.CONTROL_EDITORIAL?.LITERAL?.REQUEST_ID:'opmx_static_preflight_no_write';const requestId=r.request_id??sentinel;const prepared={json:JSON.stringify(m),CREAR_EN:r.destino,request_id:requestId};const categoryProof=buildOpolCategoryProof({prepared,scopeApproved:ctx.scopeApproved,scope,responses:$input.all().map(x=>x.json)});return [{json:{...original.json,categoryProof},binary:original.binary}]}catch{throw Error('OPOL_CATEGORY_PROOF_UNCONFIRMED')};`;
 const verify={id:'mcp-opol-proof-v1',name:'Categoría OPOL — Verificar catálogo',type:'n8n-nodes-base.code',typeVersion:2,onError:'continueErrorOutput',position:[p[0]-140,p[1]-300],parameters:{mode:'runOnceForAllItems',jsCode:proofCode+tail}};
 const edge=name=>[{node:name,type:'main',index:0}];g.nodes.push(entry,gate,http,verify);g.connections[entry.name]={main:[edge(gate.name)]};g.connections[gate.name]={main:[edge(http.name),edge(shared.name)]};g.connections[http.name]={main:[edge(verify.name)]};g.connections[verify.name]={main:[edge(shared.name),edge(rejected.name)]};return g;
}
