// Release preparation checks, not a runtime grant. The resulting fingerprint
// must still be compared to authoritative active snapshots by the Guard.
function reachable(graph,target,blocked=null,start=null){
 const roots=start??graph.nodes.filter(n=>/\.(webhook|formTrigger|executeWorkflowTrigger)$/.test(n.type)&&!n.disabled).map(n=>n.name),seen=new Set(),queue=[...roots];
 while(queue.length){const n=queue.shift();if(n===blocked||seen.has(n))continue;if(n===target)return true;seen.add(n);for(const lists of Object.values(graph.connections[n]??{}))for(const group of lists)for(const edge of group)queue.push(edge.node)}return false;
}
const fail=()=>{throw Error('WRITER_RELEASE_AUDIT_FAILED')};
function fixedCmsOrigin(value,host){
 if(typeof value!=='string')return false;
 const expression=/^=\{\{\s*(['"])([^'"]+)\1/.exec(value),literal=expression?.[2]??value;
 let url;try{url=new URL(literal)}catch{return false}
 if(url.protocol!=='https:'||url.hostname!==host||url.username||url.password||url.port||url.hash||url.search)return false;
 if(url.pathname.startsWith('/wp-json/wp/v2/'))return true;
 return !!expression&&url.pathname==='/'&&/^\s*\+\s*(['"])\/wp-json\/wp\/v2\//.test(value.slice(expression[0].length));
}
function fixedCmsCredential(node,site){
 const key=site==='LIBERAL'?'wordpressApi':'httpBasicAuth',id={OPURO:'KItac8AMmbUVUbWY',OPOL:'9mL9HGLYoSVIGfQ1',LIBERAL:'UI3HOKE26hMVLvH0'}[site];
 return node.credentials?.[key]?.id===id&&(key==='wordpressApi'?node.parameters.authentication==='predefinedCredentialType'&&node.parameters.nodeCredentialType===key:node.parameters.authentication==='genericCredentialType'&&node.parameters.genericAuthType===key);
}
export function auditWriterReleaseGraph(id,graph){
 if(!Array.isArray(graph?.nodes)||!graph.connections||new Set(graph.nodes.map(n=>n.name)).size!==graph.nodes.length)fail();
 const byName=new Map(graph.nodes.map(n=>[n.name,n]));
 const writes=graph.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest'&&!n.disabled&&['POST','PUT','PATCH','DELETE'].includes(n.parameters?.method)&&/wp-json/.test(n.parameters?.url));
 const errorReaches=(name,target)=>reachable(graph,target,null,(graph.connections[name]?.main?.[1]??[]).map(e=>e.node));
 if(id==='4o7K5TmKc7joScqB'){
  if(writes.length!==21)fail();
  for(const write of writes){
   const site=['OPURO','OPOL','LIBERAL'].find(s=>write.name.startsWith(s+' —')),host={OPURO:'cms.oxigenopuro.com.mx',OPOL:'cms.oxigenopolitico.com.mx',LIBERAL:'cms.elliberal.mx'}[site];
   const gate=site==='OPURO'?'GUARD — Verificar destino':`GUARD ${site} — Verificar destino`,claim=site==='OPURO'?'GUARD — Iniciar destino':`GUARD ${site} — Iniciar destino`,n=byName.get(gate),c=byName.get(claim);
   if(!site||!fixedCmsOrigin(write.parameters.url,host)||!fixedCmsCredential(write,site)||n?.disabled||n?.type!=='n8n-nodes-base.code'||!n.parameters.jsCode.includes('write_started')||!n.parameters.jsCode.includes('throw')||n.onError==='continueRegularOutput'||c?.parameters?.url!=='https://publisher.oxigenopuro.com.mx/v1/targets/begin'||c.credentials?.httpHeaderAuth?.id!=='SpcCy6Qf3qP7xhf6'||!reachable(graph,write.name)||reachable(graph,write.name,gate)||reachable(graph,gate,claim)||errorReaches(gate,write.name))fail();
  }
  // A reported target may still have metadata writes. Such a tail must not
  // suspend durably and later resume writing while status pages change. If
  // a destination is still before its post report, its writing/null-ID ledger
  // row independently prevents reconciliation.
  for(const site of ['OPURO','OPOL','LIBERAL']){
   const report=graph.nodes.find(n=>n.parameters?.url==='https://publisher.oxigenopuro.com.mx/v1/targets/report'&&n.parameters.jsonBody?.includes(`destination:'${site}'`));
   if(!report)fail();
   for(const wait of graph.nodes.filter(n=>n.type==='n8n-nodes-base.wait'))if(reachable(graph,wait.name,null,[report.name])&&writes.some(w=>w.name.startsWith(site+' —')&&reachable(graph,w.name,null,[wait.name])))fail();
  }
 }else if(['bnzVMNkZuGO1GQCZ','Mt7ts2EGPbyaTC2o'].includes(id)){
  if(writes.length!==3)fail();
  const prepare=byName.get('Preparar barrera publicación'),check=byName.get('Publicación — Reclamo confirmado'),claim=byName.get('Reclamar publicación Telegram');
  if(prepare?.disabled||check?.disabled||!prepare?.parameters?.jsCode.includes('writeNeeded')||!check?.parameters?.jsCode.includes('PUBLICATION_STARTED')||claim?.parameters?.url!=='https://publisher.oxigenopuro.com.mx/v1/telegram/publications/begin'||claim?.credentials?.httpHeaderAuth?.id!=='SpcCy6Qf3qP7xhf6'||claim.retryOnFail!==false||check.onError==='continueRegularOutput'||prepare.onError==='continueRegularOutput')fail();
  for(const wait of graph.nodes.filter(n=>n.type==='n8n-nodes-base.wait'||n.type==='n8n-nodes-base.form'&&n.parameters?.operation!=='completion'))if(reachable(graph,wait.name,null,[claim.name])&&writes.some(w=>reachable(graph,w.name,null,[wait.name])))fail();
  for(const write of writes){const site=['OPURO','OPOL','LIBERAL'].find(s=>write.name===`Publicación — Publicar ${s}`),host={OPURO:'cms.oxigenopuro.com.mx',OPOL:'cms.oxigenopolitico.com.mx',LIBERAL:'cms.elliberal.mx'}[site];if(!site||!fixedCmsOrigin(write.parameters.url,host)||!fixedCmsCredential(write,site)||!reachable(graph,write.name)||reachable(graph,write.name,prepare.name)||errorReaches(prepare.name,write.name)||errorReaches(check.name,write.name)||errorReaches(claim.name,write.name))fail();}
 }else if(id==='C4hk6fQQomueYC8f'){
  if(writes.length||graph.nodes.some(n=>n.type==='n8n-nodes-base.executeWorkflow'))fail();
  for(const n of graph.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest'))if(n.parameters.method!=='GET'&&n.parameters.url!=='https://publisher.oxigenopuro.com.mx/v1/recovery/status')fail();
 }else fail();
 return {workflowId:id,cmsWriteNodes:writes.length,releasePathsChecked:true};
}
