import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {reserveDirectPublication,inspectDirectReservation} from './direct-claim.mjs';
import {beginTargetWrite,recordTargetPost,inspectTargetProgress} from './target-progress.mjs';
import {beginMediaUpload,recordMediaUpload,inspectMediaUpload} from './media-progress.mjs';

const MAX_BODY=4096;
// Integration candidate derived from the verified last-source blob 7881ae8.
// Recovery and writer hooks are opt-in; production is not changed by this file.
export function createGuard({pool,secret,diagnosticLogger=console.error,runtimeObserver=null,telegramStore=null,telegramEvents=null,telegramReviews=null,telegramRecovery=null,telegramBlockedList=null,telegramAttempts=null,telegramWriterReceipts=null,telegramUpdateDeliveries=null,telegramReconciliation=null,telegramCorrections=null,telegramSelections=null,telegramPreviewDelivery=null,telegramPreviewPayloads=null,telegramPreviewMaterializer=null,telegramPublicationBegin=null,telegramUpdateClaims=null,telegramUpdateExecutor=null,telegramUpdatePayloads=null,targetBegin=beginTargetWrite,mediaBegin=beginMediaUpload}) {
  if (!pool?.getConnection || typeof secret!=='string' || !/^[a-f0-9]{64,}$/.test(secret)) throw new Error('Configuración incompleta');
  if(telegramUpdateDeliveries!==null&&typeof telegramUpdateDeliveries.consume!=='function')throw new Error('Configuración incompleta');
  if(telegramReconciliation!==null&&typeof telegramReconciliation!=='function')throw new Error('Configuración incompleta');
  if(telegramWriterReceipts!==null&&typeof telegramWriterReceipts?.report!=='function')throw new Error('Configuración incompleta');
  if(runtimeObserver!==null&&typeof runtimeObserver!=='function')throw new Error('Configuración incompleta');
  if(telegramPreviewMaterializer!==null&&typeof telegramPreviewMaterializer!=='function')throw new Error('Configuración incompleta');
  if(telegramPreviewPayloads!==null&&typeof telegramPreviewPayloads?.stage!=='function')throw new Error('Configuración incompleta');
  if ((telegramRecovery!==null&&typeof telegramRecovery!=='function') || (telegramBlockedList!==null&&typeof telegramBlockedList!=='function') || (telegramAttempts!==null&&(!telegramAttempts||typeof telegramAttempts.begin!=='function'||typeof telegramAttempts.block!=='function')) || (telegramCorrections!==null&&(!telegramCorrections||typeof telegramCorrections.preview!=='function'||typeof telegramCorrections.confirm!=='function')) || (telegramSelections!==null&&(!telegramSelections||typeof telegramSelections.select!=='function')) || (telegramPreviewDelivery!==null&&(!telegramPreviewDelivery||!['initialize','claim','report'].every(k=>typeof telegramPreviewDelivery[k]==='function'))) || (telegramPublicationBegin!==null&&typeof telegramPublicationBegin!=='function') || (telegramUpdateClaims!==null&&(!telegramUpdateClaims||typeof telegramUpdateClaims.begin!=='function')) || (telegramUpdateExecutor!==null&&(!telegramUpdateExecutor||typeof telegramUpdateExecutor.execute!=='function')) || (telegramUpdatePayloads!==null&&(!telegramUpdatePayloads||typeof telegramUpdatePayloads.stage!=='function')) || typeof targetBegin!=='function'||typeof mediaBegin!=='function') throw new Error('Configuración incompleta');
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
    const attemptMatch=telegramAttempts&&/^\/v1\/telegram\/attempts\/(begin|block|start|complete|decision|recover-unacknowledged)$/.exec(req.url)?.[1];
    const attemptMethod=attemptMatch==='decision'?'acknowledgeDecision':attemptMatch==='recover-unacknowledged'?'recoverUnacknowledged':attemptMatch;
    const attemptAction=attemptMethod&&typeof telegramAttempts[attemptMethod]==='function'?attemptMethod:null;
    const correctionAction=telegramCorrections&&/^\/v1\/telegram\/corrections\/(preview|confirm)$/.exec(req.url)?.[1];
    const selectionAction=telegramSelections&&req.url==='/v1/telegram/corrections/select';
    const deliveryAction=telegramPreviewDelivery&&/^\/v1\/telegram\/previews\/delivery\/(initialize|claim|report)$/.exec(req.url)?.[1];
    const previewPayloadAction=telegramPreviewPayloads&&req.url==='/v1/telegram/previews/payload';
    const previewMaterializeAction=telegramPreviewMaterializer&&req.url==='/v1/telegram/previews/materialize';
    const previewContextAction=telegramPreviewPayloads&&typeof telegramPreviewPayloads.context==='function'&&req.url==='/v1/telegram/previews/context';
    const publicationAction=telegramPublicationBegin&&req.url==='/v1/telegram/publications/begin';
    const updateAction=telegramUpdateClaims&&req.url==='/v1/telegram/updates/begin';
    const updateExecute=telegramUpdateExecutor&&req.url==='/v1/telegram/updates/execute';
    const updatePayload=telegramUpdatePayloads&&req.url==='/v1/telegram/updates/payload';
    const eventAction=telegramEvents&&/^\/v1\/telegram\/events\/(subscribe|unsubscribe|status|emit)$/.exec(req.url)?.[1];
    const updateDeliveryAction=telegramUpdateDeliveries&&req.url==='/v1/telegram/update-deliveries/consume';
    const reconciliationAction=telegramReconciliation&&req.url==='/v1/telegram/reconciliation/observe';
    const writerReceiptAction=telegramWriterReceipts&&req.url==='/v1/telegram/writers/report';
    const previewDiagnostic=req.url==='/v1/telegram/previews/diagnostic';
    const runtimeAction=runtimeObserver&&req.url==='/v1/telegram/runtime/observe';
    const reviewAction=telegramReviews&&/^\/v1\/telegram\/reviews\/(begin|report)$/.exec(req.url)?.[1];
    if(req.method!=='POST'||(!previewDiagnostic&&!updateDeliveryAction&&!reconciliationAction&&!writerReceiptAction&&!runtimeAction&&!reviewAction&&!eventAction&&!telegramAction&&!recoverAction&&!blockedListAction&&!attemptAction&&!correctionAction&&!selectionAction&&!deliveryAction&&!previewPayloadAction&&!previewContextAction&&!previewMaterializeAction&&!publicationAction&&!updateAction&&!updateExecute&&!updatePayload&&!['/v1/reservations','/v1/reservations/status','/v1/targets/begin','/v1/targets/report','/v1/targets/status','/v1/media/begin','/v1/media/report','/v1/media/status','/v1/recovery/status'].includes(req.url))) {req.resume();return end(404,{error:'not_found'});}
    if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??'')) {req.resume();return end(415,{error:'content_type'});}
    let data='',size=0;
    try {
      if(previewDiagnostic||updateDeliveryAction||reconciliationAction||writerReceiptAction||runtimeAction||telegramAction||eventAction||reviewAction||recoverAction||blockedListAction||attemptAction||correctionAction||selectionAction||deliveryAction||previewPayloadAction||previewContextAction||previewMaterializeAction||publicationAction||updateAction||updateExecute||updatePayload) {
        const chunks=[],limit=telegramAction==='complete'?14*1024*1024:updatePayload?5*1024*1024:65536;
        for await(const chunk of req){size+=chunk.length;if(size>limit){req.resume();return end(413,{error:'too_large'});}chunks.push(chunk);}
        const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if(previewDiagnostic){
         if(!input||Object.keys(input).join(',')!=='packageId'||!/^tg_[a-f0-9]{40}$/.test(input.packageId??''))return end(400,{error:'invalid_diagnostic'});
         const c=await pool.getConnection();try{
          const [subscriptions]=await c.execute('SELECT subscription_id,state,expires_at FROM opmx_tg_preview_subscriptions_v1 ORDER BY subscription_id LIMIT 10');
          const [generation]=await c.execute('SELECT revision,state FROM opmx_tg_preview_generation_v1 WHERE package_id=? ORDER BY revision',[input.packageId]);
          const [deliveries]=await c.execute('SELECT e.revision,d.state,d.attempts,d.last_status FROM opmx_tg_preview_deliveries_v1 d JOIN opmx_tg_preview_events_v1 e ON e.event_id=d.event_id WHERE e.package_id=? ORDER BY e.revision',[input.packageId]);
          return end(200,{status:'PREVIEW_DIAGNOSTIC',configuredSubscription:process.env.OPMX_PREVIEW_SUBSCRIPTION_ID??null,subscriptions,generation,deliveries});
         }finally{c.release()}
        }
        if(updateDeliveryAction){const r=await telegramUpdateDeliveries.consume(input);return end(r.status==='UPDATE_PAYLOAD_GRANTED'?200:409,r)}
        if(reconciliationAction)return end(200,await telegramReconciliation(input));
        if(writerReceiptAction){const r=await telegramWriterReceipts.report(input);return end(['WRITER_RECEIPT_RECORDED','WRITER_RECEIPT_REPLAY'].includes(r.status)?200:409,r)}
        if(runtimeAction){const r=await runtimeObserver(input);const {workflows,...summary}=r;return end(r.status==='RUNTIME_OBSERVED'?200:503,{...summary,...(workflows?{workflows:workflows.map(w=>({id:w.id,activeVersionId:w.activeVersionId,nodeCount:w.graph.nodes.length}))}:{})})}
        if(recoverAction)return end(200,await telegramRecovery(input));
        if(blockedListAction)return end(200,await telegramBlockedList(input));
        if(attemptAction)return end(200,await telegramAttempts[attemptAction](input));
        if(correctionAction)return end(200,await telegramCorrections[correctionAction](input));
        if(selectionAction)return end(200,await telegramSelections.select(input));
        if(deliveryAction)return end(200,await telegramPreviewDelivery[deliveryAction](input));
        if(previewMaterializeAction){const r=await telegramPreviewMaterializer(input);return end(r.status==='PREVIEW_MATERIALIZED'?200:409,r)}
        if(previewContextAction){const r=await telegramPreviewPayloads.context(input);return end(r.status==='PREVIEW_CONTEXT'?200:409,r)}
        if(previewPayloadAction){const r=await telegramPreviewPayloads.stage(input);return end(['PREVIEW_PAYLOAD_STAGED','PREVIEW_PAYLOAD_REPLAY'].includes(r.status)?200:409,r)}
        if(publicationAction){const r=await telegramPublicationBegin(pool,input);return end(r.status==='PUBLICATION_STARTED'?200:409,r)}
        if(updateAction){const r=await telegramUpdateClaims.begin(input);return end(r.status==='UPDATE_STARTED'?200:409,r)}
        if(updateExecute){const r=await telegramUpdateExecutor.execute(input);return end(r.status==='CMS_UPDATE_CONFIRMED'?200:409,r)}
        if(updatePayload){const r=await telegramUpdatePayloads.stage(input);return end(['PAYLOAD_STAGED','PAYLOAD_REPLAY'].includes(r.status)?200:409,r)}
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
        const result=req.url==='/v1/media/begin'?await mediaBegin(pool,input):req.url==='/v1/media/report'?await recordMediaUpload(pool,input):await inspectMediaUpload(pool,input);
        return end(['already_started','not_started','not_updated','NOT_BOUND','WRITE_NOT_PERMITTED'].includes(result.status)?409:200,result);
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
      return end(['Solicitud inválida','INVALID_ATTEMPT','INVALID_MEDIA_REQUEST','INVALID_UPDATE_PAYLOAD'].includes(error.message)||error instanceof SyntaxError?400:503,{error:'not_confirmed'});
    }
  });
}

