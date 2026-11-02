// Read-only recovery inspection. The ledger cannot prove a WordPress write
// did or did not happen, and this module never grants permission to retry.
const BASE = 'https://publisher.oxigenopuro.com.mx';
const requestIdPattern = /^[A-Za-z0-9_-]{16,128}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const fingerprintPattern = /^[a-f0-9]{64}$/;

export async function inspectRecovery({requestId, slug, destination, fingerprint}, {secret, fetchImpl=fetch, timeoutMs=10000}={}) {
  if (typeof requestId !== 'string' || !requestIdPattern.test(requestId) ||
      typeof slug !== 'string' || slug.length > 200 || !slugPattern.test(slug) ||
      !['OPURO','OPOL'].includes(destination) ||
      typeof fingerprint !== 'string' || !fingerprintPattern.test(fingerprint) ||
      typeof secret !== 'string' || !/^[a-f0-9]{64,}$/.test(secret) ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new Error('Configuración o identidad inválida');
  const common={requestId,slug,destination};
  const checks=[['reservation','reservations/status',{requestId,fingerprint}],['target','targets/status',common],
    ...((destination==='OPURO'?['hero','featured']:['featured']).map(role=>[role,'media/status',{...common,role}]))];
  const results={};
  for (const [name,path,body] of checks) {
    if(name!=='reservation' && !(results.reservation?.status==='claimed' && results.reservation?.identity==='matched')) {
      results[name]={status:'not_queried'};continue;
    }
    try {
      const response=await fetchImpl(`${BASE}/v1/${path}`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(timeoutMs),headers:{authorization:`Bearer ${secret}`,'content-type':'application/json'},body:JSON.stringify(body)});
      if (!response.ok) {results[name]={status:'unavailable'};continue;}
      const data=await response.json();
      if (!data || typeof data!=='object' || Array.isArray(data) || typeof data.status!=='string') {results[name]={status:'unavailable'};continue;}
      // Copy only known scalar fields; never include headers, exception text or
      // arbitrary server responses in the diagnostic output.
      const allowed = name==='reservation' ? ['claimed','not_found','identity_mismatch'] : name==='target' ? ['writing','reported','not_found'] : ['uploading','reported','not_found'];
      if (!allowed.includes(data.status)) {results[name]={status:'unavailable'};continue;}
      const result={status:data.status};
      if(name==='reservation') result.identity=['matched','unverified'].includes(data.identity)?data.identity:null;
      const id=name==='target'?data.postId:name==='reservation'?null:data.mediaId;
      if(id!==undefined && id!==null && /^[1-9][0-9]*$/.test(String(id))) result.id=String(id);
      results[name]=result;
    } catch {results[name]={status:'unavailable'};}
  }
  return {requestId,destination,observed:results,action:'manual_reconciliation',retryPermitted:false,
    note:'Las lecturas son secuenciales y pueden cambiar; el ledger no demuestra el estado de WordPress. Revisar el worker, la nota y los medios antes de actuar.'};
}
