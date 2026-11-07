import {createHash} from 'node:crypto';

const userIdPattern=/^[1-9][0-9]{0,15}$/;
const packagePattern=/^tg_[a-f0-9]{40}$/;
const receiptPattern=/^telegram-[1-9][0-9]{0,15}-[0-9]{1,16}-[0-9]{1,16}$/;
const ownerKey=id=>createHash('sha256').update(`opmx:telegram:v1:${id}:${id}`).digest('hex');
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function completeRevision(value,{id,revision,ownerKey}) {
  if(!object(value)||value.packageId!==id||value.revision!==revision||value.ownerKey!==ownerKey||
     typeof value.requestId!=='string'||!value.requestId.trim()||
     !Array.isArray(value.destinations)||!value.destinations.length||
     value.destinations.some(x=>!['OPURO','OPOL','LIBERAL'].includes(x))||
     new Set(value.destinations).size!==value.destinations.length||
     !object(value.authorization)||!Object.keys(value.authorization).length||
     !Array.isArray(value.controls)||!Array.isArray(value.results)) return false;
  // The provider must explicitly report one result for each destination.
  return value.results.length===value.destinations.length && value.results.every(x=>
    object(x)&&value.destinations.includes(x.destination)&&typeof x.status==='string'&&x.status.trim()) &&
    new Set(value.results.map(x=>x.destination)).size===value.destinations.length;
}

// The adapter is deliberately transactional: lockQuota, lockPackage, lockSession,
// lockLease and lockSafetyBarrier MUST lock the same rows used by every writer.
// A safety barrier cannot be supplied by Telegram or the caller: only the guard's
// reconciliation subsystem may establish it, after stopping all old attempts.
export function createReopenService({db,adminUserIds=[]}) {
  if(!db || typeof db.transaction!=='function' || !Array.isArray(adminUserIds) ||
     adminUserIds.some(id=>typeof id!=='string'||!userIdPattern.test(id))) throw Error('INVALID_CONFIGURATION');
  const adminKeys=new Set(adminUserIds.map(ownerKey));
  return async function reopen(input) {
    if(!input || Object.keys(input).sort().join(',')!=='chat,owner,packageId,receiptId' ||
       typeof input.owner!=='string'||!userIdPattern.test(input.owner)||input.chat!==input.owner||
       !packagePattern.test(input.packageId??'')||!receiptPattern.test(input.receiptId??'')||
       !input.receiptId.startsWith(`telegram-${input.chat}-`)) return {status:'INVALID_REQUEST'};
    const actor=ownerKey(input.owner), id=input.packageId;
    return db.transaction(async tx=>{
      await tx.lockQuota(); // Same first lock as the existing package store.
      const pkg=await tx.lockPackage(id);
      if(!pkg || (pkg.ownerKey!==actor&&!adminKeys.has(actor)))return {status:'NOT_FOUND'};
      const session=await tx.lockSession(actor), lease=await tx.lockLease(id);
      if(session && session.packageId!==id)return {status:'SESSION_BUSY'};
      if(pkg.state==='OPEN' && session?.packageId===id && lease?.actorKey===actor)
        return {status:'OPEN_REPLAY',packageId:id,revision:pkg.revision};
      if(session || lease || pkg.state!=='READY')return {status:'NOT_REOPENABLE'};
      if(!Number.isSafeInteger(pkg.revision)||pkg.revision<1||pkg.revision>=Number.MAX_SAFE_INTEGER)throw Error('INVALID_REVISION');
      const barrier=await tx.lockSafetyBarrier(id,pkg.revision);
      if(!barrier || barrier.packageId!==id || barrier.revision!==pkg.revision ||
         barrier.terminalBlocked!==true || barrier.noActiveAttempts!==true ||
         barrier.noPublicationSideEffects!==true || barrier.writesFenced!==true)
        return {status:'RECONCILIATION_REQUIRED'};
      const items=await tx.lockInventory(id);
      if(!Array.isArray(items)||items.some(x=>x.state==='PENDING'))return {status:'PENDING_RESERVATION'};
      // Only a server-owned provider operating under the same transaction can
      // supply the prior publication metadata; missing evidence fails closed.
      const prior=typeof tx.captureTrustedRevision==='function'?await tx.captureTrustedRevision(id,pkg.revision,pkg.ownerKey):null;
      if(!completeRevision(prior,{id,revision:pkg.revision,ownerKey:pkg.ownerKey}))return {status:'RECONCILIATION_REQUIRED'};
      await tx.saveSnapshot({packageId:id,revision:pkg.revision,ownerKey:pkg.ownerKey,items,barrier,prior});
      const revision=pkg.revision+1;
      await tx.markOpen({packageId:id,expectedRevision:pkg.revision,revision});
      await tx.createLease({packageId:id,actorKey:actor,ownerKey:pkg.ownerKey,revision,receiptId:input.receiptId});
      await tx.createSession({actorKey:actor,packageId:id});
      await tx.audit({type:'PACKAGE_REOPENED',packageId:id,previousRevision:pkg.revision,revision,actorKey:actor,ownerKey:pkg.ownerKey});
      return {status:'OPEN',packageId:id,revision};
    });
  };
}
