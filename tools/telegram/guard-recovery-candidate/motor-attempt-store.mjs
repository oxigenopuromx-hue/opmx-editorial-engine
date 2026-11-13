import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {readConfirmedCorrectionInTransaction,readVerifiedUpdateDecisionInTransaction} from './confirmed-correction-reader.mjs';
import {resolveDestinations} from './original-destinations.mjs';

// Candidate: install only in isolated QA until the Motor and every publisher
// path use it. A timeout is never interpreted as a terminated attempt.
export const motorAttemptSchema=`CREATE TABLE IF NOT EXISTS opmx_tg_motor_attempts_v1 (
 package_id VARCHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL,
 event_id VARCHAR(52) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 state VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 updated_at DATETIME(6) NOT NULL,
 PRIMARY KEY(package_id,revision), UNIQUE KEY(event_id)
) ENGINE=InnoDB`;
const valid=(id,revision)=>/^tg_[a-f0-9]{40}$/.test(id??'')&&Number.isSafeInteger(revision)&&revision>0&&revision<=4294967295;
const digest=s=>createHash('sha256').update(s).digest('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===64&&b.length===64&&timingSafeEqual(Buffer.from(a),Buffer.from(b));

// Called inside the same transaction as seal and event enqueue. The expected
// event ID must be created by the guard's actual outbox, not by the caller.
export async function initializeMotorAttempt(connection,{packageId,revision,eventId}){
 if(!connection?.execute||!valid(packageId,revision)||!/^evt_[a-f0-9]{48}$/.test(eventId??''))throw Error('INVALID_ATTEMPT');
 await connection.execute("INSERT INTO opmx_tg_motor_attempts_v1 (package_id,revision,event_id,state,token_hash,updated_at) VALUES (?,?,?,'QUEUED',NULL,UTC_TIMESTAMP(6))",[packageId,revision,eventId]);
}
export function createMotorAttemptStore({pool,adminUserIds=[],tokenFactory=()=>randomBytes(32).toString('hex'),readDecision=readConfirmedCorrectionInTransaction,readUpdateDecision=readVerifiedUpdateDecisionInTransaction,verifyLiteralEnforcement=async()=>false,verifyUpdateEnforcement=async()=>false,verifyCompletedWrites=async()=>null,recoverBlockedUnwritten=null}){
 if(!Array.isArray(adminUserIds)||adminUserIds.some(x=>typeof x!=='string'||!/^[1-9][0-9]{0,15}$/.test(x)))throw Error('INVALID_ATTEMPT_CONFIGURATION');
 const admins=new Set(adminUserIds);
 if(!pool?.getConnection||typeof tokenFactory!=='function'||typeof readDecision!=='function'||typeof readUpdateDecision!=='function'||typeof verifyLiteralEnforcement!=='function'||typeof verifyUpdateEnforcement!=='function'||typeof verifyCompletedWrites!=='function'||recoverBlockedUnwritten!==null&&typeof recoverBlockedUnwritten!=='function')throw Error('INVALID_ATTEMPT_CONFIGURATION');
 async function transaction(fn){const c=await pool.getConnection();let committed=false;try{await c.beginTransaction();const result=await fn(c);await c.commit();committed=true;return result}catch(e){if(!committed)try{await c.rollback()}catch{}throw e}finally{c.release()}}
 const store={
  // The existing webhook payload contains package/revision, not eventId.
  // Resolve the registered attempt on the server; begin() rechecks state,
  // event binding, revision and fence under locks before issuing a capability.
  async start(input={}){
   if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='chat,owner,packageId,revision'||typeof input.owner!=='string'||input.owner!==input.chat||!/^[1-9][0-9]{0,15}$/.test(input.owner)||!valid(input.packageId,input.revision))throw Error('INVALID_ATTEMPT');
   const c=await pool.getConnection();let rows;try{[rows]=await c.execute('SELECT a.event_id,p.owner_key FROM opmx_tg_motor_attempts_v1 a JOIN opmx_tg_packages_v1 p ON p.package_id=a.package_id WHERE a.package_id=? AND a.revision=?',[input.packageId,input.revision])}finally{c.release()}
   if(rows.length!==1||(rows[0].owner_key!==digest(`opmx:telegram:v1:${input.owner}:${input.chat}`)&&!admins.has(input.owner))||!/^evt_[a-f0-9]{48}$/.test(rows[0].event_id??''))return {status:'ATTEMPT_NOT_REGISTERED'};
   const eventId=rows[0].event_id,result=await store.begin({packageId:input.packageId,revision:input.revision,eventId},rows[0].owner_key);
   return result.status==='ATTEMPT_STARTED'?{...result,eventId}:result;
  },
  async begin(input={},expectedOwnerKey=null){
   const {packageId,revision,eventId}=input??{};
   if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='eventId,packageId,revision'||!valid(packageId,revision)||!/^evt_[a-f0-9]{48}$/.test(eventId??''))throw Error('INVALID_ATTEMPT');
   return transaction(async c=>{
    // Same lock order as seal/reopen: package, then attempt, then fence.
    const [p]=await c.execute('SELECT state,revision,owner_key FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);
    if(p.length!==1||p[0].state!=='READY'||Number(p[0].revision)!==revision)return {status:'STALE_REVISION'};
    if(expectedOwnerKey!==null&&p[0].owner_key!==expectedOwnerKey)return {status:'ATTEMPT_NOT_REGISTERED'};
    const [a]=await c.execute('SELECT state,event_id FROM opmx_tg_motor_attempts_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    if(a.length!==1||a[0].event_id!==eventId)return {status:'ATTEMPT_NOT_REGISTERED'};
    if(a[0].state!=='QUEUED')return {status:'ATTEMPT_ALREADY_CLAIMED'};
    const [f]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    if(f.length!==1||!['READY_TO_WRITE','AWAITING_DECISION'].includes(f[0].state))return {status:'ATTEMPT_NOT_PERMITTED'};
    const token=tokenFactory();if(!/^[a-f0-9]{64}$/.test(token))throw Error('INVALID_ATTEMPT_TOKEN');
    const [changed]=await c.execute("UPDATE opmx_tg_motor_attempts_v1 SET state='RUNNING',token_hash=?,updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state='QUEUED'",[digest(token),packageId,revision]);
    if(changed.affectedRows!==1)throw Error('ATTEMPT_CLAIM_CONFLICT');
    return {status:'ATTEMPT_STARTED',token};
   });
  },
  // RUNNING recovery requires a still-unacknowledged decision. An explicitly
  // installed BLOCKED recovery provider instead runs the complete unwritten
  // reconciliation gate before returning to AWAITING_DECISION. Both rotate
  // the old capability atomically; neither retries start() or an uncertain
  // CMS write. Ordinary decision acknowledgement remains mandatory.
  async recoverUnacknowledged(input={}){
   const {owner,chat,packageId,revision,eventId,previewHash}=input??{};
   const origin=input?.origin,hasOrigin=!!input&&Object.hasOwn(input,'origin');
   if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!==(hasOrigin?'chat,eventId,origin,owner,packageId,previewHash,revision':'chat,eventId,owner,packageId,previewHash,revision')||hasOrigin&&(!origin||typeof origin!=='object'||Array.isArray(origin)||Object.keys(origin).sort().join(',')!=='executionId,workflowId'||origin.workflowId!=='bnzVMNkZuGO1GQCZ'||typeof origin.executionId!=='string'||!/^[1-9][0-9]{0,31}$/.test(origin.executionId))||owner!==chat||!admins.has(owner)||!valid(packageId,revision)||!/^evt_[a-f0-9]{48}$/.test(eventId??'')||!/^[a-f0-9]{64}$/.test(previewHash??''))return {status:'RECOVERY_NOT_AUTHORIZED',retryPermitted:false};
   // A blocked attempt needs the complete unwritten reconciliation gate. Do
   // not nest its quota/package transaction inside the ordinary RUNNING path.
   // The helper independently locks and rechecks the observed state, so this
   // read is routing only and cannot grant a capability after a race.
   if(recoverBlockedUnwritten){
    const c=await pool.getConnection();let states;try{[states]=await c.execute('SELECT state FROM opmx_tg_motor_attempts_v1 WHERE package_id=? AND revision=?',[packageId,revision])}finally{c.release()}
    if(states.length===1&&states[0].state==='BLOCKED')return recoverBlockedUnwritten(input);
   }
   return transaction(async c=>{
    const [p]=await c.execute('SELECT state,revision,owner_key FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);
    if(p.length!==1||p[0].state!=='READY'||Number(p[0].revision)!==revision)return {status:'STALE_REVISION',retryPermitted:false};
    const [a]=await c.execute('SELECT state,event_id,token_hash FROM opmx_tg_motor_attempts_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    if(a.length!==1||a[0].state!=='RUNNING'||a[0].event_id!==eventId)return {status:'RECOVERY_NOT_PERMITTED',retryPermitted:false};
    const [f]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    if(f.length!==1||f[0].state!=='AWAITING_DECISION')return {status:'RECONCILIATION_REQUIRED',retryPermitted:false};
    let d;try{d=await readDecision(c,packageId,revision)}catch{return {status:'DECISION_UNCONFIRMED',retryPermitted:false}}
    if(!d||d.package_id!==packageId||d.revision!==revision||d.preview_hash!==previewHash)return {status:'DECISION_MISMATCH',retryPermitted:false};
    const token=tokenFactory();if(!/^[a-f0-9]{64}$/.test(token)||equal(digest(token),a[0].token_hash))throw Error('INVALID_ATTEMPT_TOKEN');
    const [changed]=await c.execute("UPDATE opmx_tg_motor_attempts_v1 SET token_hash=?,updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state='RUNNING' AND token_hash=?",[digest(token),packageId,revision,a[0].token_hash]);
    if(changed.affectedRows!==1)throw Error('ATTEMPT_RECOVERY_CONFLICT');
    return {status:'UNACKNOWLEDGED_ATTEMPT_RECOVERED',eventId,token,retryPermitted:false};
   });
  },
  async acknowledgeDecision(input={}){
   const {packageId,revision,eventId,token,previewHash,destination,contentMode,action}=input??{};
   if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='action,contentMode,destination,eventId,packageId,previewHash,revision,token'||!valid(packageId,revision)||!/^evt_[a-f0-9]{48}$/.test(eventId??'')||!/^[a-f0-9]{64}$/.test(token??'')||!/^[a-f0-9]{64}$/.test(previewHash??'')||!['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'].includes(destination)||!['LITERAL','EDITORIAL'].includes(contentMode)||!['CREATE','UPDATE'].includes(action))throw Error('INVALID_ATTEMPT');
   return transaction(async c=>{
    const [q]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(q.length!==1)throw Error('QUOTA_MISSING');
    const [p]=await c.execute('SELECT state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);
    if(p.length!==1||p[0].state!=='READY'||Number(p[0].revision)!==revision)return {status:'STALE_REVISION',retryPermitted:false};
    const [a]=await c.execute('SELECT state,event_id,token_hash FROM opmx_tg_motor_attempts_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    if(a.length!==1||a[0].state!=='RUNNING'||a[0].event_id!==eventId||!equal(a[0].token_hash,digest(token)))return {status:'ATTEMPT_NOT_AUTHORIZED',retryPermitted:false};
    const [f]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    if(f.length!==1||f[0].state!=='AWAITING_DECISION')return {status:'DECISION_ACK_NOT_PERMITTED',retryPermitted:false};
    let d;try{d=action==='UPDATE'?await readUpdateDecision(c,{packageId,revision}):await readDecision(c,packageId,revision)}catch{return {status:'DECISION_UNCONFIRMED',retryPermitted:false}}
    const normalized=action==='UPDATE'?d:d&&{packageId:d.package_id,revision:d.revision,previewHash:d.preview_hash,destination:d.destination,contentMode:d.content_mode,action:d.action};
    if(!normalized||normalized.packageId!==packageId||normalized.revision!==revision||normalized.previewHash!==previewHash||normalized.destination!==destination||normalized.contentMode!==contentMode||normalized.action!==action)return {status:'DECISION_MISMATCH',retryPermitted:false};
    // The update writer must be proven to claim the same confirmed target IDs
    // before any network write. Missing proof leaves the fence closed.
    if(action==='UPDATE'){
     const destinations=resolveDestinations(destination),posts=normalized.posts;
     if(!Array.isArray(posts)||posts.length!==destinations.length||posts.some((p,i)=>p?.destination!==destinations[i]||!Number.isSafeInteger(p.postId)||p.postId<1)||await verifyUpdateEnforcement(c,{packageId,revision,eventId,previewHash,destination,posts})!==true)return {status:'UPDATE_ENFORCEMENT_UNCONFIRMED',retryPermitted:false};
    }
    // An acknowledgement does not prove the writer preserves literal text.
    // Until a server-owned enforcement proof exists, literal remains fenced.
    if(contentMode==='LITERAL'&&await verifyLiteralEnforcement(c,{packageId,revision,eventId,previewHash,destination})!==true)return {status:'LITERAL_ENFORCEMENT_UNCONFIRMED',retryPermitted:false};
    const [changed]=await c.execute("UPDATE opmx_tg_publication_fence_v1 SET state='READY_TO_WRITE',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state='AWAITING_DECISION'",[packageId,revision]);
    if(changed.affectedRows!==1)throw Error('FENCE_CONFLICT');
    return {status:'DECISION_ACKNOWLEDGED',packageId,revision,retryPermitted:false};
   });
  },
  // A completed publishing attempt is a protocol state, not a claim that the
  // ChatGPT process exited. The exact writer acknowledgement is required and
  // the same transaction permanently removes this revision's write permission.
  async complete(input={}){
   const {packageId,revision,eventId,token}=input??{};
   if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='eventId,packageId,revision,token'||!valid(packageId,revision)||!/^evt_[a-f0-9]{48}$/.test(eventId??'')||!/^[a-f0-9]{64}$/.test(token??''))throw Error('INVALID_ATTEMPT');
   return transaction(async c=>{
    const [q]=await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');if(q.length!==1)throw Error('QUOTA_MISSING');
    const [p]=await c.execute('SELECT state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);
    if(p.length!==1||p[0].state!=='READY'||Number(p[0].revision)!==revision)return {status:'STALE_REVISION',retryPermitted:false};
    const [a]=await c.execute('SELECT state,event_id,token_hash FROM opmx_tg_motor_attempts_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    if(a.length!==1||a[0].event_id!==eventId||!equal(a[0].token_hash,digest(token)))return {status:'ATTEMPT_NOT_AUTHORIZED',retryPermitted:false};
    if(a[0].state==='COMPLETED')return {status:'COMPLETED_REPLAY',packageId,revision,retryPermitted:false};
    if(a[0].state!=='RUNNING')return {status:'ATTEMPT_NOT_RUNNING',retryPermitted:false};
    const [f]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    if(f.length!==1||!['WRITING','HISTORICAL_WRITING'].includes(f[0].state))return {status:'RECONCILIATION_REQUIRED',retryPermitted:false};
    const proof=await verifyCompletedWrites(c,{packageId,revision,eventId});
    if(!proof||proof.packageId!==packageId||proof.revision!==revision||!['DRAFT','PUBLISH','UPDATE'].includes(proof.phase)||!/^[a-f0-9]{64}$/.test(proof.receiptHash??''))return {status:'WRITER_COMPLETION_UNCONFIRMED',retryPermitted:false};
    const [frozen]=await c.execute("UPDATE opmx_tg_publication_fence_v1 SET state='RECONCILING',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state=?",[packageId,revision,f[0].state]);
    if(frozen.affectedRows!==1)throw Error('FENCE_CONFLICT');
    const [changed]=await c.execute("UPDATE opmx_tg_motor_attempts_v1 SET state='COMPLETED',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state='RUNNING'",[packageId,revision]);
    if(changed.affectedRows!==1)throw Error('ATTEMPT_STATE_CONFLICT');
    return {status:'ATTEMPT_COMPLETED',packageId,revision,reopenPermitted:false,retryPermitted:false};
   });
  },
  async block(input={}){
   const {packageId,revision,eventId,token}=input??{};
   if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='eventId,packageId,revision,token'||!valid(packageId,revision)||!/^evt_[a-f0-9]{48}$/.test(eventId??'')||!/^[a-f0-9]{64}$/.test(token??''))throw Error('INVALID_ATTEMPT');
   return transaction(async c=>{
    const [p]=await c.execute('SELECT state,revision FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);
    if(p.length!==1||p[0].state!=='READY'||Number(p[0].revision)!==revision)return {status:'STALE_REVISION'};
    const [a]=await c.execute('SELECT state,event_id,token_hash FROM opmx_tg_motor_attempts_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    if(a.length!==1||a[0].event_id!==eventId||!equal(a[0].token_hash,digest(token)))return {status:'ATTEMPT_NOT_AUTHORIZED'};
    if(a[0].state==='BLOCKED')return {status:'BLOCKED_REPLAY'};
    if(a[0].state!=='RUNNING')return {status:'ATTEMPT_NOT_RUNNING'};
    const [f]=await c.execute('SELECT state FROM opmx_tg_publication_fence_v1 WHERE package_id=? AND revision=? FOR UPDATE',[packageId,revision]);
    if(f.length!==1)return {status:'RECONCILIATION_REQUIRED'};
    // If a writer already started, do not claim it had no side effects.
    if(!['READY_TO_WRITE','AWAITING_DECISION'].includes(f[0].state))return {status:'RECONCILIATION_REQUIRED'};
    const [frozen]=await c.execute("UPDATE opmx_tg_publication_fence_v1 SET state='RECONCILING',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state IN ('READY_TO_WRITE','AWAITING_DECISION')",[packageId,revision]);
    if(frozen.affectedRows!==1)throw Error('FENCE_CONFLICT');
    const [changed]=await c.execute("UPDATE opmx_tg_motor_attempts_v1 SET state='BLOCKED',updated_at=UTC_TIMESTAMP(6) WHERE package_id=? AND revision=? AND state='RUNNING'",[packageId,revision]);
    if(changed.affectedRows!==1)throw Error('ATTEMPT_STATE_CONFLICT');
    return {status:'ATTEMPT_BLOCKED',reopenPermitted:false};
   });
  }
 };
 return store;
}
