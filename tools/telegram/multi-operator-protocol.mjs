import { ownerForMessage, ownerForRequest } from './operator-routing.mjs';

const PRIVATE_TOOLS=new Set(['leer_paquete_telegram_opmx','leer_fuente_telegram_opmx','informar_revision_telegram_opmx','informar_bloqueo_telegram_opmx']);

// The caller must retrieve rows only from the authenticated intake registry.
// Missing registry rows for a private tool fail closed; there is no default owner.
export function identityForPrivateCall(envelope,rows,subscriber) {
 let message=envelope?.body??envelope;
 if(typeof message==='string')try{message=JSON.parse(message);}catch{throw Error('Invalid envelope');}
 if(message?.method==='tools/call' && PRIVATE_TOOLS.has(message?.params?.name))return ownerForMessage(rows,message);
 if(!subscriber || typeof subscriber.owner!=='string' || subscriber.owner!==subscriber.chat || !/^[1-9][0-9]{0,15}$/.test(subscriber.owner))throw Error('Invalid subscriber');
 return {owner:subscriber.owner,chat:subscriber.chat};
}

// Publisher output is associated by its stable request ID, never by arbitrary
// text or a user-provided destination. No match means no automatic notice.
export function identityForPublisherNotice(rows,request) {
 try{return ownerForRequest(rows,request?.request_id);}catch{return null;}
}
