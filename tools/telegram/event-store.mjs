import {createHash,randomBytes} from 'node:crypto';
import {subscriptionCipher,validateCallbackUrl,webhookSigningKey,verifyEventCallback,signedCallbackPost,safeCallbackPost} from './event-delivery.mjs';

export const READY_EVENT='opmx.package.ready';
const queue='telegram-editorial',hash=x=>createHash('sha256').update(x).digest('hex');
const sqlTime=ms=>new Date(ms).toISOString().slice(0,23).replace('T',' ');
const inputError=()=>{throw Object.assign(Error('Invalid event request'),{rpcCode:-32602});};
const ownerKey=input=>{if(typeof input?.owner!=='string'||input.owner!==input.chat||!/^[1-9][0-9]{0,15}$/.test(input.owner))inputError();return hash(`opmx:telegram:v1:${input.owner}:${input.chat}`);};
const exact=(x,required,optional=[])=>{if(!x||typeof x!=='object'||Array.isArray(x)||required.some(k=>!Object.hasOwn(x,k))||Object.keys(x).some(k=>![...required,...optional].includes(k)))inputError();};
const eventInput=(action,input)=>{
 exact(input,['owner','chat','params']);const owner=ownerKey(input),p=input.params;
 exact(p,['name','arguments','delivery'],action==='subscribe'?['ttlMs','cursor','_meta']:['_meta']);
 exact(p.arguments,['queue_id']);
 if(p.name!==READY_EVENT||p.arguments.queue_id!==queue||(p.cursor!==undefined&&p.cursor!==null))inputError();
 exact(p.delivery,action==='subscribe'?['mode','url','secret']:['mode','url']);
 if(p.delivery.mode!=='webhook')inputError();
 let url;try{url=validateCallbackUrl(p.delivery.url).toString();if(action==='subscribe')webhookSigningKey(p.delivery.secret);}catch{inputError();}
 if(action==='subscribe'&&p.ttlMs!==undefined&&p.ttlMs!==null&&(!Number.isSafeInteger(p.ttlMs)||p.ttlMs<0))inputError();
 const id='sub_'+hash(JSON.stringify([owner,url,READY_EVENT,queue])).slice(0,48);
 return {owner,id,p,url};
};
const schema=[
 `CREATE TABLE IF NOT EXISTS opmx_tg_subscriptions_v1 (subscription_id VARCHAR(52) CHARACTER SET ascii PRIMARY KEY,owner_key CHAR(64) CHARACTER SET ascii NOT NULL,state VARCHAR(16) NOT NULL,secret_envelope MEDIUMTEXT NOT NULL,expires_at DATETIME(6) NOT NULL,updated_at DATETIME(6) NOT NULL,INDEX owner_subscriptions(owner_key)) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS opmx_tg_events_v1 (event_id VARCHAR(52) CHARACTER SET ascii PRIMARY KEY,owner_key CHAR(64) CHARACTER SET ascii NOT NULL,package_id VARCHAR(43) CHARACTER SET ascii NOT NULL,revision INT UNSIGNED NOT NULL,payload_json TEXT NOT NULL,created_at DATETIME(6) NOT NULL) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS opmx_tg_deliveries_v1 (delivery_key CHAR(64) CHARACTER SET ascii PRIMARY KEY,subscription_id VARCHAR(52) CHARACTER SET ascii NOT NULL,event_id VARCHAR(52) CHARACTER SET ascii NOT NULL,state VARCHAR(16) NOT NULL,attempts INT UNSIGNED NOT NULL DEFAULT 0,next_attempt_at DATETIME(6) NOT NULL,lease_until DATETIME(6) NULL,claim_token CHAR(48) CHARACTER SET ascii NULL,last_status INT NULL,INDEX due_deliveries(state,next_attempt_at)) ENGINE=InnoDB`
];

export function readyEvent(owner,packageId,revision,itemCount,timestamp) {
 return {eventId:'evt_'+hash(JSON.stringify([owner,packageId,revision])).slice(0,48),name:READY_EVENT,timestamp,data:{queue_id:queue,package_id:packageId,revision,state:'READY',item_count:itemCount},cursor:null};
}
export function deliveryOutcome(status,attempt,now,retryAfter=null) {
 if(status>=200&&status<300)return {state:'SENT',stop:false,next:now};
 const stop=[401,403,410].includes(status),terminal=stop||status===413||(status>=400&&status<500&&![408,425,429].includes(status));
 if(terminal||attempt>=8)return {state:'FAILED',stop,next:now};
 let retry=Number(retryAfter);if(!Number.isFinite(retry)||retry<0)retry=0;
 return {state:'RETRY',stop:false,next:now+Math.min(3600000,Math.max(5000*2**attempt,retry*1000))};
}

export function sharedEventOwners(config) {
 if(config==null)return null;
 if(!config||typeof config!=='object'||Array.isArray(config)||typeof config.subscriber!=='string'||!Array.isArray(config.operators)||config.operators.length===0||config.operators.length>50)throw Error('Invalid shared event owners');
 const ids=[config.subscriber,...config.operators];
 if(ids.some(id=>typeof id!=='string'||!/^[1-9][0-9]{0,15}$/.test(id)))throw Error('Invalid shared event owner');
 return {subscriber:ownerKey({owner:config.subscriber,chat:config.subscriber}),operators:new Set(config.operators.map(id=>ownerKey({owner:id,chat:id})))};
}
export function subscriptionOwnersForEvent(owner,shared) {
 return shared?.operators.has(owner) && owner!==shared.subscriber ? [owner,shared.subscriber] : [owner];
}
export function mayDeliverEvent(subscriptionOwner,eventOwner,shared) {
 return subscriptionOwner===eventOwner || Boolean(shared && subscriptionOwner===shared.subscriber && shared.operators.has(eventOwner));
}
export function createMcpEventStore({pool,guardSecret,post=safeCallbackPost,now=Date.now,logger=()=>{},sharedOperators=null}) {
 const shared=sharedEventOwners(sharedOperators);
 const cipher=subscriptionCipher(guardSecret);let ready,running=false,timer,lastLog=0;
 const initialize=()=>ready??=(async()=>{const c=await pool.getConnection();try{for(const s of schema)await c.execute(s);}finally{c.release();}})().catch(e=>{ready=undefined;throw e;});
 const access=async(c,owner)=>{const [r]=await c.execute('SELECT package_id FROM opmx_tg_packages_v1 WHERE owner_key=? LIMIT 1',[owner]);if(!r.length)throw Object.assign(Error('Event access denied'),{rpcCode:-32001});};
 const enqueue=async(c,{owner,packageId,revision,itemCount,timestamp})=>{
  const event=readyEvent(owner,packageId,revision,itemCount,timestamp);
  await c.execute('INSERT IGNORE INTO opmx_tg_events_v1 (event_id,owner_key,package_id,revision,payload_json,created_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP(6))',[event.eventId,owner,packageId,revision,JSON.stringify(event)]);
  for(const subscriberOwner of subscriptionOwnersForEvent(owner,shared))await c.execute("INSERT IGNORE INTO opmx_tg_deliveries_v1 (delivery_key,subscription_id,event_id,state,attempts,next_attempt_at) SELECT SHA2(CONCAT(subscription_id,':',?),256),subscription_id,?,'PENDING',0,UTC_TIMESTAMP(6) FROM opmx_tg_subscriptions_v1 WHERE owner_key=? AND state='ACTIVE' AND expires_at>UTC_TIMESTAMP(6)",[event.eventId,event.eventId,subscriberOwner]);
  return event.eventId;
 };
 const subscribe=async input=>{
  const {owner,id,p,url}=eventInput('subscribe',input);await initialize();
  let prior,c=await pool.getConnection();
  try{await access(c,owner);const [r]=await c.execute('SELECT secret_envelope FROM opmx_tg_subscriptions_v1 WHERE subscription_id=? AND owner_key=?',[id,owner]);if(r.length)prior=cipher.decrypt(r[0].secret_envelope,owner+':'+id);const [counts]=await c.execute("SELECT COUNT(*) total,SUM(state='ACTIVE' AND expires_at>UTC_TIMESTAMP(6)) active FROM opmx_tg_subscriptions_v1 WHERE owner_key=?",[owner]);if(!prior&&(Number(counts[0].total)>=50||Number(counts[0].active)>=5))throw Object.assign(Error('Subscription limit'),{rpcCode:-32000});}finally{c.release();}
  const config={id,url,secret:p.delivery.secret};
  const verify=prior?.secret!==config.secret||!prior?.verifiedUntil||prior.verifiedUntil<=now();
  if(verify){
   try{await verifyEventCallback(config,{post,now});}catch(e){return {rpcError:{code:-32015,message:'Callback verification failed',data:{reason:['callback_url','private_address','dns','timeout','challenge_failed','network','response_too_large'].includes(e.reason)?e.reason:'challenge_failed'}}};}
  }
  const timestamp=now(),ttl=Math.max(60000,Math.min(7*86400000,p.ttlMs??86400000)),expires=timestamp+ttl;
  const encrypted=cipher.encrypt({...config,verifiedUntil:verify?timestamp+300000:prior.verifiedUntil,oldSecret:prior?.secret!==config.secret?prior?.secret??null:prior?.oldSecret??null,oldUntil:prior?.secret!==config.secret?timestamp+300000:prior?.oldUntil??0},owner+':'+id);
  c=await pool.getConnection();try{await c.execute("INSERT INTO opmx_tg_subscriptions_v1 (subscription_id,owner_key,state,secret_envelope,expires_at,updated_at) VALUES (?,?,'ACTIVE',?,?,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE state='ACTIVE',secret_envelope=VALUES(secret_envelope),expires_at=VALUES(expires_at),updated_at=UTC_TIMESTAMP(6)",[id,owner,encrypted,sqlTime(expires)]);}finally{c.release();}
  return {id,refreshBefore:new Date(expires).toISOString(),cursor:null,truncated:false};
 };
 const unsubscribe=async input=>{
  const {owner,id}=eventInput('unsubscribe',input);await initialize();const c=await pool.getConnection();
  try{await c.execute("UPDATE opmx_tg_subscriptions_v1 SET state='STOPPED',updated_at=UTC_TIMESTAMP(6) WHERE subscription_id=? AND owner_key=?",[id,owner]);await c.execute("UPDATE opmx_tg_deliveries_v1 SET state='CANCELLED',claim_token=NULL,lease_until=NULL WHERE subscription_id=? AND state IN ('PENDING','RETRY')",[id]);return {};}finally{c.release();}
 };
 const report=async(job,outcome,status)=>{
  const c=await pool.getConnection();try{
   const [written]=await c.execute('UPDATE opmx_tg_deliveries_v1 SET state=?,next_attempt_at=?,lease_until=NULL,claim_token=NULL,last_status=? WHERE delivery_key=? AND claim_token=? AND state=\'LEASED\'',[outcome.state,sqlTime(outcome.next),status||null,job.delivery_key,job.claim_token]);
   if(outcome.stop&&written.affectedRows===1&&job.envelope)await c.execute("UPDATE opmx_tg_subscriptions_v1 SET state='STOPPED',updated_at=UTC_TIMESTAMP(6) WHERE subscription_id=? AND secret_envelope=?",[job.subscription_id,job.envelope]);
  }finally{c.release();}
 };
 const deliverOne=async()=>{
  await initialize();let c=await pool.getConnection(),job;
  try{
   await c.beginTransaction();
   await c.execute("UPDATE opmx_tg_deliveries_v1 SET state='FAILED',claim_token=NULL,lease_until=NULL WHERE state='LEASED' AND lease_until<UTC_TIMESTAMP(6) AND attempts>=8");
   const [rows]=await c.execute("SELECT delivery_key,subscription_id,event_id,attempts FROM opmx_tg_deliveries_v1 WHERE attempts<8 AND ((state IN ('PENDING','RETRY') AND next_attempt_at<=UTC_TIMESTAMP(6)) OR (state='LEASED' AND lease_until<UTC_TIMESTAMP(6))) ORDER BY next_attempt_at,delivery_key LIMIT 1 FOR UPDATE");
   if(!rows.length){await c.commit();return false;}
   job={...rows[0],claim_token:randomBytes(24).toString('hex'),attempts:Number(rows[0].attempts)+1};
   await c.execute("UPDATE opmx_tg_deliveries_v1 SET state='LEASED',attempts=attempts+1,claim_token=?,lease_until=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 30 SECOND) WHERE delivery_key=?",[job.claim_token,job.delivery_key]);await c.commit();
  }catch(e){try{await c.rollback();}catch{}throw e;}finally{c.release();}
  c=await pool.getConnection();let row;
  try{const [r]=await c.execute("SELECT s.secret_envelope,s.owner_key,e.owner_key event_owner,e.payload_json FROM opmx_tg_subscriptions_v1 s JOIN opmx_tg_events_v1 e ON e.event_id=? JOIN opmx_tg_packages_v1 p ON p.package_id=e.package_id AND p.owner_key=e.owner_key AND p.revision=e.revision AND p.state='READY' WHERE s.subscription_id=? AND s.state='ACTIVE' AND s.expires_at>UTC_TIMESTAMP(6)",[job.event_id,job.subscription_id]);row=r[0];}finally{c.release();}
  if(row&&!mayDeliverEvent(row.owner_key,row.event_owner,shared))row=null;
  if(!row){await report(job,{state:'CANCELLED',stop:false,next:now()},0);return true;}
  job.envelope=row.secret_envelope;let response;
  try{const config=cipher.decrypt(row.secret_envelope,row.owner_key+':'+job.subscription_id);response=await signedCallbackPost({...config,id:job.subscription_id},JSON.parse(row.payload_json),{post,now});}catch{response={status:0};}
  await report(job,deliveryOutcome(response.status,job.attempts,now(),response.retryAfter),response.status);return true;
 };
 const tick=async()=>{if(running)return;running=true;try{for(let i=0;i<4;i++)if(!await deliverOne())break;}catch{if(now()-lastLog>60000){lastLog=now();logger('mcp.events.worker: storage_unavailable');}}finally{running=false;}};
 return {
  initialize,enqueue,deliverOne,
  async run(action,input){
   try{
    if(action==='subscribe')return await subscribe(input);
    if(action==='unsubscribe')return await unsubscribe(input);
    if(action==='status'){
     exact(input,['owner','chat']);const owner=ownerKey(input);await initialize();const c=await pool.getConnection();try{const [s]=await c.execute("SELECT state,COUNT(*) count FROM opmx_tg_subscriptions_v1 WHERE owner_key=? GROUP BY state",[owner]);const [d]=await c.execute('SELECT d.state,COUNT(*) count FROM opmx_tg_deliveries_v1 d JOIN opmx_tg_subscriptions_v1 s ON s.subscription_id=d.subscription_id WHERE s.owner_key=? GROUP BY d.state',[owner]);return {status:'EVENTS_STATUS',subscriptions:s,deliveries:d};}finally{c.release();}
    }
    if(action==='emit'){
     exact(input,['owner','chat','packageId']);const owner=ownerKey(input);if(typeof input.packageId!=='string'||!/^tg_[a-f0-9]{40}$/.test(input.packageId))inputError();await initialize();const c=await pool.getConnection();try{await c.beginTransaction();const [p]=await c.execute("SELECT package_id,revision,DATE_FORMAT(updated_at,'%Y-%m-%dT%H:%i:%s.%fZ') occurred_at FROM opmx_tg_packages_v1 WHERE package_id=? AND owner_key=? AND state='READY' FOR UPDATE",[input.packageId,owner]);if(!p.length){await c.rollback();return {status:'NOT_FOUND'};}const [items]=await c.execute("SELECT COUNT(*) count FROM opmx_tg_items_v1 WHERE package_id=? AND owner_key=? AND state='STORED'",[input.packageId,owner]);const id=await enqueue(c,{owner,packageId:input.packageId,revision:Number(p[0].revision),itemCount:Number(items[0].count),timestamp:p[0].occurred_at});await c.commit();return {status:'EVENT_QUEUED',eventId:id};}catch(e){try{await c.rollback();}catch{}throw e;}finally{c.release();}
    }
    inputError();
   }catch(e){return {rpcError:{code:e.rpcCode??-32603,message:e.rpcCode===-32602?'Invalid event request':e.rpcCode===-32001?'Event access denied':'Event operation not confirmed'}};}
  },
  start(){if(!timer){timer=setInterval(tick,10000);timer.unref?.();void tick();}},
  stop(){clearInterval(timer);timer=undefined;}
 };
}
