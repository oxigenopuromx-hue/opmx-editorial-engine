// Structural audit only: does not validate node semantics, credentials, active
// versions, WordPress APIs used outside n8n, or changes after the snapshot.
const sites=['OPURO','OPOL','LIBERAL'];
const expectedHosts={OPURO:'cms.oxigenopuro.com.mx',OPOL:'cms.oxigenopolitico.com.mx',LIBERAL:'cms.elliberal.mx'};
const draftGuard={OPURO:'GUARD — Verificar destino',OPOL:'GUARD OPOL — Verificar destino',LIBERAL:'GUARD LIBERAL — Verificar destino'};
export function auditWriterGraph({nodes,connections,mode}){
 if(!Array.isArray(nodes)||!connections||!['draft','publication'].includes(mode))throw Error('INVALID_GRAPH');
 const byName=new Map(nodes.map(x=>[x.name,x]));if(byName.size!==nodes.length)throw Error('DUPLICATE_NODE');
 const roots=nodes.filter(n=>/\.(?:webhook|formTrigger|executeWorkflowTrigger)$/i.test(n.type??'')&&!n.disabled).map(n=>n.name);
 if(!roots.length)throw Error('TRIGGER_MISSING');
 function reachable(target,blocked){const q=[...roots],seen=new Set();while(q.length){const node=q.shift();if(node===blocked||seen.has(node))continue;if(node===target)return true;seen.add(node);for(const groups of Object.values(connections[node]??{}))for(const group of groups??[])for(const e of group??[])if(e?.node)q.push(e.node);}return false;}
 const writes=nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest'&&!n.disabled&&['POST','PUT','PATCH','DELETE'].includes(String(n.parameters?.method??'GET').toUpperCase())&&String(n.parameters?.url??'').includes('/wp-json/wp/v2/'));
 if(!writes.length)throw Error('CMS_WRITES_MISSING');
 return writes.map(n=>{
  const url=String(n.parameters.url),matched=sites.filter(s=>url.includes(expectedHosts[s]));
  if(matched.length!==1)return {name:n.name,site:null,guarded:false,reason:'UNKNOWN_HOST'};
  const site=matched[0],guard=mode==='draft'?draftGuard[site]:'Preflight conjunto publicación';
  // n8n can pass data through a disabled node. Merely seeing its name on the
  // graph therefore does not establish that the condition actually runs.
  const gate=byName.get(guard),enabledCode=gate&&!gate.disabled&&gate.type==='n8n-nodes-base.code';
  const isReachable=reachable(n.name,null),guarded=!!enabledCode&&isReachable&&!reachable(n.name,guard);
  // The graph audit cannot prove the server's implementation. The published
  // target/status preflight is a read, not an atomic write claim, and so never
  // establishes the recovery fence. Draft claims need separate attestation of
  // the live server and their graph, not just a node bearing the right name.
  const claimGate='Publicación — Reclamo confirmado';
  const claimNode=byName.get(claimGate);
  const claimGatePresent=mode==='publication'&&!!claimNode&&!claimNode.disabled&&claimNode.type==='n8n-nodes-base.code'&&isReachable&&!reachable(n.name,claimGate);
  return {name:n.name,site,guard,reachable:isReachable,guarded,claimGatePresent,atomicFenceVerified:false};
 });
}
