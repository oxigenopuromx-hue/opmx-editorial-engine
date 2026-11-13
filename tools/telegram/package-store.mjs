// EDITORIAL_PLACEMENT_MANIFEST_V1
import {createHash} from 'node:crypto';
import {validateTelegramDownload} from './intake.mjs';
import {diagnosePackageQuotaFailure,readPackageCapacityAudit} from './guard-recovery-candidate/package-quota-diagnostic.mjs';

export const PACKAGE_LIMITS = Object.freeze({fileBytes:10485760, packageBytes:26214400, totalBytes:134217728, items:20, packages:1000});
// An explicitly reopened package can accept additional information while
// retaining every original. The final slot is reserved for the attested /listo.
export const RECOVERY_ITEM_LIMIT=40;
const CLOSE_CONTROL_ALLOWANCE=1024;
const CONTROL_PREFIX='OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d\n/listo\n';
function isAttestedClose(input){
  if(input.kind!=='TEXT'||typeof input.text!=='string'||!input.text.startsWith(CONTROL_PREFIX))return false;
  let meta;try{meta=JSON.parse(input.text.slice(CONTROL_PREFIX.length));}catch{return false;}
  const parts=/^telegram-([1-9][0-9]{0,15})-([0-9]{1,16})-([0-9]{1,16})$/.exec(input.receiptId);
  return !!parts&&parts[1]===input.chat&&meta&&typeof meta==='object'&&!Array.isArray(meta)&&
    Object.keys(meta).sort().join(',')==='message_id,package_id,policy'&&meta.package_id===input.packageId&&
    ['publish-todos-v2','publish-ambos-v1'].includes(meta.policy)&&Number.isSafeInteger(meta.message_id)&&
    meta.message_id>0&&String(meta.message_id)===String(Number(parts[2]));
}
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
  if (!keys[action]) bad();
  // A recovered session requires the exact /listo receipt at seal time. The
  // legacy shape remains available for sessions that were never reopened.
  if(action==='seal' && Object.hasOwn(input,'receiptId')) keys.seal=[...keys.seal,'receiptId'];
  exact(input, keys[action]); const ownerKey=identity(input);
  if (!['open','current'].includes(action)) packageId(input.packageId);
  if (['complete','asset','chunk','discard'].includes(action)) itemId(input.itemId);
  if(action==='chunk'&&(!['text','original'].includes(input.stream)||!Number.isSafeInteger(input.offset)||input.offset<0||input.offset>PACKAGE_LIMITS.fileBytes||!Number.isSafeInteger(input.length)||input.length<1||input.length>65536))bad();
  if (['open','reserve'].includes(action) || (action==='seal' && Object.hasOwn(input,'receiptId'))) {
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

// Caller owns the quota/package locks and transaction. This function never
// commits or writes to WordPress; an error must roll back the caller.
export async function sealOpenPackageInTransaction(c,{input,pack,lease,actorKey,ownerKey,events,initializePublicationFence,initializeMotorAttempt}) {
          if(pack.state==='READY')return ({status:'READY',packageId:pack.package_id,revision:pack.revision});
          // Only an explicitly open package can be sealed. In particular,
          // CANCELLED packages must never produce a new editorial event.
          if(pack.state!=='OPEN')return ({status:'PACKAGE_CLOSED',packageId:pack.package_id});
          let recoveryCloseId=null;
          if(lease){
            // Only a close from this same editor's chat, sent after /abrir,
            // may seal this lease. IDs from the original owner's chat must
            // never be compared against the administrator's message IDs.
            const opened=/^telegram-([1-9][0-9]{0,15})-([0-9]{1,16})-([0-9]{1,16})$/.exec(lease.receipt_id??'');
            const closed=/^telegram-([1-9][0-9]{0,15})-([0-9]{1,16})-([0-9]{1,16})$/.exec(input.receiptId??'');
            if(!opened||!closed||opened[1]!==input.chat||closed[1]!==input.chat||BigInt(closed[2])<=BigInt(opened[2]))return ({status:'CLOSE_NOT_CONFIRMED'});
            const [closing]=await c.execute("SELECT i.item_id,i.kind,i.text_content,i.state,rc.actor_key FROM opmx_tg_items_v1 i JOIN opmx_tg_recovery_contributions_v1 rc ON rc.item_id=i.item_id AND rc.package_id=i.package_id WHERE i.package_id=? AND i.receipt_key=?",[input.packageId,digest(input.receiptId)]);
            if(closing.length!==1||closing[0].actor_key!==actorKey||closing[0].state!=='STORED'||!isAttestedClose({kind:closing[0].kind,text:closing[0].text_content,receiptId:input.receiptId,chat:input.chat,packageId:input.packageId}))return ({status:'CLOSE_NOT_CONFIRMED'});
            const [last]=await c.execute("SELECT item_id FROM opmx_tg_items_v1 WHERE package_id=? AND state='STORED' ORDER BY created_at DESC,item_id DESC LIMIT 1",[input.packageId]);
            if(last.length!==1||last[0].item_id!==closing[0].item_id)return ({status:'CLOSE_NOT_CONFIRMED'});
            if(!Number.isSafeInteger(Number(lease.opening_revision))||Number(lease.opening_revision)<2||Number(lease.opening_revision)>Number(pack.revision))return ({status:'CLOSE_NOT_CONFIRMED'});
            recoveryCloseId=closing[0].item_id;
          }
          const [counts]=await c.execute("SELECT COUNT(*) AS total, SUM(state='PENDING') AS pending, SUM(state='STORED') AS stored FROM opmx_tg_items_v1 WHERE package_id=?",[input.packageId]);
          if(!Number(counts[0].stored)||Number(counts[0].pending))return ({status:'NOT_READY',pending:Number(counts[0].pending??0),stored:Number(counts[0].stored??0)});
          await c.execute("UPDATE opmx_tg_packages_v1 SET state='READY',revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE package_id=?",[input.packageId]);
          if(lease)await c.execute('INSERT INTO opmx_tg_recovery_closures_v1 (package_id,revision,snapshot_revision,actor_key,close_item_id,close_receipt_key,created_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(6))',[input.packageId,Number(pack.revision)+1,Number(lease.opening_revision)-1,actorKey,recoveryCloseId,digest(input.receiptId)]);
          // Candidate opt-in only: create the fence before the event becomes
          // visible, inside the same transaction. Failure rolls everything back.
          if(initializePublicationFence)await initializePublicationFence(c,{packageId:pack.package_id,revision:Number(pack.revision)+1});
          await c.execute('DELETE FROM opmx_tg_sessions_v1 WHERE owner_key=? AND package_id=?',[actorKey,input.packageId]);
          if(lease)await c.execute('DELETE FROM opmx_tg_recovery_leases_v1 WHERE package_id=? AND actor_key=?',[input.packageId,actorKey]);
          let eventId=null;
          if(events){eventId=await events.enqueue(c,{owner:ownerKey,packageId:pack.package_id,revision:Number(pack.revision)+1,itemCount:Number(counts[0].stored),timestamp:new Date().toISOString()});if(initializeMotorAttempt)await initializeMotorAttempt(c,{packageId:pack.package_id,revision:Number(pack.revision)+1,eventId});}
          return ({status:'READY',packageId:pack.package_id,revision:Number(pack.revision)+1,eventId});
}

export function createTelegramPackageStore(pool,{events=null,recoveryEnabled=false,adminUserIds=[],initializePublicationFence=null,initializeMotorAttempt=null,readRecoveredPolicy=null,readConfirmedCorrection=null,readDiagnostic=null,readPublisherResult=null,readEditorialPlacement=null,closeRecoveryPreview=null,readCloseRecoveryResult=null}={}) {
  if((closeRecoveryPreview!==null&&typeof closeRecoveryPreview!=='function')||(readCloseRecoveryResult!==null&&typeof readCloseRecoveryResult!=='function'))throw Error('Configuración inválida');
  if((readPublisherResult!==null&&typeof readPublisherResult!=='function')||typeof recoveryEnabled!=='boolean'||(readRecoveredPolicy!==null&&typeof readRecoveredPolicy!=='function')||(readConfirmedCorrection!==null&&(typeof readConfirmedCorrection!=='function'||!readRecoveredPolicy||!recoveryEnabled))||(initializePublicationFence!==null&&typeof initializePublicationFence!=='function')||(initializeMotorAttempt!==null&&(typeof initializeMotorAttempt!=='function'||!events||!initializePublicationFence))||!Array.isArray(adminUserIds)||adminUserIds.some(id=>typeof id!=='string'||!/^[1-9][0-9]{0,15}$/.test(id)))throw Error('Configuración inválida');
  if(readEditorialPlacement!==null&&typeof readEditorialPlacement!=='function')throw Error('Configuración inválida');
  const admins=new Set(adminUserIds.map(id=>identity({owner:id,chat:id})));
  let ready;
  const initialize=()=>ready??=(async()=>{
    const c=await pool.getConnection();try {for(const sql of schema)await c.execute(sql);}finally{c.release();}
  })().catch(error=>{ready=undefined;throw error;});
  return {
    async capacity() {
      await initialize();const c=await pool.getConnection();try{return await readPackageCapacityAudit(c)}finally{c.release()}
    },
    async capabilities() {
      await initialize();const c=await pool.getConnection();try {
        const [r]=await c.execute('SELECT @@max_allowed_packet AS max_packet');
        return {status:'STORAGE_READY',version:1,limits:PACKAGE_LIMITS,maxPacket:Number(r[0].max_packet),chunkRead:true,chunkBytes:65536,publicationEnabled:false};
      }finally{c.release();}
    },
    async run(action,input) {
      const atomicClose=action==='close';
      const validated=validatePackageRequest(atomicClose?'reserve':action,input),actorKey=validated.ownerKey,bytes=validated.bytes;
      if(atomicClose&&(!isAttestedClose(input)||Buffer.byteLength(input.text)>CLOSE_CONTROL_ALLOWANCE))bad();
      let ownerKey=actorKey;
      await initialize();if((action==='seal'||atomicClose)&&events)await events.initialize();
      const c=await pool.getConnection();let committed=false;
      try {
        await c.beginTransaction();
        // A single pilot quota lock also serializes session transitions and duplicate receipts.
        const [quota]=await c.execute('SELECT used_bytes,package_count FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');
        if(!quota.length)throw Error('Almacenamiento no disponible');
        const finish=async result=>{await c.commit();committed=true;return result;};
        if(action==='current') {
          const [session]=await c.execute('SELECT package_id FROM opmx_tg_sessions_v1 WHERE owner_key=?',[ownerKey]);
          if(!session.length)return await finish({status:'NO_OPEN_PACKAGE'});
          if(!recoveryEnabled)return await finish({status:'OPEN',packageId:session[0].package_id});
          const [current]=await c.execute('SELECT p.state,p.revision,l.actor_key FROM opmx_tg_packages_v1 p LEFT JOIN opmx_tg_recovery_leases_v1 l ON l.package_id=p.package_id WHERE p.package_id=?',[session[0].package_id]);
          if(current.length!==1||current[0].state!=='OPEN'||(current[0].actor_key&&current[0].actor_key!==actorKey)||!Number.isSafeInteger(Number(current[0].revision)))return await finish({status:'NO_OPEN_PACKAGE'});
          return await finish({status:'OPEN',packageId:session[0].package_id,revision:Number(current[0].revision),recovery:current[0].actor_key===actorKey});
        }
        if(action==='open') {
          const id='tg_'+digest(`${ownerKey}:${input.receiptId}`).slice(0,40);
          const [prior]=await c.execute('SELECT package_id,state FROM opmx_tg_packages_v1 WHERE package_id=? AND owner_key=?',[id,ownerKey]);
          if(prior.length)return await finish({status:'OPEN_REPLAY',packageId:id,state:prior[0].state});
          const [session]=await c.execute('SELECT package_id FROM opmx_tg_sessions_v1 WHERE owner_key=?',[ownerKey]);
          if(session.length)return await finish({status:'ALREADY_OPEN',packageId:session[0].package_id});
          if(Number(quota[0].package_count)>=PACKAGE_LIMITS.packages)return await finish({status:'QUOTA_EXCEEDED',quotaDiagnostic:diagnosePackageQuotaFailure({operation:'OPEN',quota:quota[0],packageLimit:PACKAGE_LIMITS.packages})});
          await c.execute("INSERT INTO opmx_tg_packages_v1 VALUES (?,?,'OPEN',1,0,0,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",[id,ownerKey]);
          await c.execute('INSERT INTO opmx_tg_sessions_v1 VALUES (?,?)',[ownerKey,id]);
          await c.execute('UPDATE opmx_tg_quota_v1 SET package_count=package_count+1 WHERE id=1');
          return await finish({status:'OPEN',packageId:id,revision:1});
        }
        let lease=null;
        if(recoveryEnabled){
          const [leases]=await c.execute('SELECT actor_key,owner_key,receipt_id,opening_revision FROM opmx_tg_recovery_leases_v1 WHERE package_id=?',[input.packageId]);
          lease=leases[0]??null;
          if(lease && lease.actor_key===actorKey && lease.owner_key!==actorKey && admins.has(actorKey))ownerKey=lease.owner_key;
        }
        const [packs]=await c.execute('SELECT * FROM opmx_tg_packages_v1 WHERE package_id=? AND owner_key=?',[input.packageId,ownerKey]);
        if(!packs.length)return await finish({status:'NOT_FOUND'});
        const pack=packs[0];
        if(lease && lease.actor_key!==actorKey && ['reserve','complete','seal','discard','close'].includes(action))return await finish({status:'PACKAGE_IN_USE'});
        if(lease && lease.actor_key===actorKey && ['reserve','complete','seal','discard','close'].includes(action)){
          const [sessions]=await c.execute('SELECT package_id FROM opmx_tg_sessions_v1 WHERE owner_key=?',[actorKey]);
          if(!sessions.length||sessions[0].package_id!==input.packageId)return await finish({status:'NO_EDIT_SESSION'});
        }
        if(action==='manifest') {
          const [items]=await c.execute('SELECT item_id,kind,state,text_content,attachment_json,content_bytes,sha256 FROM opmx_tg_items_v1 WHERE package_id=? AND owner_key=? ORDER BY created_at,item_id',[input.packageId,ownerKey]);
          let recoveredPolicy,confirmedCorrection;
          if(recoveryEnabled&&pack.state==='READY'){
            const [closures]=await c.execute('SELECT package_id FROM opmx_tg_recovery_closures_v1 WHERE package_id=? AND revision=?',[input.packageId,pack.revision]);
            if(closures.length){
              // Both readers are mandatory: without the decision reader an
              // approved destination/mode could be silently replaced by the
              // pre-recovery policy. Ordinary packages remain unaffected.
              if(closures.length!==1||!readRecoveredPolicy||!readConfirmedCorrection)return await finish({status:'RECOVERY_POLICY_UNCONFIRMED'});
              recoveredPolicy=await readRecoveredPolicy(c,input.packageId,Number(pack.revision));
              if(!recoveredPolicy||typeof recoveredPolicy!=='object'||recoveredPolicy.authorized!==true||!['PUBLISH','DRAFT'].includes(recoveredPolicy.mode)||typeof recoveredPolicy.destination!=='string'||!Array.isArray(recoveredPolicy.control_item_ids))return await finish({status:'RECOVERY_POLICY_UNCONFIRMED'});
              confirmedCorrection=await readConfirmedCorrection(c,input.packageId,Number(pack.revision));
            }
          }
          let editorialPlacement=null;
          if(readEditorialPlacement){editorialPlacement=await readEditorialPlacement(c,{packageId:pack.package_id,revision:Number(pack.revision),ownerKey,actorKey});if(editorialPlacement!==null&&(!editorialPlacement||typeof editorialPlacement!=='object'||Array.isArray(editorialPlacement)||!['PLACEMENT_SELECTION','PLACEMENT_PRESERVE'].includes(editorialPlacement.status)))return await finish({status:'PLACEMENT_CONTEXT_UNCONFIRMED'});}
          return await finish({status:'FOUND',packageId:pack.package_id,state:pack.state,revision:pack.revision,items:items.map(row=>({...row,attachment:row.attachment_json?JSON.parse(row.attachment_json):null,attachment_json:undefined})),...(recoveredPolicy?{recoveredPolicy}:{}),...(confirmedCorrection?{confirmedCorrection}:{}),...(readDiagnostic?{diagnostic:await readDiagnostic(c,{pack,lease,actorKey,ownerKey,items})}:{}),...(readPublisherResult?{publisherResult:await readPublisherResult(c,{pack,lease,actorKey,ownerKey})}:{}),...(editorialPlacement?{editorialPlacement}:{})});
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
          const result=await sealOpenPackageInTransaction(c,{input,pack,lease,actorKey,ownerKey,events,initializePublicationFence,initializeMotorAttempt});
          const {eventId,...response}=result;return await finish(response);
        }
        const closeResult=async(current,receiptId=input.receiptId,replayed=false)=>{
          const result=lease?await closeRecoveryPreview(c,{owner:input.owner,chat:input.chat,packageId:input.packageId,revision:Number(current.revision),receiptId}):await sealOpenPackageInTransaction(c,{input,pack:current,lease,actorKey,ownerKey,events,initializePublicationFence,initializeMotorAttempt});
          const statuses=lease?['PREVIEW_GENERATION_REQUESTED','PREVIEW_READY','PREVIEW_EXISTS']:['READY'];
          if(!result||!statuses.includes(result.status))throw Error('ATOMIC_CLOSE_UNCONFIRMED');
          const {eventId,...safeResult}=result;
          return {status:'CLOSE_COMPLETED',packageId:pack.package_id,revision:lease?Number(current.revision):Number(result.revision),recovery:!!lease,receiptId,replayed,result:safeResult};
        };
        if(atomicClose&&pack.state==='READY'&&!lease)return await finish(await closeResult(pack,input.receiptId,true));
        if(pack.state!=='OPEN' && action!=='complete')return await finish({status:'PACKAGE_CLOSED'});
        if(action==='reserve'||atomicClose) {
          if(lease){
            const opened=/^telegram-([1-9][0-9]{0,15})-([0-9]{1,16})-([0-9]{1,16})$/.exec(lease.receipt_id??'');
            const received=/^telegram-([1-9][0-9]{0,15})-([0-9]{1,16})-([0-9]{1,16})$/.exec(input.receiptId);
            if(!opened||!received||opened[1]!==input.chat||received[1]!==input.chat||BigInt(received[2])<=BigInt(opened[2]))return await finish({status:'STALE_SESSION_MESSAGE'});
          }
          if(atomicClose&&lease){
            if(!closeRecoveryPreview||!readCloseRecoveryResult)throw Error('ATOMIC_CLOSE_CONFIGURATION_UNCONFIRMED');
            const existing=await readCloseRecoveryResult(c,{owner:input.owner,chat:input.chat,packageId:input.packageId,revision:Number(pack.revision),receiptId:input.receiptId});
            if(existing){
              const [last]=await c.execute('SELECT i.item_id,i.kind,i.text_content,i.state,i.receipt_key,i.sha256,i.content_bytes,rc.actor_key FROM opmx_tg_items_v1 i LEFT JOIN opmx_tg_recovery_contributions_v1 rc ON rc.item_id=i.item_id AND rc.package_id=i.package_id WHERE i.package_id=? AND i.state=\'STORED\' ORDER BY i.created_at DESC,i.item_id DESC LIMIT 1',[input.packageId]);
              const receipt=/^telegram-([1-9][0-9]{0,15})-([0-9]{1,16})-([0-9]{1,16})$/.exec(existing.receiptId??'');
              const received=/^telegram-([1-9][0-9]{0,15})-([0-9]{1,16})-([0-9]{1,16})$/.exec(input.receiptId);
              const opened=/^telegram-([1-9][0-9]{0,15})-([0-9]{1,16})-([0-9]{1,16})$/.exec(lease.receipt_id??'');
              if(last.length!==1||last[0].actor_key!==actorKey||last[0].state!=='STORED'||last[0].receipt_key!==digest(existing.receiptId??'')||last[0].sha256!==digest(last[0].text_content??'')||Number(last[0].content_bytes)!==Buffer.byteLength(last[0].text_content??'')||!isAttestedClose({kind:last[0].kind,text:last[0].text_content,receiptId:existing.receiptId,chat:input.chat,packageId:input.packageId})||!receipt||receipt[1]!==input.chat||!opened||BigInt(receipt[2])<=BigInt(opened[2]))throw Error('ATOMIC_CLOSE_REPLAY_UNCONFIRMED');
              if(BigInt(received[2])<BigInt(receipt[2]))return await finish({status:'STALE_SESSION_MESSAGE'});
              if(!['PREVIEW_GENERATION_REQUESTED','PREVIEW_EXISTS','PREVIEW_DELIVERY_UNCERTAIN'].includes(existing.result?.status))throw Error('ATOMIC_CLOSE_REPLAY_UNCONFIRMED');
              return await finish({status:'CLOSE_COMPLETED',packageId:pack.package_id,revision:Number(pack.revision),recovery:true,receiptId:existing.receiptId,replayed:true,result:existing.result});
            }
          }
          const a=input.attachment,receiptKey=digest(input.receiptId),fingerprint=digest(JSON.stringify([input.packageId,input.kind,input.text,a?[a.file_name,a.mime_type,a.declared_bytes]:null]));
          const [prior]=await c.execute('SELECT item_id,package_id,fingerprint,state FROM opmx_tg_items_v1 WHERE receipt_key=?',[receiptKey]);
          if(prior.length){
            if(atomicClose&&prior[0].package_id===input.packageId&&prior[0].fingerprint===fingerprint&&prior[0].state==='STORED'){
              const [last]=await c.execute("SELECT item_id FROM opmx_tg_items_v1 WHERE package_id=? AND state='STORED' ORDER BY created_at DESC,item_id DESC LIMIT 1",[input.packageId]);
              if(last.length!==1||last[0].item_id!==prior[0].item_id)return await finish({status:'STALE_SESSION_MESSAGE'});
              return await finish(await closeResult(pack,input.receiptId,true));
            }
            return await finish({status:prior[0].fingerprint===fingerprint?'RESERVATION_REPLAY':'CONFLICT',itemId:prior[0].fingerprint===fingerprint?prior[0].item_id:undefined,state:prior[0].state,...(recoveryEnabled&&lease?{revision:Number(pack.revision)}:{})});
          }
          const reserved=input.kind==='TEXT'?Buffer.byteLength(input.text):input.attachment.declared_bytes??PACKAGE_LIMITS.fileBytes;
          const close=isAttestedClose(input)&&reserved<=CLOSE_CONTROL_ALLOWANCE;
          // Do not accumulate a new /listo control on every attempt while a
          // file reservation is unresolved. The quota lock serializes this
          // check with complete/discard and the later reservation.
          if(close){
            const [counts]=await c.execute("SELECT COUNT(*) AS pending FROM opmx_tg_items_v1 WHERE package_id=? AND state='PENDING'",[input.packageId]);
            if(Number(counts[0]?.pending)>0)return await finish({status:'NOT_READY',pending:Number(counts[0].pending)});
          }
          const itemLimit=lease?RECOVERY_ITEM_LIMIT-(close?0:1):PACKAGE_LIMITS.items+(close?1:0);
          // Keep byte accounting exact. Allow only verified close controls a
          // bounded overage, at most 1 KiB per package in the global quota.
          const packageLimit=PACKAGE_LIMITS.packageBytes+(close?CLOSE_CONTROL_ALLOWANCE:0);
          const totalLimit=PACKAGE_LIMITS.totalBytes+(close?CLOSE_CONTROL_ALLOWANCE*PACKAGE_LIMITS.packages:0);
          if(Number(pack.item_count)>=itemLimit||Number(pack.used_bytes)+reserved>packageLimit||Number(quota[0].used_bytes)+reserved>totalLimit)return await finish({status:'QUOTA_EXCEEDED',quotaDiagnostic:diagnosePackageQuotaFailure({operation:'RESERVE',pack,quota:quota[0],requestedBytes:reserved,itemLimit,packageBytesLimit:packageLimit,totalBytesLimit:totalLimit,recovery:!!lease})});
          const id='ti_'+digest(`${ownerKey}:${input.receiptId}`).slice(0,40);
          const textOnly=input.kind==='TEXT';
          await c.execute('INSERT INTO opmx_tg_items_v1 (item_id,package_id,owner_key,receipt_key,fingerprint,kind,state,text_content,attachment_json,reserved_bytes,content_bytes,sha256,content_blob,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL,UTC_TIMESTAMP(6))',[id,input.packageId,ownerKey,receiptKey,fingerprint,input.kind,textOnly?'STORED':'PENDING',input.text,input.attachment?JSON.stringify(input.attachment):null,reserved,textOnly?reserved:0,textOnly?digest(input.text):null]);
          if(lease)await c.execute('INSERT INTO opmx_tg_recovery_contributions_v1 (item_id,package_id,actor_key,created_at) VALUES (?,?,?,UTC_TIMESTAMP(6))',[id,input.packageId,actorKey]);
          await c.execute('UPDATE opmx_tg_packages_v1 SET item_count=item_count+1,used_bytes=used_bytes+?,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE package_id=?',[reserved,input.packageId]);
          await c.execute('UPDATE opmx_tg_quota_v1 SET used_bytes=used_bytes+? WHERE id=1',[reserved]);
          if(atomicClose)return await finish(await closeResult({...pack,item_count:Number(pack.item_count)+1,used_bytes:Number(pack.used_bytes)+reserved,revision:Number(pack.revision)+1}));
          return await finish({status:textOnly?'STORED':'RESERVED',packageId:input.packageId,itemId:id,...(recoveryEnabled&&lease?{revision:Number(pack.revision)+1}:{})});
        }
        const [items]=await c.execute('SELECT * FROM opmx_tg_items_v1 WHERE item_id=? AND package_id=? AND owner_key=?',[input.itemId,input.packageId,ownerKey]);
        if(!items.length)return await finish({status:'NOT_FOUND'});const item=items[0];
        if(action==='discard') {
          if(item.state==='DISCARDED')return await finish({status:'DISCARDED_REPLAY',itemId:input.itemId});
          if(lease&&item.state==='STORED'){
            // Preserve originals and their byte reservations for audit. The
            // existing quota counts retained blobs, even when not selected.
            const [snapshots]=await c.execute('SELECT snapshot_json FROM opmx_tg_revision_snapshots_v1 WHERE package_id=? AND revision=?',[input.packageId,Number(lease.opening_revision)-1]);
            let prior;try{prior=JSON.parse(snapshots[0]?.snapshot_json??'').prior}catch{return await finish({status:'RECOVERY_POLICY_UNCONFIRMED'})}
            if(prior?.packageId!==input.packageId||prior.ownerKey!==ownerKey||prior.revision!==Number(lease.opening_revision)-1||!Array.isArray(prior.controls)||!prior.controls.length||new Set(prior.controls).size!==prior.controls.length||prior.controls.some(id=>typeof id!=='string'||!/^ti_[a-f0-9]{40}$/.test(id)))return await finish({status:'RECOVERY_POLICY_UNCONFIRMED'});
            if(prior.controls.includes(input.itemId))return await finish({status:'PROTECTED_CONTROL'});
            await c.execute("UPDATE opmx_tg_items_v1 SET state='DISCARDED' WHERE item_id=? AND state='STORED'",[input.itemId]);
            await c.execute('UPDATE opmx_tg_packages_v1 SET revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE package_id=?',[input.packageId]);
            return await finish({status:'DISCARDED',itemId:input.itemId});
          }
          if(item.state!=='PENDING')return await finish({status:'NOT_PENDING'});
          // A pending file has no committed original. Release its slot and
          // reservation together, retaining its row and receipt for audit.
          // Conditional updates plus the transaction make retries idempotent.
          const reserved=Number(item.reserved_bytes);
          if(!Number.isSafeInteger(reserved)||reserved<0||Number(pack.item_count)<1||Number(pack.used_bytes)<reserved||Number(quota[0].used_bytes)<reserved)throw Error('DISCARD_ACCOUNTING_CONFLICT');
          const [discarded]=await c.execute("UPDATE opmx_tg_items_v1 SET state='DISCARDED',reserved_bytes=0 WHERE item_id=? AND package_id=? AND state='PENDING'",[input.itemId,input.packageId]);
          if(discarded.affectedRows!==1)throw Error('DISCARD_ACCOUNTING_CONFLICT');
          const [released]=await c.execute('UPDATE opmx_tg_packages_v1 SET item_count=item_count-1,used_bytes=used_bytes-?,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND item_count>0 AND used_bytes>=?',[reserved,input.packageId,reserved]);
          if(released.affectedRows!==1)throw Error('DISCARD_ACCOUNTING_CONFLICT');
          const [quotaReleased]=await c.execute('UPDATE opmx_tg_quota_v1 SET used_bytes=used_bytes-? WHERE id=1 AND used_bytes>=?',[reserved,reserved]);
          if(quotaReleased.affectedRows!==1)throw Error('DISCARD_ACCOUNTING_CONFLICT');
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
