import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
// OFFLINE ONLY. Does not touch the live 91-node n8n workflow.
export const SOURCE='workflows/publisher/OPMX_ENTRADA_AUTOMATICA_DESTINOS_v2.json';
export const TARGET='workflows/publisher/OPMX_ENTRADA_AUTOMATICA_COLOCACION_CANDIDATO_NO_ACTIVAR.json';
const EDITOR='Validar y normalizar OPMX MASTER';
const CATEGORY='OPURO — Resolver categoría';
const NEXT='OPURO — Preparar etiquetas v1.13';
const PREFLIGHT='OPURO — Preflight de colocación (CANDIDATO)';
const CREATE='OPURO — Crear borrador Gutenberg enriquecido';
const READBACK='OPURO — Validar antes de publicar';
export function buildCandidate(input) {
  const w=structuredClone(input);
  if(w.nodes?.length!==91) throw Error('Live/reference version drift: reconcile first');
  const get=name=>{const n=w.nodes.find(n=>n.name===name);if(!n) throw Error('Missing node: '+name);return n;};
  if(w.nodes.some(n=>n.name===PREFLIGHT))throw Error('Already patched');
  const prepare=get('Preparar MASTER y binarios');
  const prepAnchor='request_id:data.request_id,source_images:';
  if(!prepare.parameters.jsCode.includes(prepAnchor))throw Error('Authenticated entry envelope drift');
  prepare.parameters.jsCode=prepare.parameters.jsCode.replace(prepAnchor,
    'request_id:data.request_id,editorial_placement:(data.EDITORIAL_PLACEMENT ?? null),source_images:');
  const editor=get(EDITOR);
  const anchor='const categoryOpol=str(OPOLCAT.PRINCIPAL??OPOLCAT.principal??SEO.CATEGORIA??SEO.category);';
  if(!editor.parameters.jsCode.includes(anchor))throw Error('Validator drift');
  const intake=[
    'const placementSpecified=Object.prototype.hasOwnProperty.call(OPUROCAT,"EXCLUIR_DE_PORTADA_IDS");',
    'const placementIntent=placementSpecified ? OPUROCAT.EXCLUIR_DE_PORTADA_IDS : undefined;',
    'const placementControl=envelope.editorial_placement;',
    'if(placementSpecified){',
    '  if(!placementControl || placementControl.mode!=="DIRECT_OPERATOR" || placementControl.target!=="OPURO" || placementControl.request_id!==envelope.request_id || placementControl.confirmed!==true) throw Error("COLOCACION_OPURO: autorización directa del operador ausente o incongruente.");',
    '  const valid=x=>typeof x==="string" && /^[1-9][0-9]*$/.test(x) && Number.isSafeInteger(Number(x));',
    '  if(!Array.isArray(placementIntent) || !placementIntent.every(valid) || new Set(placementIntent).size!==placementIntent.length) throw Error("COLOCACION_OPURO: IDs invalidos o duplicados.");',
    '  if(!Array.isArray(placementControl.excluded_category_ids) || JSON.stringify(placementControl.excluded_category_ids)!==JSON.stringify(placementIntent)) throw Error("COLOCACION_OPURO: instrucción de operador no coincide con MASTER.");',
    '} else if(placementControl){',
    '  throw Error("COLOCACION_OPURO: control directo sin campo editorial correspondiente.");',
    '}'
  ].join('\n');
  editor.parameters.jsCode=editor.parameters.jsCode.replace(anchor,anchor+'\n'+intake);
  const fieldAnchor='      categories:{opuro:';
  if(!editor.parameters.jsCode.includes(fieldAnchor))throw Error('Canonical drift');
  editor.parameters.jsCode=editor.parameters.jsCode.replace(fieldAnchor,'      ...(placementSpecified ? {category_placement_excluded_ids:[...placementIntent]} : {}),\n'+fieldAnchor);
  const code=[
    'const c=$( "Validar y normalizar OPMX MASTER" ).first().json.canonical;',
    'const requested=c.category_placement_excluded_ids;',
    'const resolved=$( "OPURO — Resolver categoría" ).first().json;',
    'const id=Number(resolved.category_id);',
    'if(!Number.isSafeInteger(id)||id<1)throw Error("CMS category unresolved");',
    'if(requested===undefined)return [{json:{category_id:id,placement_requested:false}}];',
    'if(!Array.isArray(requested))throw Error("Invalid placement intent");',
    'if(typeof this.helpers?.httpRequest!=="function")throw Error("n8n HTTP helper unavailable");',
    'const eligible=new Set(),seen=new Set();let current=id;',
    'for(let depth=0;current;depth++){',
    ' if(depth>=12||seen.has(current))throw Error("Invalid CMS category hierarchy");',
    ' seen.add(current);',
    ' const term=await this.helpers.httpRequest({method:"GET",url:"https://cms.oxigenopuro.com.mx/wp-json/wp/v2/categories/"+current,json:true,timeout:8000,followRedirect:false});',
    ' if(Number(term?.id)!==current||!Number.isSafeInteger(Number(term?.parent))||Number(term.parent)<0)throw Error("Unverified CMS category hierarchy");',
    ' eligible.add(String(current));current=Number(term.parent);',
    '}',
    'if(requested.some(id=>!eligible.has(id)))throw Error("Excluded category is not eligible");',
    'return [{json:{category_id:id,placement_requested:true,excluded_category_ids:[...requested],eligible_category_ids:[...eligible]}}];'
  ].join('\n');
  const category=get(CATEGORY);
  if(w.connections[CATEGORY]?.main?.[0]?.[0]?.node!==NEXT || w.connections[CATEGORY].main[0].length!==1)throw Error('Category graph drift');
  w.nodes.push({id:createHash('sha256').update(PREFLIGHT).digest('hex').slice(0,32),name:PREFLIGHT,type:'n8n-nodes-base.code',typeVersion:2,position:[(category.position?.[0]||0)+180,category.position?.[1]||0],parameters:{mode:'runOnceForAllItems',jsCode:code}});
  w.connections[CATEGORY].main[0]=[{node:PREFLIGHT,type:'main',index:0}];
  w.connections[PREFLIGHT]={main:[[{node:NEXT,type:'main',index:0}]]};
  const writer=get(CREATE);
  const target='    oxpuro_editorial: { subtitle:';
  if(!writer.parameters.jsonBody.includes(target)||writer.parameters.jsonBody.includes('oxpuro_excluded_category_ids'))throw Error('Writer drift');
  const extra='    ...($( "OPURO — Preflight de colocación (CANDIDATO)" ).first().json.placement_requested ? {oxpuro_excluded_category_ids:$( "OPURO — Preflight de colocación (CANDIDATO)" ).first().json.excluded_category_ids} : {}),\n';
  writer.parameters.jsonBody=writer.parameters.jsonBody.replace(target,extra+target);
  const readback=get(READBACK);
  const final='return {json:{validated:true,post_id:Number(p.id)}};';
  if(!readback.parameters.jsCode.includes(final))throw Error('Readback drift');
  const check=[
    'const placement=$( "OPURO — Preflight de colocación (CANDIDATO)" ).first().json;',
    'if(placement.placement_requested){',
    ' const actual=p?.meta?.oxpuro_excluded_category_ids,expected=placement.excluded_category_ids;',
    ' if(!Array.isArray(actual)||actual.length!==expected.length||actual.some(x=>typeof x!=="string")||new Set(actual).size!==actual.length||!expected.every(x=>actual.includes(x)))throw Error("COLOCACION_OPURO: readback mismatch");',
    '}'
  ].join('\n');
  readback.parameters.jsCode=readback.parameters.jsCode.replace(final,check+'\n'+final);
  w.name='OPMX — Publisher OPURO/OPOL categoría CANDIDATO NO ACTIVAR';
  // Import safety: every node remains inert until explicitly configured in staging.
  for(const n of w.nodes){ n.disabled=true; delete n.credentials; }
  w.active=false;
  delete w.id; delete w.versionId;delete w.activeVersionId;delete w.activeVersion;
  w.description='Export offline de prueba. NO activar; no reemplazar workflow productivo.';
  return w;
}
if(process.argv[1]?.endsWith('build-category-placement-candidate.mjs')){
  const w=buildCandidate(JSON.parse(readFileSync(SOURCE,'utf8')));
  if(process.argv.includes('--check'))process.stdout.write(JSON.stringify({nodeCount:w.nodes.length,active:w.active})+'\n');
  else {writeFileSync(TARGET,JSON.stringify(w,null,2)+'\n');process.stdout.write('Candidate exported: '+TARGET+'\n');}
}
