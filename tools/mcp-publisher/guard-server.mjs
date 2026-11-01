import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {reserveDirectPublication,inspectDirectReservation} from './direct-claim.mjs';

const MAX_BODY=4096;
export function createGuard({pool,secret}) {
  if (!pool?.getConnection || typeof secret!=='string' || !/^[a-f0-9]{64,}$/.test(secret)) throw new Error('Configuración incompleta');
  const expected=Buffer.from('Bearer '+secret);
  let windowStart=Date.now(), requestCount=0;
  return createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    const end=(status,value)=>{if(!res.headersSent)res.writeHead(status);res.end(JSON.stringify(value));};
    const now=Date.now();
    if(now-windowStart>=60000){windowStart=now;requestCount=0;}
    if(++requestCount>120){req.resume();res.setHeader('Retry-After','60');return end(429,{error:'rate_limited'});}
    const given=Buffer.from(req.headers.authorization??'');
    if(given.length!==expected.length || !timingSafeEqual(given,expected)) {req.resume();return end(401,{error:'unauthorized'});}
    if(req.method!=='POST'||!['/v1/reservations','/v1/reservations/status'].includes(req.url)) {req.resume();return end(404,{error:'not_found'});}
    if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??'')) {req.resume();return end(415,{error:'content_type'});}
    let data='',size=0;
    try {
      for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY){req.resume();return end(413,{error:'too_large'});}data+=chunk.toString('utf8');}
      const input=JSON.parse(data);
      if(req.url==='/v1/reservations/status') {
        if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).sort().join(',')!=='fingerprint,requestId') return end(400,{error:'invalid_request'});
        const result=await inspectDirectReservation(pool,input);
        return end(200,result);
      }
      if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).sort().join(',')!=='destinations,fingerprint,requestId,slug') return end(400,{error:'invalid_request'});
      const result=await reserveDirectPublication(pool,input);
      return end(result.status==='claimed'?201:409,result);
    } catch(error) {return end(error.message==='Solicitud inválida'||error instanceof SyntaxError?400:503,{error:'not_confirmed'});}
  });
}
