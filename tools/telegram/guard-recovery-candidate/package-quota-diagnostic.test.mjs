import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnosePackageQuotaFailure as diagnose,formatQuotaDiagnosticText,readPackageCapacityAudit,packageCapacityAuditSql,packageCapacityLimits as limits} from './package-quota-diagnostic.mjs';

const base=()=>({operation:'RESERVE',pack:{item_count:1,used_bytes:100},quota:{used_bytes:200},requestedBytes:10,itemLimit:20,packageBytesLimit:limits.packageBytes,totalBytesLimit:limits.totalBytes});
test('quota diagnostic identifies global package count independently of bytes',()=>{
 const result=diagnose({operation:'OPEN',quota:{package_count:'1000'}});
 assert.equal(result.code,'GLOBAL_PACKAGES_LIMIT');assert.deepEqual(result.limitsExceeded,[{code:'GLOBAL_PACKAGES_LIMIT',scope:'GLOBAL_PACKAGES',used:1000,limit:1000,requested:1}]);
});
test('item diagnostics preserve the effective normal and recovery closing limits',()=>{
 for(const [recovery,itemLimit,code]of [[false,20,'PACKAGE_ITEMS_LIMIT'],[false,21,'PACKAGE_ITEMS_LIMIT'],[true,39,'RECOVERY_ITEMS_LIMIT'],[true,40,'RECOVERY_ITEMS_LIMIT']]){
  const input=base();Object.assign(input,{recovery,itemLimit});input.pack.item_count=itemLimit;
  const result=diagnose(input);assert.equal(result.code,code);assert.equal(result.limitsExceeded[0].limit,itemLimit);
 }
});
test('package and global bytes are distinguished without rounding',()=>{
 const p=base();p.pack.used_bytes=limits.packageBytes-9;assert.equal(diagnose(p).code,'PACKAGE_BYTES_LIMIT');
 const g=base();g.quota.used_bytes=limits.totalBytes-9;assert.equal(diagnose(g).code,'GLOBAL_BYTES_LIMIT');
});
test('simultaneous limits are all reported in fixed order',()=>{
 const input=base();input.pack.item_count=20;input.pack.used_bytes=limits.packageBytes;input.quota.used_bytes=limits.totalBytes;
 assert.deepEqual(diagnose(input).limitsExceeded.map(x=>x.code),['PACKAGE_ITEMS_LIMIT','PACKAGE_BYTES_LIMIT','GLOBAL_BYTES_LIMIT']);
});
test('an applied close byte allowance is described exactly and never invented',()=>{
 const input=base();input.pack.used_bytes=limits.packageBytes;input.quota.used_bytes=limits.totalBytes;input.requestedBytes=limits.closeControlAllowance;
 assert.equal(diagnose(input).code,'PACKAGE_BYTES_LIMIT');
 input.packageBytesLimit+=limits.closeControlAllowance;input.totalBytesLimit+=limits.closeControlAllowance*limits.packages;
 assert.equal(diagnose(input).code,'QUOTA_DIAGNOSTIC_UNCONFIRMED');
});
test('invalid or non-exceeded inputs produce a bounded unconfirmed diagnosis',()=>{
 for(const mutate of [x=>x.pack.used_bytes=-1,x=>x.requestedBytes=Number.MAX_SAFE_INTEGER,x=>x.itemLimit=0,x=>x.operation='secret',x=>x.quota.used_bytes='http://private.invalid',()=>{}]){
  const input=base();mutate(input);const output=diagnose(input);assert.equal(output.code,'QUOTA_DIAGNOSTIC_UNCONFIRMED');assert.equal(JSON.stringify(output).includes('private.invalid'),false);
 }
});
test('diagnosis does not emit input identities, text, attachments or unknown fields',()=>{
 const input={...base(),token:'SECRET',source:'SECRET',chatId:'SECRET'};input.pack={...input.pack,item_count:20,owner_key:'SECRET'};
 assert.equal(JSON.stringify(diagnose(input)).includes('SECRET'),false);
});
test('Receiver formatter explains the bounded package and global reasons',()=>{
 const input=base();input.pack.item_count=20;input.pack.used_bytes=limits.packageBytes;input.quota.used_bytes=limits.totalBytes;
 const text=formatQuotaDiagnosticText(diagnose(input));assert.match(text,/No se guardó este mensaje/);assert.match(text,/límite de elementos \(20\/20\)/);assert.match(text,/cupo de este paquete/);assert.match(text,/almacenamiento global/);
 const global=formatQuotaDiagnosticText(diagnose({operation:'OPEN',quota:{package_count:1000}}));assert.match(global,/límite global de paquetes guardados \(1000\/1000\)/);
 input.recovery=true;input.itemLimit=40;input.pack.item_count=40;assert.match(formatQuotaDiagnosticText(diagnose(input)),/paquete reabierto/);
});
test('Receiver formatter is self-contained when embedded in a Code node',()=>{
 const isolated=new Function('return ('+formatQuotaDiagnosticText.toString()+')')();
 const diagnostic=diagnose({operation:'OPEN',quota:{package_count:1000}});assert.equal(isolated(diagnostic),formatQuotaDiagnosticText(diagnostic));
});
test('Receiver formatter preserves the generic fallback for legacy and unconfirmed responses',()=>{
 for(const value of [null,{},undefined,diagnose(base()),{schema:'old',code:'GLOBAL_PACKAGES_LIMIT'}])assert.equal(formatQuotaDiagnosticText(value),null);
});
test('Receiver formatter cannot echo injected labels, IDs, raw codes or unsafe numbers',()=>{
 const good=diagnose({operation:'OPEN',quota:{package_count:1000}});
 const bads=[{...good,code:'SECRET'},{...good,limitsExceeded:[{...good.limitsExceeded[0],scope:'SECRET'}]},{...good,limitsExceeded:[{...good.limitsExceeded[0],used:'SECRET'}]},{...good,limitsExceeded:[{...good.limitsExceeded[0],used:-1}]},{...good,limitsExceeded:[{...good.limitsExceeded[0],requested:Number.MAX_SAFE_INTEGER}]},{...good,source:'SECRET'}];
 for(const bad of bads){const text=formatQuotaDiagnosticText(bad);assert.equal(text,null);assert.equal(String(text).includes('SECRET'),false)}
});
test('Receiver formatter rejects contradictory or duplicated quota reasons',()=>{
 const good=diagnose({operation:'OPEN',quota:{package_count:1000}});
 for(const bad of [{...good,operation:'RESERVE'},{...good,limitsExceeded:[{...good.limitsExceeded[0],used:999}]},{...good,limitsExceeded:[...good.limitsExceeded,...good.limitsExceeded]},{...good,limitsExceeded:[{...good.limitsExceeded[0],requested:0}]}])assert.equal(formatQuotaDiagnosticText(bad),null);
});

const row=()=>({quota_rows:1,quota_used_bytes:120,quota_package_count:3,package_rows:3,package_used_bytes:120,package_item_slots:4,open_packages:1,ready_packages:1,cancelled_packages:1,item_rows:5,pending_items:1,pending_reserved_bytes:20,retained_committed_bytes:100,released_pending_rows:1,normal_open_at_control_limit:0,recovery_open_at_control_limit_without_durable_result:0});
function connection(result=row()){const calls=[];return {calls,async execute(sql,...args){calls.push({sql,args});return [[result]]}}}
test('capacity audit uses one plain aggregate SELECT and returns no source rows',async()=>{
 const c=connection(),result=await readPackageCapacityAudit(c);assert.equal(result.status,'CAPACITY_OBSERVED');assert.equal(result.accounting.matchesCurrentRules,true);assert.equal(result.inventory.cancelled,1);assert.equal(result.inventory.retainedCommittedBytes,100);assert.equal(result.inventory.pendingReservedBytes,20);assert.equal(result.capacity.packages.remaining,997);assert.equal(result.authorizesDeletion,false);assert.equal(result.authorizesLimitChange,false);
 assert.equal(c.calls.length,1);assert.equal(c.calls[0].sql,packageCapacityAuditSql);assert.deepEqual(c.calls[0].args,[]);assert.match(packageCapacityAuditSql,/^SELECT/);assert.doesNotMatch(packageCapacityAuditSql,/\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|LOCK|FOR\s+UPDATE)\b/i);
 assert.doesNotMatch(packageCapacityAuditSql,/\bSELECT\s+(?:[a-z]+\.)?(?:owner_key|package_id|item_id|text_content|secret|token)\b/i);assert.doesNotMatch(packageCapacityAuditSql,/\b(?:text_content|secret|token)\b/);
 assert.deepEqual(result.legacyCloseRisk,{normalOpenAtControlLimit:0,recoveryOpenAtControlLimitWithoutDurableResult:0,requiresReconciliation:false,interpretation:'RISK_COUNTS_ONLY_NOT_CONFIRMED_INCIDENT'});
});
test('audit accepts MySQL decimal strings without loss of precision',async()=>{
 const raw=Object.fromEntries(Object.entries(row()).map(([key,value])=>[key,String(value)])),result=await readPackageCapacityAudit(connection(raw));
 assert.equal(result.status,'CAPACITY_OBSERVED');assert.equal(result.accounting.matchesCurrentRules,true);
});
test('audit exposes discrepancies rather than repairing or hiding them',async()=>{
 const r=row();r.quota_package_count=4;r.quota_used_bytes=124;r.package_used_bytes=122;r.package_item_slots=5;
 const c=connection(r),result=await readPackageCapacityAudit(c);assert.equal(result.accounting.matchesCurrentRules,false);assert.deepEqual(result.accounting.differences,{packageCount:1,quotaVsPackageBytes:2,packageVsAccountedBytes:2,packageVsCurrentRuleSlots:1});assert.equal(c.calls.length,1);
});
test('audit retains originals and counts cancelled packages instead of implying free capacity',async()=>{
 const r=row();r.quota_package_count=1001;r.package_rows=1001;r.cancelled_packages=999;r.quota_used_bytes=limits.totalBytes+1024;r.package_used_bytes=r.quota_used_bytes;r.retained_committed_bytes=r.quota_used_bytes-20;
 const output=await readPackageCapacityAudit(connection(r));assert.equal(output.capacity.packages.remaining,0);assert.equal(output.capacity.bytes.remaining,0);assert.equal(output.inventory.cancelled,999);assert.equal(output.authorizesDeletion,false);
 assert.match(packageCapacityAuditSql,/state IN \('STORED','DISCARDED'\)/);assert.match(packageCapacityAuditSql,/state='PENDING'/);
});
test('legacy close risk reports only bounded counts and requires reconciliation without claiming an incident',async()=>{
 const r=row();r.open_packages=2;r.ready_packages=0;r.normal_open_at_control_limit=1;r.recovery_open_at_control_limit_without_durable_result=1;
 const result=await readPackageCapacityAudit(connection(r));assert.equal(result.status,'CAPACITY_OBSERVED');assert.deepEqual(result.legacyCloseRisk,{normalOpenAtControlLimit:1,recoveryOpenAtControlLimitWithoutDurableResult:1,requiresReconciliation:true,interpretation:'RISK_COUNTS_ONLY_NOT_CONFIRMED_INCIDENT'});
 assert.equal(result.authorizesDeletion,false);assert.equal(result.authorizesLimitChange,false);assert.equal(JSON.stringify(result.legacyCloseRisk).includes('package_id'),false);
 assert.match(packageCapacityAuditSql,/p\.state='OPEN' AND p\.item_count>=21 AND NOT EXISTS \(SELECT 1 FROM opmx_tg_recovery_leases_v1/);
 assert.match(packageCapacityAuditSql,/p\.state='OPEN' AND p\.item_count>=40 AND EXISTS \(SELECT 1 FROM opmx_tg_recovery_leases_v1/);
 assert.match(packageCapacityAuditSql,/NOT EXISTS \(SELECT 1 FROM opmx_tg_correction_previews_v1 v WHERE BINARY v\.package_id=BINARY p\.package_id AND v\.revision=p\.revision\)/);
 assert.match(packageCapacityAuditSql,/NOT EXISTS \(SELECT 1 FROM opmx_tg_preview_generation_v1 g WHERE BINARY g\.package_id=BINARY p\.package_id AND g\.revision=p\.revision\)/);
});
test('failed, missing, ambiguous or unsafe numeric audit results remain unconfirmed',async()=>{
 const bads=[{...row(),quota_rows:0},{...row(),quota_used_bytes:null},{...row(),item_rows:1,released_pending_rows:2},{...row(),quota_used_bytes:'9007199254740992'},{...row(),pending_reserved_bytes:Number.MAX_SAFE_INTEGER,retained_committed_bytes:1},{...row(),normal_open_at_control_limit:2},{...row(),recovery_open_at_control_limit_without_durable_result:'SECRET'}];
 for(const bad of bads)assert.equal((await readPackageCapacityAudit(connection(bad))).status,'CAPACITY_UNCONFIRMED');
 const error=await readPackageCapacityAudit({async execute(){throw Error('SECRET database host')}});assert.equal(error.status,'CAPACITY_UNCONFIRMED');assert.equal(JSON.stringify(error).includes('SECRET'),false);
 assert.equal((await readPackageCapacityAudit({async execute(){return [[],[]]}})).status,'CAPACITY_UNCONFIRMED');
});
