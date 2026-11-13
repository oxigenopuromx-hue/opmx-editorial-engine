import {createHash} from 'node:crypto';
import {placementCommandSource} from './placement-command.mjs';
const marker='TELEGRAM_PLACEMENT_CONTROL_V1';
export const placementReceiverNames=Object.freeze(['Normalizar entrada Telegram','Preparar paquete Telegram','Resolver paquete Telegram','Confirmar operación de paquete Telegram']);
const hash=s=>createHash('sha256').update(s).digest('hex');
const one=(graph,name)=>{const nodes=graph?.nodes?.filter(n=>n.name===name);if(nodes?.length!==1||nodes[0].type!=='n8n-nodes-base.code'||typeof nodes[0].parameters?.jsCode!=='string')throw Error('PLACEMENT_RECEIVER_NODE_CHANGED:'+name);return nodes[0]};
const replace=(source,from,to)=>{if(source.split(from).length!==2)throw Error('PLACEMENT_RECEIVER_ANCHOR_CHANGED');return source.replace(from,to)};
export function placementReceiverBase(graph) {
 if(graph?.id!=='OSi8AcnzLlI0csRu'||typeof graph.versionId!=='string')throw Error('PLACEMENT_RECEIVER_GRAPH_INVALID');
 return {versionId:graph.versionId,hashes:Object.fromEntries(placementReceiverNames.map(name=>[name,hash(JSON.stringify(one(graph,name).parameters))]))};
}
export function patchPlacementReceiverSources(sources) {
 if(Object.values(sources).some(s=>typeof s!=='string'||s.includes(marker)))throw Error('PLACEMENT_RECEIVER_ALREADY_INSTALLED');
 const prefix='// '+marker+'\n'+placementCommandSource()+'\n';
 const normal=replace(sources.normalize,' const contentControl=',' const placementControl=normalizePlacementControl(update);if(placementControl)return {...identity,...placementControl};\n const contentControl=');
 const prepare=replace(sources.prepare," const cmd=x.kind==='TEXT'?x.text.trim():'';"," const cmd=x.kind==='TEXT'?x.text.trim():'';\n if(placementCommandText(x.text)){const placement=preparePlacementControl(x);return placement??response(x,'No pude acreditar una orden directa de colocación. Escríbela como mensaje nuevo y separado.');}");
 const branch=" if(x.package_operation==='PLACEMENT'){\n  let selected;try{selected=parsePlacementCommand(x.text)}catch{return response(intent,'No pude confirmar la orden de colocación.');}\n  if(x.kind!=='COMMAND'||x.placement_attested!==true||x.mode_attested!==true||!Number.isSafeInteger(result.revision)||result.revision<1||JSON.stringify(x.placement_ids)!==JSON.stringify(selected.ids)||x.placement_target!=='OPURO')return response(intent,'No pude acreditar una orden directa de colocación.');\n  action='placement/select';Object.assign(body,{revision:result.revision,receiptId:x.receipt_id,ids:selected.ids});\n }\n else if(x.package_operation==='SELECT'){";
 let resolve=replace(sources.resolve," if(x.package_operation==='SELECT'){",branch);
 resolve=replace(resolve,' const paths={'," const paths={'placement/select':'placement/select',");
 const confirmBranch=" if(context.package_operation==='PLACEMENT'){\n  let selected;try{selected=parsePlacementCommand(context.text)}catch{return response(context,'No pude confirmar la colocación.');}\n  const replay=result?.status==='PLACEMENT_REPLAY',revisionOk=Number.isSafeInteger(result?.revision)&&result.revision>=1&&(replay?result.revision<=context.package_revision:result.revision===context.package_revision+1);\n  const valid=context.placement_attested===true&&context.placement_target==='OPURO'&&Number.isSafeInteger(context.package_revision)&&context.package_revision>=1&&JSON.stringify(context.placement_ids)===JSON.stringify(selected.ids)&&['PLACEMENT_SELECTED','PLACEMENT_REPLAY'].includes(result?.status)&&result.packageId===context.packageId&&revisionOk&&result.target==='OPURO'&&JSON.stringify(result.ids)===JSON.stringify(selected.ids);\n  if(!valid)return response(context,'No pude confirmar la colocación. Consulta /estado antes de volver a intentarlo.');\n  const detail=selected.ids===null?'conservar la colocación actual, sin modificar sus exclusiones':selected.ids.length?'excluir de las posiciones principales de las categorías '+selected.ids.join(', '):'ninguna categoría excluida';\n  return response(context,(replay?'Esta colocación ya estaba registrada para OPURO: ':'Colocación registrada para OPURO: ')+detail+'. La nota conserva su listado y URL; esta orden no publica. Continúa con tus materiales o /listo.',{package_revision:replay?context.package_revision:result.revision});\n }\n if(context.package_operation==='SELECT'){";
 const confirm=replace(sources.confirm," if(context.package_operation==='SELECT'){",confirmBranch);
 return {normalize:prefix+normal,prepare:prefix+prepare,resolve:prefix+resolve,confirm:prefix+confirm};
}
export function buildPlacementReceiverOperations(graph,expected) {
 const actual=placementReceiverBase(graph);
 if(!expected||actual.versionId!==expected.versionId||placementReceiverNames.some(name=>actual.hashes[name]!==expected.hashes?.[name]))throw Error('PLACEMENT_RECEIVER_REBASE_REQUIRED');
 const nodes=placementReceiverNames.map(name=>one(graph,name));
 const sources=patchPlacementReceiverSources(Object.fromEntries(['normalize','prepare','resolve','confirm'].map((key,i)=>[key,nodes[i].parameters.jsCode])));
 return Object.entries(sources).map(([key,jsCode],i)=>({type:'updateNodeParameters',nodeName:nodes[i].name,parameters:{...nodes[i].parameters,jsCode},replace:true}));
}
