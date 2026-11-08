import {createHash} from 'node:crypto';

const identity=id=>createHash('sha256').update(`opmx:telegram:v1:${id}:${id}`).digest('hex');
const user=/^[1-9][0-9]{0,15}$/;
const pkg=/^tg_[a-f0-9]{40}$/;

// The authenticated Telegram receiver supplies the private chat identity;
// the caller cannot select another owner, an administrator role or a filter.
// BLOCKED is a processing status, never proof that reopening is safe. This
// lists only newly tracked attempts; historical cases require reconciliation.
export function createBlockedList({pool,adminUserIds=[]}){
 if(!pool?.getConnection||!Array.isArray(adminUserIds)||adminUserIds.some(x=>typeof x!=='string'||!user.test(x)))throw Error('INVALID_BLOCKED_LIST_CONFIGURATION');
 const admins=new Set(adminUserIds.map(identity));
 return async function list(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='chat,owner'||typeof input.owner!=='string'||!user.test(input.owner)||input.owner!==input.chat)return {status:'INVALID_REQUEST'};
  const actor=identity(input.owner),admin=admins.has(actor),connection=await pool.getConnection();
  try{
   const filter=admin?'':' AND p.owner_key=?';
   const [rows]=await connection.execute("SELECT p.package_id,p.revision FROM opmx_tg_packages_v1 p JOIN opmx_tg_motor_attempts_v1 a ON a.package_id=p.package_id AND a.revision=p.revision WHERE p.state='READY' AND a.state='BLOCKED'"+filter+' ORDER BY a.updated_at DESC,p.package_id LIMIT 21',admin?[]:[actor]);
   if(!Array.isArray(rows)||rows.length>21||rows.some(r=>!pkg.test(r.package_id??'')||!Number.isSafeInteger(Number(r.revision))||Number(r.revision)<1||Number(r.revision)>4294967295)||new Set(rows.map(r=>r.package_id)).size!==rows.length)throw Error('BLOCKED_LIST_UNCONFIRMED');
   return {status:'BLOCKED_LIST',packages:rows.slice(0,20).map(r=>({packageId:r.package_id,revision:Number(r.revision)})),more:rows.length===21};
  }finally{connection.release()}
 };
}
