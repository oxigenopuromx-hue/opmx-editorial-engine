import {readConfirmedCorrectionInTransaction} from './confirmed-correction-reader.mjs';
import {expectedDraftRequestId} from './correlation-candidate.mjs';
import {resolveDestinations} from './original-destinations.mjs';

// All existing creation/media/publication writers share this preflight. An
// UPDATE acknowledgement must never open the ordinary CREATE writer, and a
// CREATE acknowledgement must not permit another canonical destination set.
// The decision is immutable. The underlying writer independently reacquires
// the package and fence locks and rechecks READY + revision before granting a
// permit, so advancing a package between these transactions fails closed.
export function createRecoveredCreationGate({pool,readDecision=readConfirmedCorrectionInTransaction}){
 if(!pool?.getConnection||typeof readDecision!=='function')throw Error('RECOVERED_WRITER_CONFIGURATION_INVALID');
 return async input=>{
  if(typeof input?.requestId!=='string')return false;
  if(!/^tg_/i.test(input.requestId))return true;
  const c=await pool.getConnection();let done=false;
  try{
   await c.beginTransaction();
   const [rows]=await c.execute('SELECT b.package_id,b.revision,p.state,p.revision AS current_revision FROM opmx_tg_request_binding_v1 b JOIN opmx_tg_packages_v1 p ON p.package_id=b.package_id WHERE b.request_id=? FOR UPDATE',[input.requestId]);
   // Unknown tg requests still go to the existing cutover router, which can
   // bind only an actual trusted outbox event and otherwise rejects them.
   let allowed=rows.length===0;
   if(rows.length===1){const b=rows[0],revision=Number(b.revision);
    if(b.state==='READY'&&Number(b.current_revision)===revision){
     const [saved]=await c.execute('SELECT decision_json FROM opmx_tg_confirmed_decisions_v1 WHERE package_id=? AND revision=? FOR UPDATE',[b.package_id,revision]);
     if(saved.length===0)allowed=true;
     else if(saved.length===1){
      let value;try{value=JSON.parse(saved[0].decision_json)}catch{return false}
      if(value?.action==='CREATE'){
       const d=await readDecision(c,b.package_id,revision);
       allowed=!!d&&d.action==='CREATE'&&expectedDraftRequestId({packageId:b.package_id,revision,destination:d.destination})===input.requestId;
       if(allowed&&Object.hasOwn(input,'destination'))allowed=resolveDestinations(d.destination).includes(input.destination);
      }
     }
    }
   }
   await c.commit();done=true;return allowed;
  }catch{return false}finally{if(!done)try{await c.rollback()}catch{}c.release()}
 };
}
