import {resolveDestinations,destinationLabel} from './original-destinations.mjs';
import {destinationSelectionAllowedInTransaction} from './destination-cancellation.mjs';

// A denial gate only: this never grants a write, replaces the writer fence,
// changes the original request, or promotes a cancellation to publication.
const guardedPaths=new Set([
 '/v1/reservations','/v1/targets/begin','/v1/media/begin',
 '/v1/telegram/publications/begin','/v1/telegram/submissions/begin',
 '/v1/telegram/attempts/decision','/v1/telegram/corrections/select',
 '/v1/telegram/corrections/preview','/v1/telegram/corrections/confirm',
 '/v1/telegram/previews/payload','/v1/telegram/previews/context',
 '/v1/telegram/previews/materialize','/v1/telegram/update-deliveries/consume',
 '/v1/telegram/updates/begin','/v1/telegram/updates/execute','/v1/telegram/updates/payload'
]);
const packagePattern=/^tg_[a-f0-9]{40}$/;
const requestPattern=/^tg_[a-f0-9]{64}$/;
export function createDestinationCancellationEnforcement({pool}){
 if(typeof pool?.getConnection!=='function')throw Error('CANCELLATION_GATE_CONFIGURATION_INVALID');
 return async function allowed(path,input){
  if(!guardedPaths.has(path))return true;
  if(!input||typeof input!=='object'||Array.isArray(input))return true;
  const direct=input.packageId??input.package_id;
  const requestId=input.requestId??input.request_id;
  if(!packagePattern.test(direct??'')&&!requestPattern.test(requestId??''))return true;
  let c;
  try{
   c=await pool.getConnection();
   let packageId=packagePattern.test(direct??'')?direct:null;
   if(requestPattern.test(requestId??'')){
    const [bindings]=await c.execute('SELECT package_id FROM opmx_tg_request_binding_v1 WHERE request_id=?',[requestId]);
    if(bindings.length!==1||!packagePattern.test(bindings[0]?.package_id??''))return false;
    if(packageId&&packageId!==bindings[0].package_id)return false;
    packageId=bindings[0].package_id;
   }
   if(!packageId)return false;
   const [cancelled]=await c.execute('SELECT destination FROM opmx_tg_destination_cancellations_v1 WHERE package_id=?',[packageId]);
   if(!cancelled.length)return true;
   if(cancelled.some(x=>!['OPURO','OPOL','LIBERAL'].includes(x.destination)))return false;
   let destinations;
   const label=input.destination??input.destinations;
   if(typeof label==='string')destinations=resolveDestinations(label);
   else if(Array.isArray(label))destinations=resolveDestinations(label.join(','));
   else if(Array.isArray(input.targets)&&input.targets.length)destinations=resolveDestinations(input.targets.map(x=>x.destination).join(','));
   else{
    // Never inherit TODOS from an old snapshot after a destination was
    // explicitly cancelled. An authenticated current lease must select a set.
    const [choices]=await c.execute('SELECT s.destination FROM opmx_tg_correction_selections_v2 s JOIN opmx_tg_recovery_leases_v1 l ON l.package_id=s.package_id AND l.actor_key=s.owner_key WHERE s.package_id=? AND s.revision>=l.opening_revision ORDER BY s.revision DESC LIMIT 1',[packageId]);
    if(choices.length!==1)return false;
    destinations=resolveDestinations(choices[0].destination);
   }
   return await destinationSelectionAllowedInTransaction(c,{packageId,destination:destinationLabel(destinations)});
  }catch{return false}finally{if(c)try{c.release()}catch{}}
 };
}
