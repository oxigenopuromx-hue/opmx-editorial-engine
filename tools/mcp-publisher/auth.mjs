// OAuth introspection must be supplied by a trusted authorization server.
// The host must expose correct MCP OAuth discovery before remote use.
export function createAuthenticator({endpoint, clientId, clientSecret, issuer, audience, scope, fetchImpl=fetch, now=()=>Date.now()}) {
  const url=new URL(endpoint);
  if(url.protocol!=='https:' || url.username || url.password || url.hash || !clientId || !clientSecret || !issuer || !audience || !scope) throw new Error('Configuración OAuth incompleta');
  return async token => {
    if(typeof token!=='string' || !token || /\s/.test(token)) throw new Error('No autorizado');
    let response;
    try {
      const enc=value=>new URLSearchParams({v:value}).toString().slice(2);
      response=await fetchImpl(url.href,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'content-type':'application/x-www-form-urlencoded',authorization:`Basic ${Buffer.from(`${enc(clientId)}:${enc(clientSecret)}`).toString('base64')}`},body:new URLSearchParams({token}).toString()});
    } catch { throw new Error('No autorizado'); }
    if(!response.ok)throw new Error('No autorizado');
    let data;try{const text=await response.text();if(text.length>32000)throw Error();data=JSON.parse(text)}catch{throw new Error('No autorizado')}
    const audiences=Array.isArray(data.aud)?data.aud:[data.aud];
    const scopes=typeof data.scope==='string'?data.scope.split(/\s+/):[];
    if(data.active!==true || data.iss!==issuer || !audiences.includes(audience) || !scopes.includes(scope) || typeof data.sub!=='string' || !data.sub || !Number.isFinite(data.exp) || data.exp*1000<=now()) throw new Error('No autorizado');
    return data.sub;
  };
}
