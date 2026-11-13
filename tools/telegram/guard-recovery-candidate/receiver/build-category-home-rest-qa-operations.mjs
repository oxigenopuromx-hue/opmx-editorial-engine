const root='https://cms.oxigenopuro.com.mx/wp-json/wp/v2';
const p='QA13 — ';
const edge=(type,source,target)=>({type,source,target,sourceIndex:0,targetIndex:0,connectionType:'main'});

// Temporary, inactive manual probe. Only the caller applies these operations
// and restores the three-node original afterwards. Existing WordPress Basic
// credential bindings are reused by ID; no credential value enters this file.
export function buildCategoryHomeRestQaOperations(probe,opuroHttpTemplate,{expectedVersionId,categoryId,qaId}) {
 if(!probe||probe.id!=='7IDUF9PeHQ5v331Z'||probe.active!==false||probe.versionId!==expectedVersionId||probe.nodes?.length!==3||!/^qa13_[a-f0-9]{12}$/.test(qaId??'')||!Number.isSafeInteger(categoryId)||categoryId<1)throw Error('QA13_PROBE_BASE_CHANGED');
 const triggers=probe.nodes.filter(n=>n.type==='n8n-nodes-base.manualTrigger');if(triggers.length!==1)throw Error('QA13_TRIGGER_CHANGED');
 const template=opuroHttpTemplate;
 if(template?.type!=='n8n-nodes-base.httpRequest'||template.parameters?.genericAuthType!=='httpBasicAuth'||!template.credentials?.httpBasicAuth?.id)throw Error('QA13_CREDENTIAL_BINDING_UNCONFIRMED');
 const slug=qaId.replace('_','-'),title='OPMX QA13 · fixture desechable',post="$('QA13 — Crear fixture').first().json.body.id";
 const nodes=[];
 const addHttp=(name,method,path,body)=>{const node={name:p+name,id:qaId+'_'+nodes.length,type:'n8n-nodes-base.httpRequest',typeVersion:template.typeVersion??4.2,position:[300+nodes.length*230,0],credentials:{httpBasicAuth:structuredClone(template.credentials.httpBasicAuth)},parameters:{method,url:path,authentication:'genericCredentialType',genericAuthType:'httpBasicAuth',...(body?{sendBody:true,specifyBody:'json',jsonBody:JSON.stringify(body)}:{}),options:{timeout:20000,redirect:{redirect:{followRedirects:false}},response:{response:{fullResponse:true,neverError:true,responseFormat:'json'}}}},retryOnFail:false,onError:'stopWorkflow'};nodes.push(node);};
 const addCode=(name,jsCode)=>nodes.push({name:p+name,id:qaId+'_'+nodes.length,type:'n8n-nodes-base.code',typeVersion:2,position:[300+nodes.length*230,0],parameters:{mode:'runOnceForAllItems',jsCode},retryOnFail:false,onError:'stopWorkflow'});
 const identity=`const r=$input.first().json,postId=${post},b=r.body;\nif(r.statusCode!==200||!Number.isSafeInteger(postId)||postId<1||b?.id!==postId||b.type!=='post'||b.slug!==${JSON.stringify(slug)}||b.status!=='draft'||b.title?.raw!==${JSON.stringify(title)})throw Error('QA13_FIXTURE_IDENTITY_UNCONFIRMED');\n`;
 const check=(name,ids,extra='')=>addCode(name,identity+`if(!Array.isArray(b.categories)||!b.categories.includes(${categoryId})||!Array.isArray(b.meta?.oxpuro_excluded_category_ids)||JSON.stringify(b.meta.oxpuro_excluded_category_ids)!==${JSON.stringify(JSON.stringify(ids))}||b.meta.oxpuro_exclude_home!==true)throw Error('QA13_METADATA_UNCONFIRMED');\n${extra}\nreturn [{json:{postId,checks:${ids.length?5:7},fixtureOnly:true}}];`);
 const postPath=`={{ '${root}/posts/' + ${post} }}`;
 const readPath=`={{ '${root}/posts/' + ${post} + '?context=edit' }}`;
 addHttp('Leer esquema','OPTIONS',root+'/posts');
 addCode('Verificar esquema',"const r=$input.first().json,f=r.body?.schema?.properties?.meta?.properties?.oxpuro_excluded_category_ids;if(r.statusCode!==200||f?.type!=='array'||f.items?.type!=='string')throw Error('QA13_REST_SCHEMA');return [{json:{schemaVerified:true}}];");
 addHttp('Leer categoría','GET',root+'/categories/'+categoryId);
 addCode('Verificar categoría',`const r=$input.first().json;if(r.statusCode!==200||r.body?.id!==${categoryId}||typeof r.body.slug!=='string')throw Error('QA13_CATEGORY_UNCONFIRMED');return [{json:{categoryVerified:true}}];`);
 addHttp('Crear fixture','POST',root+'/posts',{title,slug,status:'draft',content:'<!-- wp:paragraph --><p>Fixture técnico desechable. No publicar.</p><!-- /wp:paragraph -->',excerpt:'Fixture QA13',categories:[categoryId],meta:{oxpuro_exclude_home:true}});
 addCode('Verificar creación',`const r=$input.first().json,b=r.body;if(r.statusCode!==201||!Number.isSafeInteger(b?.id)||b.id<1||b.slug!==${JSON.stringify(slug)}||b.status!=='draft'||b.type!=='post'||b.title?.raw!==${JSON.stringify(title)})throw Error('QA13_CREATE_UNCONFIRMED');return [{json:{postId:b.id,fixtureOnly:true}}];`);
 addHttp('Readback omitido','GET',readPath);check('Verificar omitido',[]);
 addHttp('Excluir categoría','POST',postPath,{meta:{oxpuro_excluded_category_ids:[String(categoryId)]}});
 addHttp('Readback excluido','GET',readPath);check('Verificar exclusión',[String(categoryId)]);
 addHttp('Actualizar sin exclusiones','POST',postPath,{excerpt:'Fixture QA13 · actualización sin exclusiones',meta:{oxpuro_editorial:{subtitle:'Fixture QA13'}}});
 addHttp('Readback preservación','GET',readPath);check('Verificar preservación',[String(categoryId)],"if(b.excerpt?.raw!=='Fixture QA13 · actualización sin exclusiones')throw Error('QA13_EXCERPT_UNCONFIRMED');");
 addHttp('Vaciar explícitamente','POST',postPath,{meta:{oxpuro_excluded_category_ids:[]}});
 addHttp('Readback vacío','GET',readPath);check('Verificar vacío',[]);
 addHttp('Papelera fixture','DELETE',`={{ '${root}/posts/' + ${post} + '?force=false' }}`);
 addCode('Resultado',`const r=$input.first().json,id=${post};if(r.statusCode!==200||r.body?.id!==id||r.body.status!=='trash')throw Error('QA13_CLEANUP_UNCONFIRMED');return [{json:{status:'CATEGORY_HOME_REST_QA_PASSED',checks:7,postId:id,fixtureSlug:${JSON.stringify(slug)},cleanup:'TRASHED',cmsPublished:0,telegramMessages:0,realEditorialPostsModified:0,retryPermitted:false}}];`);
 const old=probe.connections?.[triggers[0].name]?.main?.[0];if(!Array.isArray(old)||old.length!==1||old[0].index!==0)throw Error('QA13_TRIGGER_EDGE_CHANGED');
 return [...nodes.map(node=>({type:'addNode',node})),edge('removeConnection',triggers[0].name,old[0].node),edge('addConnection',triggers[0].name,nodes[0].name),...nodes.slice(0,-1).map((n,i)=>edge('addConnection',n.name,nodes[i+1].name)),{type:'addNodeGroup',id:'01c00e8f-c949-4127-8652-f9784b95433a',name:'QA13 · fixture OPURO desechable',description:'Sólo borrador propio con identidad verificada, metadatos y papelera; sin publicaciones ni reintentos.',nodeNames:nodes.map(n=>n.name)}];
}
