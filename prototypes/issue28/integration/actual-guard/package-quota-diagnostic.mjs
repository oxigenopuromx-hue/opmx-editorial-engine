// Bounded diagnostics only. The package store remains the authority for locks,
// quota decisions and accounting; these helpers never change a counter.
export const packageCapacityLimits=Object.freeze({items:20,recoveryItems:40,packageBytes:26214400,totalBytes:134217728,packages:1000,closeControlAllowance:1024});
const integer=value=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:
 typeof value==='string'&&/^(?:0|[1-9][0-9]*)$/.test(value)&&Number.isSafeInteger(Number(value))?Number(value):null;
const safeAdd=(a,b)=>Number.isSafeInteger(a+b)?a+b:null;
const unknownQuota=operation=>({schema:'opmx.package-quota-diagnostic.v1',operation:['OPEN','RESERVE'].includes(operation)?operation:'UNKNOWN',code:'QUOTA_DIAGNOSTIC_UNCONFIRMED',limitsExceeded:[]});

// Pass the effective limits computed by the existing store, including its
// reserved closing slot/byte allowance. No new allowance is granted here.
export function diagnosePackageQuotaFailure({operation,pack,quota,requestedBytes=0,itemLimit,packageBytesLimit,totalBytesLimit,packageLimit=packageCapacityLimits.packages,recovery=false}={}){
 const failures=[];
 const add=(code,scope,used,limit,requested)=>failures.push({code,scope,used,limit,requested});
 if(operation==='OPEN'){
  const used=integer(quota?.package_count),limit=integer(packageLimit);
  if(used===null||limit===null||limit===0)return unknownQuota(operation);
  if(used>=limit)add('GLOBAL_PACKAGES_LIMIT','GLOBAL_PACKAGES',used,limit,1);
 }else if(operation==='RESERVE'){
  const items=integer(pack?.item_count),packBytes=integer(pack?.used_bytes),globalBytes=integer(quota?.used_bytes),requested=integer(requestedBytes),slots=integer(itemLimit),packLimit=integer(packageBytesLimit),globalLimit=integer(totalBytesLimit);
  if([items,packBytes,globalBytes,requested,slots,packLimit,globalLimit].includes(null)||slots===0||packLimit===0||globalLimit===0||typeof recovery!=='boolean'||safeAdd(packBytes,requested)===null||safeAdd(globalBytes,requested)===null)return unknownQuota(operation);
  if(items>=slots)add(recovery?'RECOVERY_ITEMS_LIMIT':'PACKAGE_ITEMS_LIMIT','PACKAGE_ITEMS',items,slots,1);
  if(packBytes+requested>packLimit)add('PACKAGE_BYTES_LIMIT','PACKAGE_BYTES',packBytes,packLimit,requested);
  if(globalBytes+requested>globalLimit)add('GLOBAL_BYTES_LIMIT','GLOBAL_BYTES',globalBytes,globalLimit,requested);
 }else return unknownQuota(operation);
 if(!failures.length)return unknownQuota(operation);
 return {schema:'opmx.package-quota-diagnostic.v1',operation,code:failures[0].code,limitsExceeded:failures};
}

// Self-contained so the Receiver builder can embed this exact function. A
// legacy or unconfirmed diagnostic returns null and preserves its old fallback.
export function formatQuotaDiagnosticText(diagnostic){
 const codes={GLOBAL_PACKAGES_LIMIT:'GLOBAL_PACKAGES',PACKAGE_ITEMS_LIMIT:'PACKAGE_ITEMS',RECOVERY_ITEMS_LIMIT:'PACKAGE_ITEMS',PACKAGE_BYTES_LIMIT:'PACKAGE_BYTES',GLOBAL_BYTES_LIMIT:'GLOBAL_BYTES'};
 if(!diagnostic||typeof diagnostic!=='object'||Array.isArray(diagnostic)||Object.keys(diagnostic).sort().join(',')!=='code,limitsExceeded,operation,schema'||diagnostic.schema!=='opmx.package-quota-diagnostic.v1'||!['OPEN','RESERVE'].includes(diagnostic.operation)||!Object.hasOwn(codes,diagnostic.code)||!Array.isArray(diagnostic.limitsExceeded)||diagnostic.limitsExceeded.length<1||diagnostic.limitsExceeded.length>3||diagnostic.limitsExceeded[0]?.code!==diagnostic.code)return null;
 const seen=new Set(),lines=[];
 for(const entry of diagnostic.limitsExceeded){
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).sort().join(',')!=='code,limit,requested,scope,used'||!Object.hasOwn(codes,entry.code)||seen.has(entry.scope)||entry.scope!==codes[entry.code]||![entry.used,entry.limit,entry.requested].every(n=>Number.isSafeInteger(n)&&n>=0)||entry.limit===0||!Number.isSafeInteger(entry.used+entry.requested))return null;
  seen.add(entry.scope);
  if(diagnostic.operation==='OPEN'?(entry.code!=='GLOBAL_PACKAGES_LIMIT'||entry.requested!==1):(entry.code==='GLOBAL_PACKAGES_LIMIT'))return null;
  if(entry.scope==='PACKAGE_ITEMS'||entry.scope==='GLOBAL_PACKAGES'){
   if(entry.used<entry.limit||entry.requested!==1)return null;
  }else if(entry.used+entry.requested<=entry.limit)return null;
  if(entry.code==='GLOBAL_PACKAGES_LIMIT')lines.push(`Se alcanzó el límite global de paquetes guardados (${entry.used}/${entry.limit}). Consulta al administrador.`);
  else if(entry.code==='PACKAGE_ITEMS_LIMIT')lines.push(`Este paquete alcanzó el límite de elementos (${entry.used}/${entry.limit}). Revisa /estado.`);
  else if(entry.code==='RECOVERY_ITEMS_LIMIT')lines.push(`El paquete reabierto alcanzó el límite de elementos (${entry.used}/${entry.limit}). Revisa /estado.`);
  else if(entry.code==='PACKAGE_BYTES_LIMIT')lines.push(`El mensaje supera el cupo de este paquete: ${entry.used} de ${entry.limit} bytes usados; necesita ${entry.requested} bytes.`);
  else if(entry.code==='GLOBAL_BYTES_LIMIT')lines.push(`El mensaje supera el almacenamiento global: ${entry.used} de ${entry.limit} bytes usados; necesita ${entry.requested} bytes. Consulta al administrador.`);
 }
 return (diagnostic.operation==='OPEN'?'No se abrió otro paquete.\n':'No se guardó este mensaje.\n')+lines.join('\n');
}

// A single plain SELECT gives a consistent statement snapshot in InnoDB. It
// returns only global aggregates: no identities, source text, blobs or tokens.
// DISCARDED originals still consume retained bytes and a slot. Only an empty
// discarded pending reservation with reserved_bytes=0 releases its slot under
// the current accounting rule. Historical differences require manual review.
export const packageCapacityAuditSql=`SELECT
 (SELECT COUNT(*) FROM opmx_tg_quota_v1 WHERE id=1) AS quota_rows,
 (SELECT used_bytes FROM opmx_tg_quota_v1 WHERE id=1) AS quota_used_bytes,
 (SELECT package_count FROM opmx_tg_quota_v1 WHERE id=1) AS quota_package_count,
 (SELECT COUNT(*) FROM opmx_tg_packages_v1) AS package_rows,
 (SELECT COALESCE(SUM(used_bytes),0) FROM opmx_tg_packages_v1) AS package_used_bytes,
 (SELECT COALESCE(SUM(item_count),0) FROM opmx_tg_packages_v1) AS package_item_slots,
 (SELECT COUNT(*) FROM opmx_tg_packages_v1 WHERE state='OPEN') AS open_packages,
 (SELECT COUNT(*) FROM opmx_tg_packages_v1 WHERE state='READY') AS ready_packages,
 (SELECT COUNT(*) FROM opmx_tg_packages_v1 WHERE state='CANCELLED') AS cancelled_packages,
 (SELECT COUNT(*) FROM opmx_tg_items_v1) AS item_rows,
 (SELECT COUNT(*) FROM opmx_tg_items_v1 WHERE state='PENDING') AS pending_items,
 (SELECT COALESCE(SUM(reserved_bytes),0) FROM opmx_tg_items_v1 WHERE state='PENDING') AS pending_reserved_bytes,
 (SELECT COALESCE(SUM(CASE WHEN kind='TEXT' THEN content_bytes ELSE OCTET_LENGTH(content_blob) END),0) FROM opmx_tg_items_v1 WHERE state IN ('STORED','DISCARDED')) AS retained_committed_bytes,
 (SELECT COUNT(*) FROM opmx_tg_items_v1 WHERE state='DISCARDED' AND reserved_bytes=0 AND content_bytes=0 AND content_blob IS NULL) AS released_pending_rows,
 (SELECT COUNT(*) FROM opmx_tg_packages_v1 p WHERE p.state='OPEN' AND p.item_count>=21 AND NOT EXISTS (SELECT 1 FROM opmx_tg_recovery_leases_v1 l WHERE BINARY l.package_id=BINARY p.package_id)) AS normal_open_at_control_limit,
 (SELECT COUNT(*) FROM opmx_tg_packages_v1 p WHERE p.state='OPEN' AND p.item_count>=40 AND EXISTS (SELECT 1 FROM opmx_tg_recovery_leases_v1 l WHERE BINARY l.package_id=BINARY p.package_id) AND NOT EXISTS (SELECT 1 FROM opmx_tg_correction_previews_v1 v WHERE BINARY v.package_id=BINARY p.package_id AND v.revision=p.revision) AND NOT EXISTS (SELECT 1 FROM opmx_tg_preview_generation_v1 g WHERE BINARY g.package_id=BINARY p.package_id AND g.revision=p.revision)) AS recovery_open_at_control_limit_without_durable_result`;
const auditFields=['quota_rows','quota_used_bytes','quota_package_count','package_rows','package_used_bytes','package_item_slots','open_packages','ready_packages','cancelled_packages','item_rows','pending_items','pending_reserved_bytes','retained_committed_bytes','released_pending_rows','normal_open_at_control_limit','recovery_open_at_control_limit_without_durable_result'];
const unavailable=()=>({schema:'opmx.package-capacity-audit.v1',status:'CAPACITY_UNCONFIRMED',readOnly:true});

export async function readPackageCapacityAudit(connection,{limits=packageCapacityLimits}={}){
 const packageLimit=integer(limits?.packages),byteLimit=integer(limits?.totalBytes);
 if(typeof connection?.execute!=='function'||packageLimit===null||byteLimit===null||packageLimit===0||byteLimit===0)return unavailable();
 try{
  const [rows]=await connection.execute(packageCapacityAuditSql);
  if(!Array.isArray(rows)||rows.length!==1||!rows[0])return unavailable();
  const n=Object.fromEntries(auditFields.map(key=>[key,integer(rows[0][key])]));
  if(Object.values(n).includes(null)||n.quota_rows!==1||n.released_pending_rows>n.item_rows||n.pending_items>n.item_rows)return unavailable();
  const legacyRiskCount=safeAdd(n.normal_open_at_control_limit,n.recovery_open_at_control_limit_without_durable_result);
  if(legacyRiskCount===null||legacyRiskCount>n.open_packages)return unavailable();
  const accountedBytes=safeAdd(n.pending_reserved_bytes,n.retained_committed_bytes);
  if(accountedBytes===null)return unavailable();
  const differences={packageCount:n.quota_package_count-n.package_rows,quotaVsPackageBytes:n.quota_used_bytes-n.package_used_bytes,packageVsAccountedBytes:n.package_used_bytes-accountedBytes,packageVsCurrentRuleSlots:n.package_item_slots-(n.item_rows-n.released_pending_rows)};
  return {schema:'opmx.package-capacity-audit.v1',status:'CAPACITY_OBSERVED',readOnly:true,readConsistency:'ONE_STATEMENT_SNAPSHOT',
   capacity:{packages:{used:n.quota_package_count,limit:packageLimit,remaining:Math.max(0,packageLimit-n.quota_package_count)},bytes:{used:n.quota_used_bytes,limit:byteLimit,remaining:Math.max(0,byteLimit-n.quota_used_bytes)}},
   inventory:{packages:n.package_rows,open:n.open_packages,ready:n.ready_packages,cancelled:n.cancelled_packages,itemRows:n.item_rows,packageItemSlots:n.package_item_slots,pendingItems:n.pending_items,pendingReservedBytes:n.pending_reserved_bytes,retainedCommittedBytes:n.retained_committed_bytes,releasedPendingRows:n.released_pending_rows},
   legacyCloseRisk:{normalOpenAtControlLimit:n.normal_open_at_control_limit,recoveryOpenAtControlLimitWithoutDurableResult:n.recovery_open_at_control_limit_without_durable_result,requiresReconciliation:legacyRiskCount>0,interpretation:'RISK_COUNTS_ONLY_NOT_CONFIRMED_INCIDENT'},
   accounting:{differences,matchesCurrentRules:Object.values(differences).every(value=>value===0),interpretation:'CURRENT_RULES_LEGACY_DIFFERENCES_REQUIRE_REVIEW'},
   authorizesDeletion:false,authorizesLimitChange:false};
 }catch{return unavailable()}
}
