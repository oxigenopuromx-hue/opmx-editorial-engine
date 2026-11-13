import {createHash} from 'node:crypto';
import {placementInventorySource} from '../../../editorial/placement-inventory.mjs';
const marker='EDITORIAL_PLACEMENT_INVENTORY_V1';
export function buildPlacementInventoryOperations(graph,expected){
 if(graph?.id!=='bnzVMNkZuGO1GQCZ'||graph.versionId!==expected?.versionId||!Array.isArray(graph.nodes))throw Error('PLACEMENT_INVENTORY_REBASE_REQUIRED');
 const nodes=graph.nodes.filter(n=>n.name==='Formatear fuente privada MCP');if(nodes.length!==1)throw Error('PLACEMENT_INVENTORY_NODE_CHANGED');const node=nodes[0],old=node.parameters?.jsCode;
 if(node.type!=='n8n-nodes-base.code'||typeof old!=='string'||old.includes(marker)||expected.nodeHashes?.[node.name]!==createHash('sha256').update(JSON.stringify(node.parameters)).digest('hex'))throw Error('PLACEMENT_INVENTORY_REBASE_REQUIRED');
 const needle="  return respond({status:'PACKAGE_FOUND',package_id:result.packageId,state:result.state,revision:result.revision,items,";
 if(old.split(needle).length!==2)throw Error('PLACEMENT_INVENTORY_FORMATTER_CHANGED');
 const insert="  let editorial_placement;if(Object.hasOwn(result,'editorialPlacement')){try{editorial_placement=normalizePlacementInventory(result.editorialPlacement,result.revision,result.state)}catch{return respond({status:'SOURCE_NOT_CONFIRMED'},true)}}\n";
 const code='// '+marker+'\n'+placementInventorySource()+'\n'+old.replace(needle,insert+needle+'...(editorial_placement?{editorial_placement}:{}),');
 return [{type:'updateNodeParameters',nodeName:node.name,parameters:{...node.parameters,jsCode:code},replace:true}];
}
