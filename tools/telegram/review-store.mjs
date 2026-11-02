import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
export const REVIEW_OUTCOMES=['SOURCES_VERIFIED','COHERENCE_REQUIRED','INTEGRITY_FAILED'];
export function validateReviewRequest(action,x) {
 const keys=['owner','chat','packageId','revision','outcome',...(action==='report'?['messageId']:[])];
 if(!['begin','report'].includes(action)||!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).length!==keys.length||Object.keys(x).some(k=>!keys.includes(k))||typeof x.owner!=='string'||x.owner!==x.chat||!/^[1-9][0-9]{0,15}$/.test(x.owner)||!/^tg_[a-f0-9]{40}$/.test(x.packageId??'')||!Number.isSafeInteger(x.revision)||x.revision<1||!REVIEW_OUTCOMES.includes(x.outcome)||(action==='report'&&(!Number.isSafeInteger(x.messageId)||x.messageId<1)))throw Error('Solicitud inválida');
 const owner=hash(`opmx:telegram:v1:${x.owner}:${x.chat}`),key=hash(JSON.stringify([owner,x.packageId,x.revision,x.outcome]));
 return {owner,key};
}
export function reviewMessage(x,count) {
 const messages={SOURCES_VERIFIED:'El Motor verificó la integridad y la coherencia de las fuentes.',COHERENCE_REQUIRED:'El Motor detectó fuentes de temas distintos. Hace falta revisión editorial antes de preparar una nota.',INTEGRITY_FAILED:'El Motor no pudo verificar todos los archivos. Conserva los originales; hay que revisar la integridad antes de continuar.'};
 return `OPMX · revisión del Motor\nPaquete <code>${x.packageId}</code>, versión ${x.revision}.\n${count} fuente(s) guardada(s).\n${messages[x.outcome]}\nNo se ha generado ni publicado una nota.`;
}
export function createTelegramReviewStore(pool) {
 let ready;
 const initialize=()=>ready??=(async()=>{const c=await pool.getConnection();try{await c.execute(`CREATE TABLE IF NOT EXISTS opmx_tg_reviews_v1 (report_key CHAR(64) CHARACTER SET ascii PRIMARY KEY,owner_key CHAR(64) CHARACTER SET ascii NOT NULL,package_id VARCHAR(43) CHARACTER SET ascii NOT NULL,revision INT UNSIGNED NOT NULL,outcome VARCHAR(32) CHARACTER SET ascii NOT NULL,state VARCHAR(16) CHARACTER SET ascii NOT NULL,message_id BIGINT UNSIGNED NULL,updated_at DATETIME(6) NOT NULL) ENGINE=InnoDB`);}finally{c.release();}})().catch(e=>{ready=undefined;throw e;});
 return {async run(action,x){
  const {owner,key}=validateReviewRequest(action,x);await initialize();const c=await pool.getConnection();let committed=false;
  try{
   await c.beginTransaction();await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');
   const finish=async result=>{await c.commit();committed=true;return result;};
   const [pack]=await c.execute("SELECT revision FROM opmx_tg_packages_v1 WHERE package_id=? AND owner_key=? AND state='READY'",[x.packageId,owner]);
   if(!pack.length||Number(pack[0].revision)!==x.revision)return await finish({status:'REVIEW_NOT_READY',retryPermitted:false});
   const [rows]=await c.execute('SELECT state,message_id FROM opmx_tg_reviews_v1 WHERE report_key=? AND owner_key=? FOR UPDATE',[key,owner]);
   const row=rows[0];
   const ack=id=>({status:'REVIEW_REPORTED',packageId:x.packageId,revision:x.revision,outcome:x.outcome,messageId:Number(id),retryPermitted:false});
   if(action==='begin'){
    if(row)return await finish(row.state==='SENT'?ack(row.message_id):{status:'REVIEW_UNCERTAIN',retryPermitted:false});
    const [items]=await c.execute("SELECT COUNT(*) count FROM opmx_tg_items_v1 WHERE package_id=? AND owner_key=? AND state='STORED'",[x.packageId,owner]);
    await c.execute("INSERT INTO opmx_tg_reviews_v1 (report_key,owner_key,package_id,revision,outcome,state,message_id,updated_at) VALUES (?,?,?,?,?,'CLAIMED',NULL,UTC_TIMESTAMP(6))",[key,owner,x.packageId,x.revision,x.outcome]);
    return await finish({status:'SEND_REVIEW',chatId:x.chat,text:reviewMessage(x,Number(items[0].count))});
   }
   if(!row)return await finish({status:'REVIEW_NOT_CLAIMED',retryPermitted:false});
   if(row.state==='SENT')return await finish(Number(row.message_id)===x.messageId?ack(row.message_id):{status:'REVIEW_CONFLICT',retryPermitted:false});
   const [written]=await c.execute("UPDATE opmx_tg_reviews_v1 SET state='SENT',message_id=?,updated_at=UTC_TIMESTAMP(6) WHERE report_key=? AND owner_key=? AND state='CLAIMED'",[x.messageId,key,owner]);
   return await finish(written.affectedRows===1?ack(x.messageId):{status:'REVIEW_UNCERTAIN',retryPermitted:false});
  }catch(e){if(!committed)try{await c.rollback();}catch{}throw Error('Revisión no confirmada');}finally{c.release();}
 }};
}
