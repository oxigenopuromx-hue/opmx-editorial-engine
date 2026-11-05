// Backend credentials are supplied at runtime by trusted host infrastructure.
// No automatic retry after dispatch; timeouts require reconciliation.
export function createN8nSubmit({endpoint, getToken, fetchImpl=fetch}) {
  const url=new URL(endpoint);
  if (url.protocol!=='https:' || url.username || url.password || url.search || url.hash || typeof getToken!=='function') throw new Error('Destino n8n inválido');
  return async payload => {
    if (payload.PUBLICAR !== false) throw new Error('Sólo se admiten borradores');
    const token=await getToken();
    if (typeof token!=='string' || !token || /\s/.test(token)) throw new Error('Credencial n8n no disponible');
    let response;
    try { response=await fetchImpl(url.href,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(120000)}); }
    catch {throw new Error('Resultado n8n desconocido');}
    if (!response.ok) throw new Error('Resultado n8n no confirmado');
    let body;
    try {const text=await response.text();if(text.length>128000)throw Error();body=JSON.parse(text)} catch {throw new Error('Respuesta n8n inválida');}
    const required = payload.CREAR_EN==='AMBOS'?['opuro','opol'] : payload.CREAR_EN==='OPURO'?['opuro']:payload.CREAR_EN==='OPOL'?['opol']:[];
    if(!required.length || body?.status!=='SUCCESS' || body?.mode!=='DRAFT' || required.some(x=>body?.summary?.[x]!=='DRAFT')) throw new Error('Borrador no confirmado');
    return body;
  };
}

