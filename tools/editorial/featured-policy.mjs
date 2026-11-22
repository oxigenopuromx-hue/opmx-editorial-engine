import {resolveDestinations} from '../telegram/guard-recovery-candidate/original-destinations.mjs';
import {resolveVersionedDestinations} from '../telegram/guard-recovery-candidate/versioned-destinations.mjs';
import {prepareFeaturedMetadata} from './featured-metadata.mjs';

// policy must be the verified result of chooseMotorPolicy. This module does not
// authenticate a caller, source or authorization and never starts a write.
export function prepareFeaturedForPolicy(master,{featuredAlt,policy}={}) {
 if(!policy||policy.authorized!==true||!['PUBLISH','DRAFT'].includes(policy.mode)||typeof policy.destination!=='string')throw Error('FEATURED_POLICY_UNCONFIRMED');
 let destinations;
 try{
  destinations=policy.policy===undefined?resolveDestinations(policy.destination):resolveVersionedDestinations(policy.destination,policy.policy);
  if(policy.policy!==undefined&&(!Array.isArray(policy.destinations)||JSON.stringify(policy.destinations)!==JSON.stringify(destinations)))throw Error('FEATURED_POLICY_UNCONFIRMED');
 }catch{throw Error('FEATURED_POLICY_UNCONFIRMED')}
 return prepareFeaturedMetadata(master,{featuredAlt,destinations});
}
