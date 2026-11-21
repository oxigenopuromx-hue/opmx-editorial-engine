// Issue #44: isolated candidate. Not wired to a receiver or Publisher.
// Orders must retain the exact policy announced when created. Never infer a
// historical policy from today's destination registry.
const registries=Object.freeze({
 'publish-ambos-v1':Object.freeze(['OPURO','OPOL']),
 'publish-todos-v2':Object.freeze(['OPURO','OPOL','LIBERAL']),
 'publish-todos-v3':Object.freeze(['OPURO','OPOL','LIBERAL','HORIZONTE'])
});
export function resolveVersionedDestinations(value,policy) {
 const allowed=registries[policy];
 if(!allowed)throw Error('DESTINATION_POLICY_UNCONFIRMED');
 if(Array.isArray(value)){if(!value.every(v=>typeof v==='string'))throw Error('DESTINATION_INVALID');value=value.join(',')}
 if(typeof value!=='string'||!value.trim()||value.length>256)throw Error('DESTINATION_INVALID');
 const selected=new Set();
 for(const item of value.split(',')){
  const token=item.trim().toUpperCase();
  if(!token)throw Error('DESTINATION_EMPTY');
  const names=token==='AMBOS'?['OPURO','OPOL']:token==='TODOS'?allowed:token==='ACTIVOS'&&policy==='publish-todos-v3'?['OPURO','OPOL','LIBERAL']:[token];
  for(const name of names){if(!allowed.includes(name))throw Error('DESTINATION_UNKNOWN');selected.add(name)}
 }
 return allowed.filter(name=>selected.has(name));
}
export function versionedDestinationLabel(destinations,policy){
 const allowed=registries[policy];
 if(!allowed)throw Error('DESTINATION_POLICY_UNCONFIRMED');
 if(!Array.isArray(destinations)||!destinations.length||destinations.some(v=>typeof v!=='string'||!allowed.includes(v))||new Set(destinations).size!==destinations.length)throw Error('DESTINATION_INVALID');
 const sorted=allowed.filter(v=>destinations.includes(v));
 if(sorted.length===allowed.length&&policy!=='publish-ambos-v1')return 'TODOS';
 if(policy==='publish-todos-v3'&&sorted.length===3&&sorted[0]==='OPURO'&&sorted[1]==='OPOL'&&sorted[2]==='LIBERAL')return 'ACTIVOS';
 if(sorted.length===2&&sorted[0]==='OPURO'&&sorted[1]==='OPOL')return 'AMBOS';
 return sorted.join(',');
}
export function parseVersionedDestinationCommand(text,policy){
 if(typeof text!=='string')throw Error('INVALID_COMMAND');
 const match=new RegExp('^/(publicar|borrador)(?:[ \\t]+([A-Za-z0-9_, ]+))?$','i').exec(text.trim());
 if(!match)throw Error('INVALID_COMMAND');
 const value=match[2]??(policy==='publish-ambos-v1'?'AMBOS':'TODOS');
 const destinations=resolveVersionedDestinations(value,policy);
 return {mode:match[1].toLowerCase()==='publicar'?'PUBLISH':'DRAFT',destination:versionedDestinationLabel(destinations,policy),destinations,policy};
}

