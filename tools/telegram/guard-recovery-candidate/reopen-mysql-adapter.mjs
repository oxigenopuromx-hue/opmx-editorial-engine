// Candidate only. Schema installation is explicit; this module never executes
// DDL on production or silently fabricates reconciliation evidence.
const schema=[
  `CREATE TABLE IF NOT EXISTS opmx_tg_revision_snapshots_v1 (package_id VARCHAR(43) CHARACTER SET ascii NOT NULL, revision INT UNSIGNED NOT NULL, owner_key CHAR(64) CHARACTER SET ascii NOT NULL, snapshot_json LONGTEXT NOT NULL, created_at DATETIME(6) NOT NULL, PRIMARY KEY(package_id,revision)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS opmx_tg_recovery_leases_v1 (package_id VARCHAR(43) CHARACTER SET ascii PRIMARY KEY, actor_key CHAR(64) CHARACTER SET ascii NOT NULL, owner_key CHAR(64) CHARACTER SET ascii NOT NULL, opening_revision INT UNSIGNED NOT NULL, receipt_id VARCHAR(128) CHARACTER SET ascii NOT NULL UNIQUE, created_at DATETIME(6) NOT NULL) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS opmx_tg_recovery_audit_v1 (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, package_id VARCHAR(43) CHARACTER SET ascii NOT NULL, action VARCHAR(32) CHARACTER SET ascii NOT NULL, previous_revision INT UNSIGNED NOT NULL, revision INT UNSIGNED NOT NULL, actor_key CHAR(64) CHARACTER SET ascii NOT NULL, owner_key CHAR(64) CHARACTER SET ascii NOT NULL, created_at DATETIME(6) NOT NULL, KEY(package_id,revision)) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS opmx_tg_recovery_contributions_v1 (item_id VARCHAR(43) CHARACTER SET ascii PRIMARY KEY, package_id VARCHAR(43) CHARACTER SET ascii NOT NULL, actor_key CHAR(64) CHARACTER SET ascii NOT NULL, created_at DATETIME(6) NOT NULL, KEY(package_id)) ENGINE=InnoDB`
];
export function recoverySchema(){return [...schema];}

// The evidence provider must be server-owned and hold an enforceable publication
// fence for this transaction; no such provider exists in production yet. Without
// one, every READY package is rejected by reopen-service, not reopened.
export function createRecoveryMysqlAdapter(pool,{lockTrustedSafetyBarrier=null,captureTrustedRevision=null}={}){
  if(!pool||typeof pool.getConnection!=='function'||(lockTrustedSafetyBarrier!==null&&typeof lockTrustedSafetyBarrier!=='function')||(captureTrustedRevision!==null&&typeof captureTrustedRevision!=='function'))throw Error('INVALID_CONFIGURATION');
  return {async transaction(operation){
    const c=await pool.getConnection();let committed=false;
    try{
      await c.beginTransaction();
      const tx={
        async lockQuota(){const [rows]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(rows.length!==1)throw Error('QUOTA_MISSING');},
        async lockPackage(id){const [rows]=await c.execute('SELECT package_id,owner_key,state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[id]);if(!rows.length)return null;const p=rows[0];return {id:p.package_id,ownerKey:p.owner_key,state:p.state,revision:Number(p.revision)};},
        async lockSession(actor){const [rows]=await c.execute('SELECT package_id FROM opmx_tg_sessions_v1 WHERE owner_key=? FOR UPDATE',[actor]);return rows.length?{packageId:rows[0].package_id}:null;},
        async lockLease(id){const [rows]=await c.execute('SELECT actor_key FROM opmx_tg_recovery_leases_v1 WHERE package_id=? FOR UPDATE',[id]);return rows.length?{actorKey:rows[0].actor_key}:null;},
        async lockSafetyBarrier(id,revision){return lockTrustedSafetyBarrier?await lockTrustedSafetyBarrier(c,id,revision):null;},
        async captureTrustedRevision(id,revision,ownerKey){return captureTrustedRevision?await captureTrustedRevision(c,id,revision,ownerKey):null;},
        async lockInventory(id){const [rows]=await c.execute('SELECT item_id,owner_key,receipt_key,fingerprint,kind,state,text_content,attachment_json,reserved_bytes,content_bytes,sha256 FROM opmx_tg_items_v1 WHERE package_id=? ORDER BY created_at,item_id FOR UPDATE',[id]);return rows.map(row=>({itemId:row.item_id,ownerKey:row.owner_key,receiptKey:row.receipt_key,fingerprint:row.fingerprint,kind:row.kind,state:row.state,text:row.text_content,attachment:row.attachment_json?JSON.parse(row.attachment_json):null,reservedBytes:Number(row.reserved_bytes),contentBytes:Number(row.content_bytes),sha256:row.sha256}));},
        async saveSnapshot({packageId,revision,ownerKey,items,barrier,prior}){const snapshot=JSON.stringify({items,barrier,prior});await c.execute('INSERT INTO opmx_tg_revision_snapshots_v1 (package_id,revision,owner_key,snapshot_json,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP(6))',[packageId,revision,ownerKey,snapshot]);},
        async markOpen({packageId,expectedRevision,revision}){const [r]=await c.execute("UPDATE opmx_tg_packages_v1 SET state='OPEN',revision=?,updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state='READY'",[revision,packageId,expectedRevision]);if(r.affectedRows!==1)throw Error('REVISION_CONFLICT');},
        async createLease({packageId,actorKey,ownerKey,revision,receiptId}){await c.execute('INSERT INTO opmx_tg_recovery_leases_v1 (package_id,actor_key,owner_key,opening_revision,receipt_id,created_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP(6))',[packageId,actorKey,ownerKey,revision,receiptId]);},
        async createSession({actorKey,packageId}){await c.execute('INSERT INTO opmx_tg_sessions_v1 (owner_key,package_id) VALUES (?,?)',[actorKey,packageId]);},
        async audit(x){await c.execute('INSERT INTO opmx_tg_recovery_audit_v1 (package_id,action,previous_revision,revision,actor_key,owner_key,created_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(6))',[x.packageId,x.type,x.previousRevision,x.revision,x.actorKey,x.ownerKey]);}
      };
      const result=await operation(tx);await c.commit();committed=true;return result;
    }catch(e){if(!committed)try{await c.rollback();}catch{}throw e;}finally{c.release();}
  }};
}
