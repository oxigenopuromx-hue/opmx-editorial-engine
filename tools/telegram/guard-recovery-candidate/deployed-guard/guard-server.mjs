import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {reserveDirectPublication,inspectDirectReservation} from './direct-claim.mjs';
import {beginTargetWrite,recordTargetPost,inspectTargetProgress} from './target-progress.mjs';
import {beginMediaUpload,recordMediaUpload,inspectMediaUpload} from './media-progress.mjs';

const MAX_BODY=4096;
// Integration candidate derived from the verified last-source blob 7881ae8.
// Recovery and writer hooks are opt-in; production is not changed by this file.
export function createGuard({pool,secret,diagnosticLogger=console.error,telegramStore=null,telegramEvents=null,telegramReviews=null,telegramRecovery=null,telegramBlockedList=null,telegramAttempts=null,telegramCorrections=null,telegramSelections=null,telegramPreviewDelivery=null,telegramPublicationBegin=null,targetBegin=beginTargetWrite}) {
  if (!pool?.getConnection || typeof secret!=='string' || !/^[a-f0-9]{64,}$/.test(secret)) throw new Error('Configuración incompleta');
  if ((telegramRecovery!==null&&typeof telegramRecovery!=='function') || (telegramBlockedList!==null&&typeof telegramBlockedList!=='function') || (telegramAttempts!==null&&(!telegramAttempts||typeof telegramAttempts.begin!=='function'||typeof telegramAttempts.block!=='function')) || (telegramCorrections!==null&&(!telegramCorrections||typeof telegramCorrections.preview!=='function'||typeof telegramCorrections.confirm!=='function')) || (telegramSelections!==null&&(!telegramSelections||typeof telegramSelections.select!=='function')) || (telegramPreviewDelivery!==null&&(!telegramPreviewDelivery||!['initialize','claim','report'].every(k=>typeof telegramPreviewDelivery[k]==='function'))) || (telegramPublicationBegin!==null&&typeof telegramPublicationBegin!=='function') || typeof targetBegin!=='function') throw new Error('Configuración incompleta');
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
    const telegramAction=telegramStore&&/^\/v1\/telegram\/packages\/(capabilities|current|open|reserve|complete|manifest|asset|chunk|seal|discard)$/.exec(req.url)?.[1];
    const recoverAction=telegramRecovery&&req.url==='/v1/telegram/packages/reopen';
    const blockedListAction=telegramBlockedList&&req.url==='/v1/telegram/packages/blocked';
    const attemptMatch=telegramAttempts&&/^\/v1\/telegram\/attempts\/(begin|block|start)$/.exec(req.url)?.[1];
    const attemptAction=attemptMatch&&typeof telegramAttempts[attemptMatch]==='function'?attemptMatch:null;
    const correctionAction=telegramCorrections&&/^\/v1\/telegram\/corrections\/(preview|confirm)$/.exec(req.url)?.[1];
    const selectionAction=telegramSelections&&req.url==='/v1/telegram/corrections/select';
    const deliveryAction=telegramPreviewDelivery&&/^\/v1\/telegram\/previews\/delivery\/(initialize|claim|report)$/.exec(req.url)?.[1];
    const publicationAction=telegramPublicationBegin&&req.url==='/v1/telegram/publications/begin';
    const eventAction=telegramEvents&&/^\/v1\/telegram\/events\/(subscribe|unsubscribe|status|emit)$/.exec(req.url)?.[1];
    const reviewAction=telegramReviews&&/^\/v1\/telegram\/reviews\/(begin|report)$/.exec(req.url)?.[1];
    if(req.method!=='POST'||(!reviewAction&&!eventAction&&!telegramAction&&!recoverAction&&!blockedListAction&&!attemptAction&&!correctionAction&&!selectionAction&&!deliveryAction&&!publicationAction&&!['/v1/reservations','/v1/reservations/status','/v1/targets/begin','/v1/targets/report','/v1/targets/status','/v1/media/begin','/v1/media/report','/v1/media/status','/v1/recovery/status'].includes(req.url))) {req.resume();return end(404,{error:'not_found'});}
    if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??'')) {req.resume();return end(415,{error:'content_type'});}
    let data='',size=0;
    try {
      if(telegramAction||eventAction||reviewAction||recoverAction||blockedListAction||attemptAction||correctionAction||selectionAction||deliveryAction||publicationAction) {
        const chunks=[],limit=telegramAction==='complete'?14*1024*1024:65536;
        for await(const chunk of req){size+=chunk.length;if(size>limit){req.resume();return end(413,{error:'too_large'});}chunks.push(chunk);}
        const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if(recoverAction)return end(200,await telegramRecovery(input));
        if(blockedListAction)return end(200,await telegramBlockedList(input));
        if(attemptAction)return end(200,await telegramAttempts[attemptAction](input));
        if(correctionAction)return end(200,await telegramCorrections[correctionAction](input));
        if(selectionAction)return end(200,await telegramSelections.select(input));
        if(deliveryAction)return end(200,await telegramPreviewDelivery[deliveryAction](input));
        if(publicationAction){const r=await telegramPublicationBegin(pool,input);return end(r.status==='PUBLICATION_STARTED'?200:409,r)}
        if(eventAction)return end(200,await telegramEvents.run(eventAction,input));
        if(reviewAction)return end(200,await telegramReviews.run(reviewAction,input));
        if(telegramAction==='capabilities') {
          if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)return end(400,{error:'invalid_request'});
          return end(200,await telegramStore.capabilities());
        }
        return end(200,await telegramStore.run(telegramAction,input));
      }
      for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY){req.resume();return end(413,{error:'too_large'});}data+=chunk.toString('utf8');}
      const input=JSON.parse(data);
      if(req.url==='/v1/recovery/status') {
        if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).sort().join(',')!=='destination,fingerprint,requestId,slug' ||
          typeof input.requestId!=='string' || !/^[A-Za-z0-9_-]{16,128}$/.test(input.requestId) ||
          typeof input.slug!=='string' || input.slug.length>200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) ||
          !['OPURO','OPOL','LIBERAL'].includes(input.destination) || typeof input.fingerprint!=='string' || !/^[a-f0-9]{64}$/.test(input.fingerprint)) return end(400,{error:'invalid_request'});
        const reservation=await inspectDirectReservation(pool,{requestId:input.requestId,fingerprint:input.fingerprint});
        const observed={reservation};
        if(reservation.status==='claimed' && reservation.identity==='matched') {
          const identity={requestId:input.requestId,slug:input.slug,destination:input.destination};
          observed.target=await inspectTargetProgress(pool,identity);
          for(const role of ['OPURO','LIBERAL'].includes(input.destination)?['hero','featured']:['featured']) observed[role]=await inspectMediaUpload(pool,{...identity,role});
        }
        return end(200,{observed,action:'manual_reconciliation',retryPermitted:false,wordpressVerified:false,consistentSnapshot:false});
      }
      if(req.url.startsWith('/v1/media/')) {
        const expectedKeys=req.url==='/v1/media/report'?'destination,mediaId,requestId,role,slug':'destination,requestId,role,slug';
        if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).sort().join(',')!==expectedKeys) return end(400,{error:'invalid_request'});
        const result=req.url==='/v1/media/begin'?await beginMediaUpload(pool,input):req.url==='/v1/media/report'?await recordMediaUpload(pool,input):await inspectMediaUpload(pool,input);
        return end(['already_started','not_started','not_updated'].includes(result.status)?409:200,result);
      }
      if(req.url.startsWith('/v1/targets/')) {
        const expectedKeys=req.url==='/v1/targets/report'?'destination,postId,requestId,slug':'destination,requestId,slug';
        if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).sort().join(',')!==expectedKeys) return end(400,{error:'invalid_request'});
        const result=req.url==='/v1/targets/begin'?await targetBegin(pool,input):req.url==='/v1/targets/report'?await recordTargetPost(pool,input):await inspectTargetProgress(pool,input);
        const conflict=['already_started','not_reserved','not_updated','NOT_BOUND','WRITE_NOT_PERMITTED','NOT_RESERVED'].includes(result.status);
        return end(conflict?409:200,result);
      }
      if(req.url==='/v1/reservations/status') {
        if(!input || typeof input!=='object' || Array.isArray(input) || !['fingerprint,requestId','requestId'].includes(Object.keys(input).sort().join(','))) return end(400,{error:'invalid_request'});
        const result=await inspectDirectReservation(pool,input);
        return end(200,result);
      }
      if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).sort().join(',')!=='destinations,fingerprint,requestId,slug') return end(400,{error:'invalid_request'});
      const result=await reserveDirectPublication(pool,input);
      return end(result.status==='claimed'?201:409,result);
    } catch(error) {
      if (error?.message === 'Inicio de medio no confirmado') {
        const allowed = ['ER_LOCK_WAIT_TIMEOUT', 'ER_LOCK_DEADLOCK', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'ECONNREFUSED', 'WRITE_CONFLICT', 'OTHER'];
        const diagnostic = allowed.includes(error.diagnostic) ? error.diagnostic : 'OTHER';
        try { diagnosticLogger(`guard.media.begin: ${diagnostic}`); } catch { /* logging must not change fail-closed behavior */ }
      }
      return end(error.message==='Solicitud inválida'||error.message==='INVALID_ATTEMPT'||error instanceof SyntaxError?400:503,{error:'not_confirmed'});
    }
  });
}

