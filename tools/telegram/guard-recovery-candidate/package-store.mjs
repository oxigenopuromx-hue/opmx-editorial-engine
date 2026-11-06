import {createHash} from 'node:crypto';
import {validateTelegramDownload} from './intake.mjs';

export const PACKAGE_LIMITS = Object.freeze({fileBytes:10485760, packageBytes:26214400, totalBytes:134217728, items:20, packages:100});
const digest = value => createHash('sha256').update(value).digest('hex');
const bad = () => {throw new Error('Solicitud inválida');};
const exact = (value, keys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) bad();
};
const identity = value => {
  if (typeof value.owner!=='string'||typeof value.chat!=='string'|| !/^[1-9][0-9]{0,15}$/.test(value.owner) || !/^[1-9][0-9]{0,15}$/.test(value.chat) || value.owner !== value.chat) bad();
  return digest(`opmx:telegram:v1:${value.owner}:${value.chat}`);
};
const packageId = value => {if (typeof value !== 'string' || !/^tg_[a-f0-9]{40}$/.test(value)) bad();};
const itemId = value => {if (typeof value !== 'string' || !/^ti_[a-f0-9]{40}$/.test(value)) bad();};
const receiptId = value => {if (typeof value !== 'string' || !/^telegram-[1-9][0-9]{0,15}-[0-9]{1,16}-[0-9]{1,16}$/.test(value)) bad();};

export function validatePackageRequest(action, input) {
  const base=['owner','chat'];
  const keys={current:base,open:[...base,'receiptId'],reserve:[...base,'packageId','receiptId','kind','text','attachment'],complete:[...base,'packageId','itemId','contentBase64'],manifest:[...base,'packageId'],asset:[...base,'packageId','itemId'],chunk:[...base,'packageId','itemId','stream','offset','length'],seal:[...base,'packageId'],discard:[...base,'packageId','itemId']};
  if (!keys[action]) bad(); exact(input, keys[action]); const ownerKey=identity(input);
  if (!['open','current'].includes(action)) packageId(input.packageId);
  if (['complete','asset','chunk','discard'].includes(action)) itemId(input.itemId);
  if(action==='chunk'&&(!['text','original'].includes(input.stream)||!Number.isSafeInteger(input.offset)||input.offset<0||input.offset>PACKAGE_LIMITS.fileBytes||!Number.isSafeInteger(input.length)||input.length<1||input.length>65536))bad();
  if (['open','reserve'].includes(action)) {
    receiptId(input.receiptId);
    if (!input.receiptId.startsWith(`telegram-${input.chat}-`)) bad();
  }
  if (action==='reserve') {
    if (!['TEXT','FILE'].includes(input.kind) || typeof input.text!=='string' || input.text.length>4096) bad();
    if (input.kind==='TEXT') {if(input.attachment!==null || !input.text.trim()) bad();}
    else {
      exact(input.attachment,['file_name','mime_type','declared_bytes']);
      const a=input.attachment;
      const extensions={'application/pdf':['pdf'],'application/msword':['doc'],'application/vnd.openxmlformats-officedocument.wordprocessingml.document':['docx'],'text/plain':['txt'],'image/jpeg':['jpg','jpeg'],'image/png':['png'],'image/webp':['webp']};
      if (typeof a.file_name!=='string' || !a.file_name || a.file_name.length>240 || /[\x00-\x1f]/.test(a.file_name) || !extensions[a.mime_type]?.includes(a.file_name.split('.').at(-1).toLowerCase())) bad();
      if (a.declared_bytes!==null && (!Number.isSafeInteger(a.declared_bytes)||a.declared_bytes<1||a.declared_bytes>PACKAGE_LIMITS.fileBytes)) bad();
    }
  }
  let bytes;
  if(action==='complete') {
    const b=input.contentBase64;
    if(typeof b!=='string'||!b.length||b.length%4||b.length>4*Math.ceil(PACKAGE_LIMITS.fileBytes/3)||/[^A-Za-z0-9+/=]/.test(b)) bad();
    bytes=Buffer.from(b,'base64');if(!bytes.length||bytes.length>PACKAGE_LIMITS.fileBytes||bytes.toString('base64')!==b)bad();
  }
  return {ownerKey,bytes};
}

const schema=[
  `CREATE TABLE IF NOT EXISTS opmx_tg_quota_v1 (id TINYINT PRIMARY KEY, used_bytes BIGINT UNSIGNED NOT NULL, package_count INT UNSIGNED NOT NULL) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS opmx_tg_packages_v1 (package_id VARCHAR(43) CHARACTER SET ascii PRIMARY KEY, owner_key CHAR(64) CHARACTER SET ascii NOT NULL, state VARCHAR(16) NOT NULL, revision INT UNSIGNED NOT NULL, item_count INT UNSIGNED NOT NULL, used_bytes BIGINT UNSIGNED NOT NULL, created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS opmx_tg_sessions_v1 (owner_key CHAR(64) CHARACTER SET ascii PRIMARY KEY, package_id VARCHAR(43) CHARACTER SET ascii NOT NULL) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS opmx_tg_items_v1 (item_id VARCHAR(43) CHARACTER SET ascii PRIMARY KEY, package_id VARCHAR(43) CHARACTER SET ascii NOT NULL, owner_key CHAR(64) CHARACTER SET ascii NOT NULL, receipt_key CHAR(64) CHARACTER SET ascii NOT NULL UNIQUE, fingerprint CHAR(64) CHARACTER SET ascii NOT NULL, kind VARCHAR(8) NOT NULL, state VARCHAR(16) NOT NULL, text_content MEDIUMTEXT NOT NULL, attachment_json TEXT NULL, reserved_bytes INT UNSIGNED NOT NULL, content_bytes INT UNSIGNED NOT NULL, sha256 CHAR(64) CHARACTER SET ascii NULL, content_blob MEDIUMBLOB NULL, created_at DATETIME(6) NOT NULL, INDEX package_items (package_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `INSERT IGNORE INTO opmx_tg_quota_v1 (id,used_bytes,package_count) VALUES (1,0,0)`
];

export function createTelegramPackageStore(pool,{events=null,recoveryEnabled=false,adminUserIds=[]}={}) {
  if(typeof recoveryEnabled!=='boolean'||!Array.isArray(adminUserIds)||adminUserIds.some(id=>typeof id!=='string'||!/^[1-9][0-9]{0,15}$/.test(id)))throw Error('Configuración inválida');
  const admins=new Set(adminUserIds.map(id=>identity({owner:id,chat:id})));
  let ready;
  const initialize=()=>ready??=(async()=>{
    const c=await pool.getConnection();try {for(const sql of schema)await c.execute(sql);}finally{c.release();}
  })().catch(error=>{ready=undefined;throw error;});
  return {
    async capabilities() {
      await initialize();const c=await pool.getConnection();try {
        const [r]=await c.execute('SELECT @@max_allowed_packet AS max_packet');
        return {status:'STORAGE_READY',version:1,limits:PACKAGE_LIMITS,maxPacket:Number(r[0].max_packet),chunkRead:true,chunkBytes:65536,publicationEnabled:false};
      }finally{c.release();}
    },
    async run(action,input) {
      const validated=validatePackageRequest(action,input),actorKey=validated.ownerKey,bytes=validated.bytes;
      let ownerKey=actorKey;
      await initialize();if(action==='seal'&&events)await events.initialize();
      const c=await pool.getConnection();let committed=false;
      try {
        await c.beginTransaction();
        // A single pilot quota lock also serializes session transitions and duplicate receipts.
        const [quota]=await c.execute('SELECT used_bytes,package_count FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');
        if(!quota.length)throw Error('Almacenamiento no disponible');
        const finish=async result=>{await c.commit();committed=true;return result;};
        if(action==='current') {
          const [session]=await c.execute('SELECT package_id FROM opmx_tg_sessions_v1 WHERE owner_key=?',[ownerKey]);
          return await finish(session.length?{status:'OPEN',packageId:session[0].package_id}:{status:'NO_OPEN_PACKAGE'});
        }
        if(action==='open') {
          const id='tg_'+digest(`${ownerKey}:${input.receiptId}`).slice(0,40);
          const [prior]=await c.execute('SELECT package_id,state FROM opmx_tg_packages_v1 WHERE package_id=? AND owner_key=?',[id,ownerKey]);
          if(prior.length)return await finish({status:'OPEN_REPLAY',packageId:id,state:prior[0].state});
          const [session]=await c.execute('SELECT package_id FROM opmx_tg_sessions_v1 WHERE owner_key=?',[ownerKey]);
          if(session.length)return await finish({status:'ALREADY_OPEN',packageId:session[0].package_id});
          if(Number(quota[0].package_count)>=PACKAGE_LIMITS.packages)return await finish({status:'QUOTA_EXCEEDED'});
          await c.execute("INSERT INTO opmx_tg_packages_v1 VALUES (?,?,'OPEN',1,0,0,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",[id,ownerKey]);
          await c.execute('INSERT INTO opmx_tg_sessions_v1 VALUES (?,?)',[ownerKey,id]);
          await c.execute('UPDATE opmx_tg_quota_v1 SET package_count=package_count+1 WHERE id=1');
          return await finish({status:'OPEN',packageId:id,revision:1});
        }
        let lease=null;
        if(recoveryEnabled){
          const [leases]=await c.execute('SELECT actor_key,owner_key FROM opmx_tg_recovery_leases_v1 WHERE package_id=?',[input.packageId]);
          lease=leases[0]??null;
          if(lease && lease.actor_key===actorKey && lease.owner_key!==actorKey && admins.has(actorKey))ownerKey=lease.owner_key;
        }
        const [packs]=await c.execute('SELECT * FROM opmx_tg_packages_v1 WHERE package_id=? AND owner_key=?',[input.packageId,ownerKey]);
        if(!packs.length)return await finish({status:'NOT_FOUND'});
        const pack=packs[0];
        if(lease && lease.actor_key!==actorKey && ['reserve','complete','seal','discard'].includes(action))return await finish({status:'PACKAGE_IN_USE'});
        if(lease && lease.actor_key===actorKey && ['reserve','complete','seal','discard'].includes(action)){
          const [sessions]=await c.execute('SELECT package_id FROM opmx_tg_sessions_v1 WHERE owner_key=?',[actorKey]);
          if(!sessions.length||sessions[0].package_id!==input.packageId)return await finish({status:'NO_EDIT_SESSION'});
        }
        if(action==='manifest') {
          const [items]=await c.execute('SELECT item_id,kind,state,text_content,attachment_json,content_bytes,sha256 FROM opmx_tg_items_v1 WHERE package_id=? AND owner_key=? ORDER BY created_at,item_id',[input.packageId,ownerKey]);
          return await finish({status:'FOUND',packageId:pack.package_id,state:pack.state,revision:pack.revision,items:items.map(row=>({...row,attachment:row.attachment_json?JSON.parse(row.attachment_json):null,attachment_json:undefined}))});
        }
        if(action==='asset') {
          const [items]=await c.execute("SELECT content_blob,sha256,attachment_json FROM opmx_tg_items_v1 WHERE item_id=? AND package_id=? AND owner_key=? AND state='STORED' AND kind='FILE'",[input.itemId,input.packageId,ownerKey]);
          if(!items.length)return await finish({status:'NOT_FOUND'});
          const item=items[0],blob=Buffer.from(item.content_blob);
          if(digest(blob)!==item.sha256)throw Error('Integridad no confirmada');
          return await finish({status:'FOUND',packageId:pack.package_id,itemId:input.itemId,sha256:item.sha256,bytes:blob.length,attachment:JSON.parse(item.attachment_json),contentBase64:blob.toString('base64')});
        }
        if(action==='chunk') {
          let chunk,total,sha,mime;
          if(input.stream==='text') {
            const [items]=await c.execute("SELECT text_content FROM opmx_tg_items_v1 WHERE item_id=? AND package_id=? AND owner_key=? AND state='STORED'",[input.itemId,input.packageId,ownerKey]);
            if(!items.length)return await finish({status:'NOT_FOUND'});
            const all=Buffer.from(items[0].text_content,'utf8');total=all.length;sha=digest(all);mime='text/plain';chunk=all.subarray(input.offset,input.offset+input.length);
          }else {
            const [items]=await c.execute("SELECT content_bytes,OCTET_LENGTH(content_blob) AS blob_bytes,sha256,attachment_json,SUBSTRING(content_blob,?,?) AS chunk_blob FROM opmx_tg_items_v1 WHERE item_id=? AND package_id=? AND owner_key=? AND state='STORED' AND kind='FILE'",[input.offset+1,input.length,input.itemId,input.packageId,ownerKey]);
            if(!items.length)return await finish({status:'NOT_FOUND'});
            const item=items[0];total=Number(item.content_bytes);sha=item.sha256;mime=JSON.parse(item.attachment_json).mime_type;chunk=Buffer.from(item.chunk_blob??[]);
            if(total!==Number(item.blob_bytes)||total<1||total>PACKAGE_LIMITS.fileBytes||! /^[a-f0-9]{64}$/.test(sha))throw Error('Integridad no confirmada');
          }
          if(input.offset>total)return await finish({status:'OUT_OF_RANGE'});
          if(chunk.length!==Math.min(input.length,total-input.offset))throw Error('Rango no confirmado');
          return await finish({status:'FOUND',packageId:pack.package_id,itemId:input.itemId,stream:input.stream,mime_type:mime,totalBytes:total,offset:input.offset,bytes:chunk.length,sha256:sha,chunkSha256:digest(chunk),contentBase64:chunk.toString('base64'),nextOffset:input.offset+chunk.length,eof:input.offset+chunk.length===total});
        }
        if(action==='seal') {
          if(pack.state==='READY')return await finish({status:'READY',packageId:pack.package_id,revision:pack.revision});
          // Only an explicitly open package can be sealed. In particular,
          // CANCELLED packages must never produce a new editorial event.
          if(pack.state!=='OPEN')return await finish({status:'PACKAGE_CLOSED',packageId:pack.package_id});
          const [counts]=await c.execute("SELECT COUNT(*) AS total, SUM(state='PENDING') AS pending, SUM(state='STORED') AS stored FROM opmx_tg_items_v1 WHERE package_id=?",[input.packageId]);
          if(!Number(counts[0].stored)||Number(counts[0].pending))return await finish({status:'NOT_READY',pending:Number(counts[0].pending??0),stored:Number(counts[0].stored??0)});
          await c.execute("UPDATE opmx_tg_packages_v1 SET state='READY',revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE package_id=?",[input.packageId]);
          await c.execute('DELETE FROM opmx_tg_sessions_v1 WHERE owner_key=? AND package_id=?',[actorKey,input.packageId]);
          if(lease)await c.execute('DELETE FROM opmx_tg_recovery_leases_v1 WHERE package_id=? AND actor_key=?',[input.packageId,actorKey]);
          if(events)await events.enqueue(c,{owner:ownerKey,packageId:pack.package_id,revision:Number(pack.revision)+1,itemCount:Number(counts[0].stored),timestamp:new Date().toISOString()});
          return await finish({status:'READY',packageId:pack.package_id,revision:Number(pack.revision)+1});
        }
        if(pack.state!=='OPEN' && action!=='complete')return await finish({status:'PACKAGE_CLOSED'});
        if(action==='reserve') {
          const a=input.attachment,receiptKey=digest(input.receiptId),fingerprint=digest(JSON.stringify([input.packageId,input.kind,input.text,a?[a.file_name,a.mime_type,a.declared_bytes]:null]));
          const [prior]=await c.execute('SELECT item_id,package_id,fingerprint,state FROM opmx_tg_items_v1 WHERE receipt_key=?',[receiptKey]);
          if(prior.length)return await finish({status:prior[0].fingerprint===fingerprint?'RESERVATION_REPLAY':'CONFLICT',itemId:prior[0].fingerprint===fingerprint?prior[0].item_id:undefined,state:prior[0].state});
          const reserved=input.kind==='TEXT'?Buffer.byteLength(input.text):input.attachment.declared_bytes??PACKAGE_LIMITS.fileBytes;
          if(Number(pack.item_count)>=PACKAGE_LIMITS.items||Number(pack.used_bytes)+reserved>PACKAGE_LIMITS.packageBytes||Number(quota[0].used_bytes)+reserved>PACKAGE_LIMITS.totalBytes)return await finish({status:'QUOTA_EXCEEDED'});
          const id='ti_'+digest(`${ownerKey}:${input.receiptId}`).slice(0,40);
          const textOnly=input.kind==='TEXT';
          await c.execute('INSERT INTO opmx_tg_items_v1 (item_id,package_id,owner_key,receipt_key,fingerprint,kind,state,text_content,attachment_json,reserved_bytes,content_bytes,sha256,content_blob,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL,UTC_TIMESTAMP(6))',[id,input.packageId,ownerKey,receiptKey,fingerprint,input.kind,textOnly?'STORED':'PENDING',input.text,input.attachment?JSON.stringify(input.attachment):null,reserved,textOnly?reserved:0,textOnly?digest(input.text):null]);
          if(lease)await c.execute('INSERT INTO opmx_tg_recovery_contributions_v1 (item_id,package_id,actor_key,created_at) VALUES (?,?,?,UTC_TIMESTAMP(6))',[id,input.packageId,actorKey]);
          await c.execute('UPDATE opmx_tg_packages_v1 SET item_count=item_count+1,used_bytes=used_bytes+?,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE package_id=?',[reserved,input.packageId]);
          await c.execute('UPDATE opmx_tg_quota_v1 SET used_bytes=used_bytes+? WHERE id=1',[reserved]);
          return await finish({status:textOnly?'STORED':'RESERVED',packageId:input.packageId,itemId:id});
        }
        const [items]=await c.execute('SELECT * FROM opmx_tg_items_v1 WHERE item_id=? AND package_id=? AND owner_key=?',[input.itemId,input.packageId,ownerKey]);
        if(!items.length)return await finish({status:'NOT_FOUND'});const item=items[0];
        if(action==='discard') {
          if(item.state!=='PENDING')return await finish({status:'NOT_PENDING'});
          await c.execute("UPDATE opmx_tg_items_v1 SET state='DISCARDED',reserved_bytes=0 WHERE item_id=?",[input.itemId]);
          await c.execute('UPDATE opmx_tg_packages_v1 SET used_bytes=used_bytes-?,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE package_id=?',[item.reserved_bytes,input.packageId]);
          await c.execute('UPDATE opmx_tg_quota_v1 SET used_bytes=used_bytes-? WHERE id=1',[item.reserved_bytes]);
          return await finish({status:'DISCARDED',itemId:input.itemId});
        }
        if(action==='complete') {
          if(item.kind!=='FILE'||item.state==='DISCARDED')return await finish({status:'CONFLICT'});
          const sha=digest(bytes);
          if(item.state==='STORED')return await finish({status:item.sha256===sha?'STORED_REPLAY':'CONFLICT',itemId:input.itemId});
          if(pack.state!=='OPEN'||bytes.length>Number(item.reserved_bytes))return await finish({status:'CONFLICT'});
          const attachment=JSON.parse(item.attachment_json);
          if(attachment.declared_bytes!==null&&bytes.length!==attachment.declared_bytes)bad();
          try{validateTelegramDownload({kind:'FILE',attachment,max_bytes:PACKAGE_LIMITS.fileBytes},bytes);}catch{bad();}
          const delta=bytes.length-Number(item.reserved_bytes);
          await c.execute("UPDATE opmx_tg_items_v1 SET state='STORED',content_blob=?,sha256=?,content_bytes=?,reserved_bytes=? WHERE item_id=?",[bytes,sha,bytes.length,bytes.length,input.itemId]);
          await c.execute('UPDATE opmx_tg_packages_v1 SET used_bytes=used_bytes+?,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE package_id=?',[delta,input.packageId]);
          await c.execute('UPDATE opmx_tg_quota_v1 SET used_bytes=used_bytes+? WHERE id=1',[delta]);
          return await finish({status:'STORED',packageId:input.packageId,itemId:input.itemId,bytes:bytes.length,sha256:sha});
        }
        bad();
      }catch(error){
        if(!committed)try{await c.rollback();}catch{}
        throw error.message==='Solicitud inválida'?error:Error('Almacenamiento no confirmado');
      }finally{c.release();}
    }
  };
}
