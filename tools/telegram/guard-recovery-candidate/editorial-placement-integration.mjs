import {editorialPlacementSchema,createEditorialPlacementStore} from './editorial-placement-store.mjs';

// Initialization is explicitly awaited before exposing routes/providers. DDL
// never runs inside select/prove, a package operation or an UPDATE claim.
export async function prepareEditorialPlacementServices({pool}) {
 if(!pool?.getConnection)throw Error('PLACEMENT_CONFIGURATION_INVALID');
 const c=await pool.getConnection();try{await c.execute(editorialPlacementSchema)}finally{c.release()}
 return createEditorialPlacementStore({pool});
}

const replace=(source,from,to)=>{if(typeof source!=='string'||source.split(from).length!==2)throw Error('PLACEMENT_INTEGRATION_SOURCE_CHANGED');return source.replace(from,to)};

// Returns a patch of the CURRENT #18 server, never an older full-file export.
// Both copies can use the same anchors; authentication/body limits/error
// handling stay in their original order and are not replaced.
export function patchEditorialPlacementGuardSource(source) {
 if(source.includes('EDITORIAL_PLACEMENT_GUARD_V1'))throw Error('PLACEMENT_INTEGRATION_ALREADY_INSTALLED');
 let out=replace(source,'telegramSelections=null,','telegramSelections=null,telegramPlacement=null,');
 out=replace(out,"  const expected=Buffer.from('Bearer '+secret);","  if(telegramPlacement!==null&&(!telegramPlacement||typeof telegramPlacement.select!=='function'||typeof telegramPlacement.prove!=='function'))throw Error('Configuración incompleta');\n  const expected=Buffer.from('Bearer '+secret);");
 out=replace(out,"    const selectionAction=telegramSelections&&req.url==='/v1/telegram/corrections/select';","    const selectionAction=telegramSelections&&req.url==='/v1/telegram/corrections/select';\n    const placementAction=telegramPlacement&&/^\\/v1\\/telegram\\/placement\\/(select|prove)$/.exec(req.url)?.[1];");
 out=replace(out,'!selectionAction&&!deliveryAction','!selectionAction&&!placementAction&&!deliveryAction');
 out=replace(out,'||selectionAction||deliveryAction','||selectionAction||placementAction||deliveryAction');
 out=replace(out,'        if(selectionAction)return end(200,await telegramSelections.select(input));','        if(selectionAction)return end(200,await telegramSelections.select(input));\n        if(placementAction)return end(200,await telegramPlacement[placementAction](input));');
 return '// EDITORIAL_PLACEMENT_GUARD_V1\n'+out;
}

// Optional callback appended to the existing authorised manifest path. The
// callback receives server-resolved identities, not IDs from source text.
export function patchEditorialPlacementPackageStoreSource(source) {
 if(source.includes('EDITORIAL_PLACEMENT_MANIFEST_V1'))throw Error('PLACEMENT_INTEGRATION_ALREADY_INSTALLED');
 let out=replace(source,'readPublisherResult=null','readPublisherResult=null,readEditorialPlacement=null');
 out=replace(out,'  const admins=new Set',"  if(readEditorialPlacement!==null&&typeof readEditorialPlacement!=='function')throw Error('Configuración inválida');\n  const admins=new Set");
 out=replace(out,"          return await finish({status:'FOUND',packageId:pack.package_id,state:pack.state", "          let editorialPlacement=null;\n          if(readEditorialPlacement){editorialPlacement=await readEditorialPlacement(c,{packageId:pack.package_id,revision:Number(pack.revision),ownerKey,actorKey});if(editorialPlacement!==null&&(!editorialPlacement||typeof editorialPlacement!=='object'||Array.isArray(editorialPlacement)||!['PLACEMENT_SELECTION','PLACEMENT_PRESERVE'].includes(editorialPlacement.status)))return await finish({status:'PLACEMENT_CONTEXT_UNCONFIRMED'});}\n          return await finish({status:'FOUND',packageId:pack.package_id,state:pack.state");
 out=replace(out,'...(readPublisherResult?{publisherResult:await readPublisherResult(c,{pack,lease,actorKey,ownerKey})}:{})','...(readPublisherResult?{publisherResult:await readPublisherResult(c,{pack,lease,actorKey,ownerKey})}:{}),...(editorialPlacement?{editorialPlacement}:{})');
 return '// EDITORIAL_PLACEMENT_MANIFEST_V1\n'+out;
}

export function patchEditorialPlacementRuntimeSource(source) {
 let out=replace(source,"import {createRecoveredCreationGate} from './recovered-creation-gate.mjs';","import {createRecoveredCreationGate} from './recovered-creation-gate.mjs';\nimport {prepareEditorialPlacementServices} from './editorial-placement-integration.mjs';\nimport {readPlacementForManifest} from './editorial-placement-store.mjs';");
 out=replace(out,' const literalPayloads=createLiteralPayloadStore({pool,verifyRelease:verifyLiteralRelease});',' const literalPayloads=createLiteralPayloadStore({pool,verifyRelease:verifyLiteralRelease});\n const placement=await prepareEditorialPlacementServices({pool});');
 out=replace(out,' const wiring=createRecoveryWiring({pool,secret,events,reviews,adminUserIds,',' const wiring=createRecoveryWiring({pool,secret,events,reviews,adminUserIds,\n  readEditorialPlacement:readPlacementForManifest,verifyEditorialPlacement:placement.verifyUpdate,');
 out=replace(out,'return Object.freeze({...wiring,creationWriteAllowed:','return Object.freeze({...wiring,telegramPlacement:placement,creationWriteAllowed:');
 return out;
}

export function patchEditorialPlacementWiringSource(source) {
 let out=replace(source,'readFinalPayloads=null,','readFinalPayloads=null,readEditorialPlacement=null,verifyEditorialPlacement=null,');
 out=replace(out,' let wordpress=null;'," if((readEditorialPlacement!==null&&typeof readEditorialPlacement!=='function')||(verifyEditorialPlacement!==null&&typeof verifyEditorialPlacement!=='function'))throw Error('PLACEMENT_CONFIGURATION_INVALID');\n let wordpress=null;");
 out=replace(out,'readPublisherResult:readPublisherSubmissionResultInTransaction','readPublisherResult:readPublisherSubmissionResultInTransaction,readEditorialPlacement');
 out=replace(out,'claimStore:telegramUpdateClaims,wordpress});','claimStore:telegramUpdateClaims,wordpress,...(verifyEditorialPlacement===null?{}:{verifyEditorialPlacement})});');
 return out;
}

export function patchEditorialPlacementStartupSource(source) {
 return replace(source,' telegramSelections:{select:async(...args)=>(await requireRecovery()).telegramSelections.select(...args)},',' telegramSelections:{select:async(...args)=>(await requireRecovery()).telegramSelections.select(...args)},\n telegramPlacement:Object.fromEntries([\'select\',\'prove\'].map(method=>[method,async(...args)=>(await requireRecovery()).telegramPlacement[method](...args)])),');
}
