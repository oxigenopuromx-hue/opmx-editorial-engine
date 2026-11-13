// Sanitized active16-node monitor fixture. Administrator is synthetic; no credentials, source materials or original node IDs.
export default {
  "id": "NFOBzPfHmvRjVFOA",
  "versionId": "efa564a8-3f87-4936-ba1a-2b1a33a0879f",
  "nodes": [
    {
      "id": "synthetic-0",
      "name": "Revisar alertas cada cinco minutos",
      "type": "n8n-nodes-base.scheduleTrigger",
      "parameters": {}
    },
    {
      "id": "synthetic-1",
      "name": "Leer seguimiento para administrador",
      "type": "n8n-nodes-base.dataTable",
      "parameters": {}
    },
    {
      "id": "synthetic-2",
      "name": "Seleccionar alertas de administrador",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "const persistence=(()=>{\nconst PACKAGE=/^tg_[a-f0-9]{40}$/;\nconst REQUEST=/^tg_[a-f0-9]{64}$/;\nconst DIGEST=/^[a-f0-9]{64}$/;\nconst SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;\nconst SITES=['OPURO','OPOL','LIBERAL'];\nconst DESTINATIONS={\n OPURO:['OPURO'],OPOL:['OPOL'],AMBOS:['OPURO','OPOL'],LIBERAL:['LIBERAL'],\n 'OPURO,LIBERAL':['OPURO','LIBERAL'],'OPOL,LIBERAL':['OPOL','LIBERAL'],TODOS:SITES\n};\nconst UNCERTAIN=new Set(['DRAFT_UNCERTAIN','PUBLISH_UNCERTAIN']);\nconst revision=x=>Number.isSafeInteger(x)&&x>0&&x<=4294967295;\nconst time=x=>typeof x==='string'&&/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(x)?Date.parse(x):NaN;\n\n// The observation must come exclusively from the authenticated Guard's fixed\n// read-only final-publication endpoint. This validator does not authenticate a\n// caller or turn user/source text, Telegram notices or HTTP200 into evidence.\n// REQUEST rows are the receiver's existing immutable correlation records; the\n// Guard independently checks the canonical binding, receipt and CMS identities.\n// No URL, target, request ID or positive assertion is sent to the Guard by this\n// resolver. It only decides whether an already selected uncertain alert is stale.\nfunction shouldSuppressUncertainPublicationAlert(row,observation,{requestRows=[],nowMs=Date.now(),maxObservationAgeMs=120000}={}){\n if(!row||!UNCERTAIN.has(row.stage)||!PACKAGE.test(row.package_id??'')||!revision(row.revision)||!Number.isFinite(nowMs)||!Number.isSafeInteger(maxObservationAgeMs)||maxObservationAgeMs<0)return false;\n const x=observation;\n if(!x||typeof x!=='object'||Array.isArray(x)||x.schema!=='opmx.telegram.final-publication-observation.v1'||x.status!=='FINAL_PUBLICATION_CONFIRMED'||x.phase!=='PUBLISH'||x.receiptState!=='RECORDED'||x.packageId!==row.package_id||x.revision!==row.revision||!REQUEST.test(x.requestId??'')||!DIGEST.test(x.receiptHash??'')||typeof x.slug!=='string'||x.slug.length>200||!SLUG.test(x.slug)||x.writeAuthorized!==false||x.retryPermitted!==false||x.writersIdleVerified!==true||x.consistentSnapshot!==true)return false;\n const observed=time(x.observedAt),source=time(row.occurred_at);\n // Freshness only rejects stale/cache/future input. It never proves that a\n // writer stopped; writersIdleVerified and the locked Guard snapshot do that.\n if(!Number.isFinite(observed)||!Number.isFinite(source)||observed<source||observed>nowMs+5000||nowMs-observed>maxObservationAgeMs)return false;\n const requested=Object.hasOwn(DESTINATIONS,x.destination??'')?DESTINATIONS[x.destination]:null;\n if(!requested||!Array.isArray(x.targets)||x.targets.length!==requested.length)return false;\n if(x.targets.some((t,i)=>!t||typeof t!=='object'||t.destination!==requested[i]||!Number.isSafeInteger(t.postId)||t.postId<1||t.slug!==x.slug||t.status!=='publish'||t.cmsVerified!==true||t.ledgerVerified!==true))return false;\n if(!Array.isArray(requestRows))return false;\n const bindings=requestRows.filter(r=>r?.package_id===row.package_id&&r.revision===row.revision&&r.stage==='REQUEST_'+x.destination);\n return bindings.length===1&&bindings[0].request_id===x.requestId;\n}\n\n// Candidates retain the original stage/time, even though their outgoing\n// stage is ALERT_ADMIN_<row-id>. Never infer the reason from human text or\n// suppress unrelated alerts. Duplicate/ambiguous Guard responses fail closed.\nfunction retainUnresolvedPublicationAlerts(candidates,observations,options={}){\n if(!Array.isArray(candidates))throw Error('ALERT_CANDIDATES_INVALID');\n const proofs=Array.isArray(observations)?observations:[];\n return candidates.filter(candidate=>{\n  const matching=proofs.filter(x=>x?.packageId===candidate?.package_id&&x.revision===candidate?.revision);\n  if(matching.length!==1)return true;\n  const row={package_id:candidate.package_id,revision:candidate.revision,stage:candidate.sourceStage,occurred_at:candidate.sourceOccurredAt};\n  return !shouldSuppressUncertainPublicationAlert(row,matching[0],options);\n });\n}\n\n\nconst packagePattern=/^tg_[a-f0-9]{40}$/;\nconst requestPattern=/^tg_[a-f0-9]{64}$/;\nconst requestStages=new Set(['REQUEST_OPURO','REQUEST_OPOL','REQUEST_AMBOS','REQUEST_LIBERAL','REQUEST_OPURO,LIBERAL','REQUEST_OPOL,LIBERAL','REQUEST_TODOS']);\nconst uncertainStages=new Set(['DRAFT_UNCERTAIN','PUBLISH_UNCERTAIN']);\nconst publicationProgressStages=new Set(['QUEUED','PROGRESS_START','PROGRESS_WRITING','PROGRESS_IMAGE','PROGRESS_SUBMIT']);\nconst validRevision=n=>Number.isSafeInteger(n)&&n>0&&n<=4294967295;\nconst timestamp=s=>typeof s==='string'&&/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:\\d{2})$/.test(s)?Date.parse(s):NaN;\nconst scopeValid=x=>x&&packagePattern.test(x.package_id??'')&&validRevision(x.revision);\n\n// The Guard's verified final phase selects one of the revision's seven\n// pre-registered destination bindings. A source stage's explicit request must\n// still match. A legacy stage without one may use that verified selection;\n// seven available bindings alone do not identify what was actually published.\nfunction publicationAlertRequestId(candidate,requestRows=[],{selectedRequestId=null}={}){\n if(!scopeValid(candidate)||!Array.isArray(requestRows))return null;\n const rows=requestRows.filter(r=>r?.package_id===candidate.package_id&&r.revision===candidate.revision&&requestStages.has(r.stage));\n if(!rows.length||rows.some(r=>!requestPattern.test(r.request_id??'')))return null;\n const explicit=candidate.sourceRequestId??candidate.request_id;\n if(explicit!==null&&explicit!==undefined)return requestPattern.test(explicit)&&rows.some(r=>r.request_id===explicit)&&(selectedRequestId===null||selectedRequestId===explicit)?explicit:null;\n if(selectedRequestId!==null)return requestPattern.test(selectedRequestId)&&rows.some(r=>r.request_id===selectedRequestId)?selectedRequestId:null;\n const ids=[...new Set(rows.map(r=>r.request_id))];return ids.length===1?ids[0]:null;\n}\n\n// These are durable historical delivery records, not a cached claim that all\n// CMS remain published forever. Only the same publication uncertainty/progress\n// is superseded. Editorial/source failures and other requests remain visible.\nfunction publicationAlertWasReconciled(candidate,reconciliationRows=[],{requestRows=[],nowMs=Date.now()}={}){\n if(!scopeValid(candidate)||!Number.isFinite(timestamp(candidate.sourceOccurredAt))||!Array.isArray(reconciliationRows)||!Number.isFinite(nowMs)||!uncertainStages.has(candidate.sourceStage)&&!publicationProgressStages.has(candidate.sourceStage))return false;\n const terminals=reconciliationRows.filter(r=>r?.stage==='PUBLICATION_RECONCILED'&&Number.isSafeInteger(r.id)&&r.id>0&&r.package_id===candidate.package_id&&r.revision===candidate.revision&&requestPattern.test(r.request_id??'')&&Number.isFinite(timestamp(r.occurred_at))&&timestamp(r.occurred_at)<=nowMs+5000&&publicationAlertRequestId({...candidate,sourceRequestId:null,request_id:null},requestRows,{selectedRequestId:r.request_id})===r.request_id);\n const requests=[...new Set(terminals.map(r=>r.request_id))];if(requests.length!==1)return false;\n return publicationAlertRequestId(candidate,requestRows,{selectedRequestId:requests[0]})===requests[0];\n}\n\nfunction preparePublicationReconciliations(candidates,observations,{requestRows=[],reconciliationRows=[],nowMs=Date.now()}={}){\n if(!Array.isArray(candidates)||!Array.isArray(observations)||!Array.isArray(requestRows)||!Array.isArray(reconciliationRows)||!Number.isFinite(nowMs))throw Error('PUBLICATION_RECONCILIATION_INPUT_INVALID');\n const records=[],seen=new Set();\n for(const candidate of candidates){\n  if(!scopeValid(candidate)||!uncertainStages.has(candidate.sourceStage)||publicationAlertWasReconciled(candidate,reconciliationRows,{requestRows,nowMs}))continue;\n  const matches=observations.filter(p=>p?.packageId===candidate.package_id&&p.revision===candidate.revision);if(matches.length!==1)continue;\n  const proof=matches[0],requestId=publicationAlertRequestId(candidate,requestRows,{selectedRequestId:proof.requestId});\n  if(!requestId||proof.requestId!==requestId||!shouldSuppressUncertainPublicationAlert({package_id:candidate.package_id,revision:candidate.revision,stage:candidate.sourceStage,occurred_at:candidate.sourceOccurredAt},proof,{requestRows,nowMs}))continue;\n  // Conflicting durable terminal identities need explicit reconciliation;\n  // never append the same preferred identity on every poll to outvote them.\n  const conflicting=reconciliationRows.some(r=>r?.stage==='PUBLICATION_RECONCILED'&&Number.isSafeInteger(r.id)&&r.id>0&&r.package_id===candidate.package_id&&r.revision===candidate.revision&&r.request_id!==requestId&&Number.isFinite(timestamp(r.occurred_at))&&timestamp(r.occurred_at)<=nowMs+5000&&publicationAlertRequestId({...candidate,sourceRequestId:null,request_id:null},requestRows,{selectedRequestId:r.request_id})===r.request_id);\n  if(conflicting)continue;\n  const key=candidate.package_id+':'+candidate.revision+':'+requestId;if(seen.has(key))continue;seen.add(key);\n  records.push({package_id:candidate.package_id,revision:candidate.revision,stage:'PUBLICATION_RECONCILED',occurred_at:new Date(nowMs).toISOString(),request_id:requestId});\n }\n return records;\n}\n\n// The DataTable node returns the inserted row. A positive ID alone is not an\n// acknowledgement of this scope; verify every technical column and timestamp.\nfunction publicationReconciliationInsertConfirmed(expected,row){\n if(!scopeValid(expected)||expected.stage!=='PUBLICATION_RECONCILED'||!requestPattern.test(expected.request_id??'')||!Number.isFinite(timestamp(expected.occurred_at))||!row||Object.hasOwn(row,'error')||!Number.isSafeInteger(row.id)||row.id<1)return false;\n return row.package_id===expected.package_id&&row.revision===expected.revision&&row.stage===expected.stage&&row.request_id===expected.request_id&&Number.isFinite(timestamp(row.occurred_at))&&timestamp(row.occurred_at)===timestamp(expected.occurred_at);\n}\n\nfunction retainAlertsWithoutPublicationReconciliation(candidates,reconciliationRows,options={}){\n if(!Array.isArray(candidates))throw Error('ALERT_CANDIDATES_INVALID');\n return candidates.filter(candidate=>!publicationAlertWasReconciled(candidate,reconciliationRows,options));\n}\n\nreturn {publicationAlertRequestId,publicationAlertWasReconciled,preparePublicationReconciliations,publicationReconciliationInsertConfirmed,retainAlertsWithoutPublicationReconciliation};\n})();\nconst contexts=$input.all().map(x=>x.json);if(!contexts.length)return [];const batch=contexts[0],signature=JSON.stringify({chatId:batch.chatId,candidates:batch.candidates,requestRows:batch.requestRows,reconciliationRows:batch.reconciliationRows});\nif(contexts.some(batch=>JSON.stringify({chatId:batch.chatId,candidates:batch.candidates,requestRows:batch.requestRows,reconciliationRows:batch.reconciliationRows})!==signature))throw Error('ALERT_BATCH_CONTEXT_MISMATCH');\nconst persisted=contexts.flatMap(x=>Array.isArray(x.persistedReconciliations)?x.persistedReconciliations:[]);\nconst retained=persistence.retainAlertsWithoutPublicationReconciliation(batch.candidates,[...(batch.reconciliationRows??[]),...persisted],{requestRows:batch.requestRows,nowMs:Date.now()}).filter(candidate=>candidate.alreadyAlerted!==true);\nif(!retained.length)return [];\nconst alerts=retained.map(({sourceStage,sourceOccurredAt,sourceRequestId,alreadyAlerted,...alert})=>alert);\nconst text='OPMX · alerta de administrador\\n\\n'+alerts.map((x,i)=>(i+1)+'. '+x.summary+'\\n'+x.origin+' · paquete '+x.package_id+' · versión '+x.revision).join('\\n\\n')+'\\n\\nRevisa el estado antes de reintentar; una demora o un resultado incierto no confirma que se haya publicado.';\nreturn [{json:{chat_id:batch.chatId,text,alerts}}];"
      }
    },
    {
      "id": "synthetic-3",
      "name": "Notificar administrador",
      "type": "n8n-nodes-base.telegram",
      "parameters": {}
    },
    {
      "id": "synthetic-4",
      "name": "Verificar acuse administrador",
      "type": "n8n-nodes-base.code",
      "parameters": {}
    },
    {
      "id": "synthetic-5",
      "name": "Registrar alertas confirmadas",
      "type": "n8n-nodes-base.dataTable",
      "parameters": {}
    },
    {
      "id": "synthetic-6",
      "name": "Preparar comprobación de alertas",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "const persistence=(()=>{\nconst PACKAGE=/^tg_[a-f0-9]{40}$/;\nconst REQUEST=/^tg_[a-f0-9]{64}$/;\nconst DIGEST=/^[a-f0-9]{64}$/;\nconst SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;\nconst SITES=['OPURO','OPOL','LIBERAL'];\nconst DESTINATIONS={\n OPURO:['OPURO'],OPOL:['OPOL'],AMBOS:['OPURO','OPOL'],LIBERAL:['LIBERAL'],\n 'OPURO,LIBERAL':['OPURO','LIBERAL'],'OPOL,LIBERAL':['OPOL','LIBERAL'],TODOS:SITES\n};\nconst UNCERTAIN=new Set(['DRAFT_UNCERTAIN','PUBLISH_UNCERTAIN']);\nconst revision=x=>Number.isSafeInteger(x)&&x>0&&x<=4294967295;\nconst time=x=>typeof x==='string'&&/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(x)?Date.parse(x):NaN;\n\n// The observation must come exclusively from the authenticated Guard's fixed\n// read-only final-publication endpoint. This validator does not authenticate a\n// caller or turn user/source text, Telegram notices or HTTP200 into evidence.\n// REQUEST rows are the receiver's existing immutable correlation records; the\n// Guard independently checks the canonical binding, receipt and CMS identities.\n// No URL, target, request ID or positive assertion is sent to the Guard by this\n// resolver. It only decides whether an already selected uncertain alert is stale.\nfunction shouldSuppressUncertainPublicationAlert(row,observation,{requestRows=[],nowMs=Date.now(),maxObservationAgeMs=120000}={}){\n if(!row||!UNCERTAIN.has(row.stage)||!PACKAGE.test(row.package_id??'')||!revision(row.revision)||!Number.isFinite(nowMs)||!Number.isSafeInteger(maxObservationAgeMs)||maxObservationAgeMs<0)return false;\n const x=observation;\n if(!x||typeof x!=='object'||Array.isArray(x)||x.schema!=='opmx.telegram.final-publication-observation.v1'||x.status!=='FINAL_PUBLICATION_CONFIRMED'||x.phase!=='PUBLISH'||x.receiptState!=='RECORDED'||x.packageId!==row.package_id||x.revision!==row.revision||!REQUEST.test(x.requestId??'')||!DIGEST.test(x.receiptHash??'')||typeof x.slug!=='string'||x.slug.length>200||!SLUG.test(x.slug)||x.writeAuthorized!==false||x.retryPermitted!==false||x.writersIdleVerified!==true||x.consistentSnapshot!==true)return false;\n const observed=time(x.observedAt),source=time(row.occurred_at);\n // Freshness only rejects stale/cache/future input. It never proves that a\n // writer stopped; writersIdleVerified and the locked Guard snapshot do that.\n if(!Number.isFinite(observed)||!Number.isFinite(source)||observed<source||observed>nowMs+5000||nowMs-observed>maxObservationAgeMs)return false;\n const requested=Object.hasOwn(DESTINATIONS,x.destination??'')?DESTINATIONS[x.destination]:null;\n if(!requested||!Array.isArray(x.targets)||x.targets.length!==requested.length)return false;\n if(x.targets.some((t,i)=>!t||typeof t!=='object'||t.destination!==requested[i]||!Number.isSafeInteger(t.postId)||t.postId<1||t.slug!==x.slug||t.status!=='publish'||t.cmsVerified!==true||t.ledgerVerified!==true))return false;\n if(!Array.isArray(requestRows))return false;\n const bindings=requestRows.filter(r=>r?.package_id===row.package_id&&r.revision===row.revision&&r.stage==='REQUEST_'+x.destination);\n return bindings.length===1&&bindings[0].request_id===x.requestId;\n}\n\n// Candidates retain the original stage/time, even though their outgoing\n// stage is ALERT_ADMIN_<row-id>. Never infer the reason from human text or\n// suppress unrelated alerts. Duplicate/ambiguous Guard responses fail closed.\nfunction retainUnresolvedPublicationAlerts(candidates,observations,options={}){\n if(!Array.isArray(candidates))throw Error('ALERT_CANDIDATES_INVALID');\n const proofs=Array.isArray(observations)?observations:[];\n return candidates.filter(candidate=>{\n  const matching=proofs.filter(x=>x?.packageId===candidate?.package_id&&x.revision===candidate?.revision);\n  if(matching.length!==1)return true;\n  const row={package_id:candidate.package_id,revision:candidate.revision,stage:candidate.sourceStage,occurred_at:candidate.sourceOccurredAt};\n  return !shouldSuppressUncertainPublicationAlert(row,matching[0],options);\n });\n}\n\n\nconst packagePattern=/^tg_[a-f0-9]{40}$/;\nconst requestPattern=/^tg_[a-f0-9]{64}$/;\nconst requestStages=new Set(['REQUEST_OPURO','REQUEST_OPOL','REQUEST_AMBOS','REQUEST_LIBERAL','REQUEST_OPURO,LIBERAL','REQUEST_OPOL,LIBERAL','REQUEST_TODOS']);\nconst uncertainStages=new Set(['DRAFT_UNCERTAIN','PUBLISH_UNCERTAIN']);\nconst publicationProgressStages=new Set(['QUEUED','PROGRESS_START','PROGRESS_WRITING','PROGRESS_IMAGE','PROGRESS_SUBMIT']);\nconst validRevision=n=>Number.isSafeInteger(n)&&n>0&&n<=4294967295;\nconst timestamp=s=>typeof s==='string'&&/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:\\d{2})$/.test(s)?Date.parse(s):NaN;\nconst scopeValid=x=>x&&packagePattern.test(x.package_id??'')&&validRevision(x.revision);\n\n// The Guard's verified final phase selects one of the revision's seven\n// pre-registered destination bindings. A source stage's explicit request must\n// still match. A legacy stage without one may use that verified selection;\n// seven available bindings alone do not identify what was actually published.\nfunction publicationAlertRequestId(candidate,requestRows=[],{selectedRequestId=null}={}){\n if(!scopeValid(candidate)||!Array.isArray(requestRows))return null;\n const rows=requestRows.filter(r=>r?.package_id===candidate.package_id&&r.revision===candidate.revision&&requestStages.has(r.stage));\n if(!rows.length||rows.some(r=>!requestPattern.test(r.request_id??'')))return null;\n const explicit=candidate.sourceRequestId??candidate.request_id;\n if(explicit!==null&&explicit!==undefined)return requestPattern.test(explicit)&&rows.some(r=>r.request_id===explicit)&&(selectedRequestId===null||selectedRequestId===explicit)?explicit:null;\n if(selectedRequestId!==null)return requestPattern.test(selectedRequestId)&&rows.some(r=>r.request_id===selectedRequestId)?selectedRequestId:null;\n const ids=[...new Set(rows.map(r=>r.request_id))];return ids.length===1?ids[0]:null;\n}\n\n// These are durable historical delivery records, not a cached claim that all\n// CMS remain published forever. Only the same publication uncertainty/progress\n// is superseded. Editorial/source failures and other requests remain visible.\nfunction publicationAlertWasReconciled(candidate,reconciliationRows=[],{requestRows=[],nowMs=Date.now()}={}){\n if(!scopeValid(candidate)||!Number.isFinite(timestamp(candidate.sourceOccurredAt))||!Array.isArray(reconciliationRows)||!Number.isFinite(nowMs)||!uncertainStages.has(candidate.sourceStage)&&!publicationProgressStages.has(candidate.sourceStage))return false;\n const terminals=reconciliationRows.filter(r=>r?.stage==='PUBLICATION_RECONCILED'&&Number.isSafeInteger(r.id)&&r.id>0&&r.package_id===candidate.package_id&&r.revision===candidate.revision&&requestPattern.test(r.request_id??'')&&Number.isFinite(timestamp(r.occurred_at))&&timestamp(r.occurred_at)<=nowMs+5000&&publicationAlertRequestId({...candidate,sourceRequestId:null,request_id:null},requestRows,{selectedRequestId:r.request_id})===r.request_id);\n const requests=[...new Set(terminals.map(r=>r.request_id))];if(requests.length!==1)return false;\n return publicationAlertRequestId(candidate,requestRows,{selectedRequestId:requests[0]})===requests[0];\n}\n\nfunction preparePublicationReconciliations(candidates,observations,{requestRows=[],reconciliationRows=[],nowMs=Date.now()}={}){\n if(!Array.isArray(candidates)||!Array.isArray(observations)||!Array.isArray(requestRows)||!Array.isArray(reconciliationRows)||!Number.isFinite(nowMs))throw Error('PUBLICATION_RECONCILIATION_INPUT_INVALID');\n const records=[],seen=new Set();\n for(const candidate of candidates){\n  if(!scopeValid(candidate)||!uncertainStages.has(candidate.sourceStage)||publicationAlertWasReconciled(candidate,reconciliationRows,{requestRows,nowMs}))continue;\n  const matches=observations.filter(p=>p?.packageId===candidate.package_id&&p.revision===candidate.revision);if(matches.length!==1)continue;\n  const proof=matches[0],requestId=publicationAlertRequestId(candidate,requestRows,{selectedRequestId:proof.requestId});\n  if(!requestId||proof.requestId!==requestId||!shouldSuppressUncertainPublicationAlert({package_id:candidate.package_id,revision:candidate.revision,stage:candidate.sourceStage,occurred_at:candidate.sourceOccurredAt},proof,{requestRows,nowMs}))continue;\n  // Conflicting durable terminal identities need explicit reconciliation;\n  // never append the same preferred identity on every poll to outvote them.\n  const conflicting=reconciliationRows.some(r=>r?.stage==='PUBLICATION_RECONCILED'&&Number.isSafeInteger(r.id)&&r.id>0&&r.package_id===candidate.package_id&&r.revision===candidate.revision&&r.request_id!==requestId&&Number.isFinite(timestamp(r.occurred_at))&&timestamp(r.occurred_at)<=nowMs+5000&&publicationAlertRequestId({...candidate,sourceRequestId:null,request_id:null},requestRows,{selectedRequestId:r.request_id})===r.request_id);\n  if(conflicting)continue;\n  const key=candidate.package_id+':'+candidate.revision+':'+requestId;if(seen.has(key))continue;seen.add(key);\n  records.push({package_id:candidate.package_id,revision:candidate.revision,stage:'PUBLICATION_RECONCILED',occurred_at:new Date(nowMs).toISOString(),request_id:requestId});\n }\n return records;\n}\n\n// The DataTable node returns the inserted row. A positive ID alone is not an\n// acknowledgement of this scope; verify every technical column and timestamp.\nfunction publicationReconciliationInsertConfirmed(expected,row){\n if(!scopeValid(expected)||expected.stage!=='PUBLICATION_RECONCILED'||!requestPattern.test(expected.request_id??'')||!Number.isFinite(timestamp(expected.occurred_at))||!row||Object.hasOwn(row,'error')||!Number.isSafeInteger(row.id)||row.id<1)return false;\n return row.package_id===expected.package_id&&row.revision===expected.revision&&row.stage===expected.stage&&row.request_id===expected.request_id&&Number.isFinite(timestamp(row.occurred_at))&&timestamp(row.occurred_at)===timestamp(expected.occurred_at);\n}\n\nfunction retainAlertsWithoutPublicationReconciliation(candidates,reconciliationRows,options={}){\n if(!Array.isArray(candidates))throw Error('ALERT_CANDIDATES_INVALID');\n return candidates.filter(candidate=>!publicationAlertWasReconciled(candidate,reconciliationRows,options));\n}\n\nreturn {publicationAlertRequestId,publicationAlertWasReconciled,preparePublicationReconciliations,publicationReconciliationInsertConfirmed,retainAlertsWithoutPublicationReconciliation};\n})();\nconst requestRows=$input.all().map(x=>x.json),reconciliationRows=requestRows.filter(x=>x.stage==='PUBLICATION_RECONCILED');\nconst selected=(()=>{\nconst cutoff=Date.parse(\"2026-11-06T20:10:11.863Z\"), now=Date.now();\nconst rows=$input.all().map(x=>x.json), groups=new Map();\nfor(const r of rows){if(!/^tg_[a-f0-9]{40}$/.test(r.package_id??'')||!Number.isSafeInteger(r.revision)||r.revision<1||!Number.isSafeInteger(r.id))continue;const key=r.package_id+':'+r.revision;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}\nconst failures={PUBLISH_UNCERTAIN:'Resultado de Publisher incierto',SOURCE_UNAVAILABLE:'Fuente no disponible',CONTENT_INSUFFICIENT:'Hace falta aclarar el contenido',MEDIA_FAILED:'No se pudo preparar la imagen',VALIDATION_FAILED:'Falló la validación editorial',DRAFT_FAILED:'Publisher rechazó o no confirmó la operación',DRAFT_UNCERTAIN:'Resultado de Publisher incierto',INTERNAL_ERROR:'Error técnico',COHERENCE_REQUIRED:'Las fuentes necesitan revisión de coherencia',INTEGRITY_FAILED:'No se pudo confirmar la integridad de una fuente',REVIEW_NOT_CONFIRMED:'No se confirmó la revisión de fuentes'};\nconst delays={QUEUED:'Espera inicio del Motor',PROGRESS_START:'Revisión de fuentes',PROGRESS_WRITING:'Redacción',PROGRESS_IMAGE:'Preparación de imagen',PROGRESS_SUBMIT:'Espera del resultado de Publisher'};\nconst notices=[];\nfor(const entries of groups.values()){\n const stages=entries.filter(x=>x.stage!=='PUBLICATION_RECONCILED'&&x.stage!=='ROUTING'&&!String(x.stage).startsWith('REQUEST_')&&!String(x.stage).startsWith('ALERT_')).sort((a,b)=>a.id-b.id);\n if(stages.some(x=>x.stage!=='QUEUED')){for(let i=stages.length-1;i>=0;i--)if(stages[i].stage==='QUEUED')stages.splice(i,1)}\n const last=stages.at(-1);if(!last||last.stage==='PROCESS_COMPLETE')continue;const publicationAlreadyAlerted=entries.some(x=>x.stage==='ALERT_ADMIN_'+last.id);if(publicationAlreadyAlerted&&!['DRAFT_UNCERTAIN','PUBLISH_UNCERTAIN'].includes(last.stage))continue;\n const when=Date.parse(last.occurred_at);if(!Number.isFinite(when)||when<cutoff)continue;\n const isFailure=Object.hasOwn(failures,last.stage),isDelay=Object.hasOwn(delays,last.stage)&&now-when>=600000;if(!isFailure&&!isDelay)continue;\n const owners=new Set(entries.filter(x=>['QUEUED','ROUTING'].includes(x.stage)&&typeof x.chat_id==='string'&&/^[1-9][0-9]{0,15}$/.test(x.chat_id)).map(x=>x.chat_id));\n const origin=owners.size===1?([...owners][0]==='123'?'Tu cuenta':'Otra cuenta'):'Cuenta no identificada';\n const publicationCandidate={package_id:last.package_id,revision:last.revision,stage:'ALERT_ADMIN_'+last.id,sourceStage:last.stage,sourceOccurredAt:last.occurred_at,sourceRequestId:last.request_id??null,alreadyAlerted:publicationAlreadyAlerted,occurred_at:new Date(now).toISOString(),summary:(isFailure?'BLOQUEO: '+failures[last.stage]:'DEMORA: '+delays[last.stage]+'. Estado todavía no confirmado'),origin};if(!persistence.publicationAlertWasReconciled(publicationCandidate,reconciliationRows,{requestRows,nowMs:now}))notices.push(publicationCandidate);\n}\nnotices.sort((a,b)=>Number(a.alreadyAlerted===true)-Number(b.alreadyAlerted===true)||a.package_id.localeCompare(b.package_id)||a.revision-b.revision);\nconst batch=notices.slice(0,20);if(!batch.length)return [];\nconst text='OPMX · alerta de administrador\\n\\n'+batch.map((x,i)=>(i+1)+'. '+x.summary+'\\n'+x.origin+' · paquete '+x.package_id+' · versión '+x.revision).join('\\n\\n')+'\\n\\nRevisa el estado antes de reintentar; una demora o un resultado incierto no confirma que se haya publicado.';\nreturn [{json:{chat_id:'123',text,alerts:batch}}];\n})();\nif(!Array.isArray(selected)||selected.length>1)throw Error('ALERT_BATCH_UNCONFIRMED');\nif(!selected.length)return [];\nconst batch=selected[0].json,candidates=batch?.alerts;if(typeof batch?.chat_id!=='string'||!Array.isArray(candidates)||!candidates.length||candidates.length>20)throw Error('ALERT_BATCH_UNCONFIRMED');\nconst identities=new Set(candidates.map(x=>x.package_id+':'+x.revision));\nconst correlations=requestRows.filter(x=>identities.has(x.package_id+':'+x.revision)&&String(x.stage).startsWith('REQUEST_')).map(x=>({package_id:x.package_id,revision:x.revision,stage:x.stage,request_id:x.request_id}));\nreturn [{json:{chatId:batch.chat_id,candidates,requestRows:correlations,reconciliationRows:reconciliationRows.filter(x=>identities.has(x.package_id+':'+x.revision)),needsObservation:candidates.some(x=>['DRAFT_UNCERTAIN','PUBLISH_UNCERTAIN'].includes(x.sourceStage))}}];"
      }
    },
    {
      "id": "synthetic-7",
      "name": "¿Conciliar alerta incierta?",
      "type": "n8n-nodes-base.if",
      "parameters": {}
    },
    {
      "id": "synthetic-8",
      "name": "Expandir comprobaciones inciertas",
      "type": "n8n-nodes-base.code",
      "parameters": {}
    },
    {
      "id": "synthetic-9",
      "name": "Comprobar publicación final Guard",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {}
    },
    {
      "id": "synthetic-10",
      "name": "Conservar comprobación de publicación",
      "type": "n8n-nodes-base.code",
      "parameters": {}
    },
    {
      "id": "synthetic-11",
      "name": "Preparar conciliaciones confirmadas",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": "const persistence=(()=>{\nconst PACKAGE=/^tg_[a-f0-9]{40}$/;\nconst REQUEST=/^tg_[a-f0-9]{64}$/;\nconst DIGEST=/^[a-f0-9]{64}$/;\nconst SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;\nconst SITES=['OPURO','OPOL','LIBERAL'];\nconst DESTINATIONS={\n OPURO:['OPURO'],OPOL:['OPOL'],AMBOS:['OPURO','OPOL'],LIBERAL:['LIBERAL'],\n 'OPURO,LIBERAL':['OPURO','LIBERAL'],'OPOL,LIBERAL':['OPOL','LIBERAL'],TODOS:SITES\n};\nconst UNCERTAIN=new Set(['DRAFT_UNCERTAIN','PUBLISH_UNCERTAIN']);\nconst revision=x=>Number.isSafeInteger(x)&&x>0&&x<=4294967295;\nconst time=x=>typeof x==='string'&&/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(x)?Date.parse(x):NaN;\n\n// The observation must come exclusively from the authenticated Guard's fixed\n// read-only final-publication endpoint. This validator does not authenticate a\n// caller or turn user/source text, Telegram notices or HTTP200 into evidence.\n// REQUEST rows are the receiver's existing immutable correlation records; the\n// Guard independently checks the canonical binding, receipt and CMS identities.\n// No URL, target, request ID or positive assertion is sent to the Guard by this\n// resolver. It only decides whether an already selected uncertain alert is stale.\nfunction shouldSuppressUncertainPublicationAlert(row,observation,{requestRows=[],nowMs=Date.now(),maxObservationAgeMs=120000}={}){\n if(!row||!UNCERTAIN.has(row.stage)||!PACKAGE.test(row.package_id??'')||!revision(row.revision)||!Number.isFinite(nowMs)||!Number.isSafeInteger(maxObservationAgeMs)||maxObservationAgeMs<0)return false;\n const x=observation;\n if(!x||typeof x!=='object'||Array.isArray(x)||x.schema!=='opmx.telegram.final-publication-observation.v1'||x.status!=='FINAL_PUBLICATION_CONFIRMED'||x.phase!=='PUBLISH'||x.receiptState!=='RECORDED'||x.packageId!==row.package_id||x.revision!==row.revision||!REQUEST.test(x.requestId??'')||!DIGEST.test(x.receiptHash??'')||typeof x.slug!=='string'||x.slug.length>200||!SLUG.test(x.slug)||x.writeAuthorized!==false||x.retryPermitted!==false||x.writersIdleVerified!==true||x.consistentSnapshot!==true)return false;\n const observed=time(x.observedAt),source=time(row.occurred_at);\n // Freshness only rejects stale/cache/future input. It never proves that a\n // writer stopped; writersIdleVerified and the locked Guard snapshot do that.\n if(!Number.isFinite(observed)||!Number.isFinite(source)||observed<source||observed>nowMs+5000||nowMs-observed>maxObservationAgeMs)return false;\n const requested=Object.hasOwn(DESTINATIONS,x.destination??'')?DESTINATIONS[x.destination]:null;\n if(!requested||!Array.isArray(x.targets)||x.targets.length!==requested.length)return false;\n if(x.targets.some((t,i)=>!t||typeof t!=='object'||t.destination!==requested[i]||!Number.isSafeInteger(t.postId)||t.postId<1||t.slug!==x.slug||t.status!=='publish'||t.cmsVerified!==true||t.ledgerVerified!==true))return false;\n if(!Array.isArray(requestRows))return false;\n const bindings=requestRows.filter(r=>r?.package_id===row.package_id&&r.revision===row.revision&&r.stage==='REQUEST_'+x.destination);\n return bindings.length===1&&bindings[0].request_id===x.requestId;\n}\n\n// Candidates retain the original stage/time, even though their outgoing\n// stage is ALERT_ADMIN_<row-id>. Never infer the reason from human text or\n// suppress unrelated alerts. Duplicate/ambiguous Guard responses fail closed.\nfunction retainUnresolvedPublicationAlerts(candidates,observations,options={}){\n if(!Array.isArray(candidates))throw Error('ALERT_CANDIDATES_INVALID');\n const proofs=Array.isArray(observations)?observations:[];\n return candidates.filter(candidate=>{\n  const matching=proofs.filter(x=>x?.packageId===candidate?.package_id&&x.revision===candidate?.revision);\n  if(matching.length!==1)return true;\n  const row={package_id:candidate.package_id,revision:candidate.revision,stage:candidate.sourceStage,occurred_at:candidate.sourceOccurredAt};\n  return !shouldSuppressUncertainPublicationAlert(row,matching[0],options);\n });\n}\n\n\nconst packagePattern=/^tg_[a-f0-9]{40}$/;\nconst requestPattern=/^tg_[a-f0-9]{64}$/;\nconst requestStages=new Set(['REQUEST_OPURO','REQUEST_OPOL','REQUEST_AMBOS','REQUEST_LIBERAL','REQUEST_OPURO,LIBERAL','REQUEST_OPOL,LIBERAL','REQUEST_TODOS']);\nconst uncertainStages=new Set(['DRAFT_UNCERTAIN','PUBLISH_UNCERTAIN']);\nconst publicationProgressStages=new Set(['QUEUED','PROGRESS_START','PROGRESS_WRITING','PROGRESS_IMAGE','PROGRESS_SUBMIT']);\nconst validRevision=n=>Number.isSafeInteger(n)&&n>0&&n<=4294967295;\nconst timestamp=s=>typeof s==='string'&&/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:\\d{2})$/.test(s)?Date.parse(s):NaN;\nconst scopeValid=x=>x&&packagePattern.test(x.package_id??'')&&validRevision(x.revision);\n\n// The Guard's verified final phase selects one of the revision's seven\n// pre-registered destination bindings. A source stage's explicit request must\n// still match. A legacy stage without one may use that verified selection;\n// seven available bindings alone do not identify what was actually published.\nfunction publicationAlertRequestId(candidate,requestRows=[],{selectedRequestId=null}={}){\n if(!scopeValid(candidate)||!Array.isArray(requestRows))return null;\n const rows=requestRows.filter(r=>r?.package_id===candidate.package_id&&r.revision===candidate.revision&&requestStages.has(r.stage));\n if(!rows.length||rows.some(r=>!requestPattern.test(r.request_id??'')))return null;\n const explicit=candidate.sourceRequestId??candidate.request_id;\n if(explicit!==null&&explicit!==undefined)return requestPattern.test(explicit)&&rows.some(r=>r.request_id===explicit)&&(selectedRequestId===null||selectedRequestId===explicit)?explicit:null;\n if(selectedRequestId!==null)return requestPattern.test(selectedRequestId)&&rows.some(r=>r.request_id===selectedRequestId)?selectedRequestId:null;\n const ids=[...new Set(rows.map(r=>r.request_id))];return ids.length===1?ids[0]:null;\n}\n\n// These are durable historical delivery records, not a cached claim that all\n// CMS remain published forever. Only the same publication uncertainty/progress\n// is superseded. Editorial/source failures and other requests remain visible.\nfunction publicationAlertWasReconciled(candidate,reconciliationRows=[],{requestRows=[],nowMs=Date.now()}={}){\n if(!scopeValid(candidate)||!Number.isFinite(timestamp(candidate.sourceOccurredAt))||!Array.isArray(reconciliationRows)||!Number.isFinite(nowMs)||!uncertainStages.has(candidate.sourceStage)&&!publicationProgressStages.has(candidate.sourceStage))return false;\n const terminals=reconciliationRows.filter(r=>r?.stage==='PUBLICATION_RECONCILED'&&Number.isSafeInteger(r.id)&&r.id>0&&r.package_id===candidate.package_id&&r.revision===candidate.revision&&requestPattern.test(r.request_id??'')&&Number.isFinite(timestamp(r.occurred_at))&&timestamp(r.occurred_at)<=nowMs+5000&&publicationAlertRequestId({...candidate,sourceRequestId:null,request_id:null},requestRows,{selectedRequestId:r.request_id})===r.request_id);\n const requests=[...new Set(terminals.map(r=>r.request_id))];if(requests.length!==1)return false;\n return publicationAlertRequestId(candidate,requestRows,{selectedRequestId:requests[0]})===requests[0];\n}\n\nfunction preparePublicationReconciliations(candidates,observations,{requestRows=[],reconciliationRows=[],nowMs=Date.now()}={}){\n if(!Array.isArray(candidates)||!Array.isArray(observations)||!Array.isArray(requestRows)||!Array.isArray(reconciliationRows)||!Number.isFinite(nowMs))throw Error('PUBLICATION_RECONCILIATION_INPUT_INVALID');\n const records=[],seen=new Set();\n for(const candidate of candidates){\n  if(!scopeValid(candidate)||!uncertainStages.has(candidate.sourceStage)||publicationAlertWasReconciled(candidate,reconciliationRows,{requestRows,nowMs}))continue;\n  const matches=observations.filter(p=>p?.packageId===candidate.package_id&&p.revision===candidate.revision);if(matches.length!==1)continue;\n  const proof=matches[0],requestId=publicationAlertRequestId(candidate,requestRows,{selectedRequestId:proof.requestId});\n  if(!requestId||proof.requestId!==requestId||!shouldSuppressUncertainPublicationAlert({package_id:candidate.package_id,revision:candidate.revision,stage:candidate.sourceStage,occurred_at:candidate.sourceOccurredAt},proof,{requestRows,nowMs}))continue;\n  // Conflicting durable terminal identities need explicit reconciliation;\n  // never append the same preferred identity on every poll to outvote them.\n  const conflicting=reconciliationRows.some(r=>r?.stage==='PUBLICATION_RECONCILED'&&Number.isSafeInteger(r.id)&&r.id>0&&r.package_id===candidate.package_id&&r.revision===candidate.revision&&r.request_id!==requestId&&Number.isFinite(timestamp(r.occurred_at))&&timestamp(r.occurred_at)<=nowMs+5000&&publicationAlertRequestId({...candidate,sourceRequestId:null,request_id:null},requestRows,{selectedRequestId:r.request_id})===r.request_id);\n  if(conflicting)continue;\n  const key=candidate.package_id+':'+candidate.revision+':'+requestId;if(seen.has(key))continue;seen.add(key);\n  records.push({package_id:candidate.package_id,revision:candidate.revision,stage:'PUBLICATION_RECONCILED',occurred_at:new Date(nowMs).toISOString(),request_id:requestId});\n }\n return records;\n}\n\n// The DataTable node returns the inserted row. A positive ID alone is not an\n// acknowledgement of this scope; verify every technical column and timestamp.\nfunction publicationReconciliationInsertConfirmed(expected,row){\n if(!scopeValid(expected)||expected.stage!=='PUBLICATION_RECONCILED'||!requestPattern.test(expected.request_id??'')||!Number.isFinite(timestamp(expected.occurred_at))||!row||Object.hasOwn(row,'error')||!Number.isSafeInteger(row.id)||row.id<1)return false;\n return row.package_id===expected.package_id&&row.revision===expected.revision&&row.stage===expected.stage&&row.request_id===expected.request_id&&Number.isFinite(timestamp(row.occurred_at))&&timestamp(row.occurred_at)===timestamp(expected.occurred_at);\n}\n\nfunction retainAlertsWithoutPublicationReconciliation(candidates,reconciliationRows,options={}){\n if(!Array.isArray(candidates))throw Error('ALERT_CANDIDATES_INVALID');\n return candidates.filter(candidate=>!publicationAlertWasReconciled(candidate,reconciliationRows,options));\n}\n\nreturn {publicationAlertRequestId,publicationAlertWasReconciled,preparePublicationReconciliations,publicationReconciliationInsertConfirmed,retainAlertsWithoutPublicationReconciliation};\n})();\nconst contexts=$input.all().map(x=>x.json);if(!contexts.length)return [];const batch=contexts[0],signature=JSON.stringify({chatId:batch.chatId,candidates:batch.candidates,requestRows:batch.requestRows,reconciliationRows:batch.reconciliationRows});\nif(contexts.some(batch=>JSON.stringify({chatId:batch.chatId,candidates:batch.candidates,requestRows:batch.requestRows,reconciliationRows:batch.reconciliationRows})!==signature))throw Error('ALERT_BATCH_CONTEXT_MISMATCH');\nconst observations=contexts.map(x=>x.observation).filter(x=>x&&typeof x==='object');\nconst records=persistence.preparePublicationReconciliations(batch.candidates,observations,{requestRows:batch.requestRows,reconciliationRows:batch.reconciliationRows,nowMs:Date.now()});\nreturn [{json:{...batch,reconciliationRecords:records,needsPersistence:records.length>0}}];"
      }
    },
    {
      "id": "synthetic-12",
      "name": "¿Guardar conciliación confirmada?",
      "type": "n8n-nodes-base.if",
      "parameters": {}
    },
    {
      "id": "synthetic-13",
      "name": "Expandir conciliaciones verificadas",
      "type": "n8n-nodes-base.code",
      "parameters": {}
    },
    {
      "id": "synthetic-14",
      "name": "Registrar publicación conciliada",
      "type": "n8n-nodes-base.dataTable",
      "parameters": {}
    },
    {
      "id": "synthetic-15",
      "name": "Verificar conciliación registrada",
      "type": "n8n-nodes-base.code",
      "parameters": {}
    }
  ],
  "connections": {
    "Revisar alertas cada cinco minutos": {
      "main": [
        [
          {
            "node": "Leer seguimiento para administrador",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Seleccionar alertas de administrador": {
      "main": [
        [
          {
            "node": "Notificar administrador",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Notificar administrador": {
      "main": [
        [
          {
            "node": "Verificar acuse administrador",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Verificar acuse administrador": {
      "main": [
        [
          {
            "node": "Registrar alertas confirmadas",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Leer seguimiento para administrador": {
      "main": [
        [
          {
            "node": "Preparar comprobación de alertas",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar comprobación de alertas": {
      "main": [
        [
          {
            "node": "¿Conciliar alerta incierta?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Conciliar alerta incierta?": {
      "main": [
        [
          {
            "node": "Expandir comprobaciones inciertas",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Preparar conciliaciones confirmadas",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Expandir comprobaciones inciertas": {
      "main": [
        [
          {
            "node": "Comprobar publicación final Guard",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Comprobar publicación final Guard": {
      "main": [
        [
          {
            "node": "Conservar comprobación de publicación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Conservar comprobación de publicación": {
      "main": [
        [
          {
            "node": "Preparar conciliaciones confirmadas",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar conciliaciones confirmadas": {
      "main": [
        [
          {
            "node": "¿Guardar conciliación confirmada?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Guardar conciliación confirmada?": {
      "main": [
        [
          {
            "node": "Expandir conciliaciones verificadas",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Seleccionar alertas de administrador",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Expandir conciliaciones verificadas": {
      "main": [
        [
          {
            "node": "Registrar publicación conciliada",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Registrar publicación conciliada": {
      "main": [
        [
          {
            "node": "Verificar conciliación registrada",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Verificar conciliación registrada": {
      "main": [
        [
          {
            "node": "Seleccionar alertas de administrador",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "nodeGroups": []
};
