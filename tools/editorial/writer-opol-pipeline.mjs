import {patchWriterNormalizerIds} from './writer-normalizer-id-patch.mjs';
import {patchWriterOpolLiveProof} from './writer-opol-live-proof-patch.mjs';
import {patchWriterOpolGraph} from './writer-opol-live-graph.mjs';
import {patchWriterResolverId} from './writer-resolver-id-patch.mjs';
import {patchOpolSecondary} from './writer-opol-secondary-patch.mjs';

// Produces a candidate clone only. No mutation or publication occurs here.
export function patchWriterOpolPipeline(input,{proofCode,credential}={}) {
 const node=name=>{const rows=input?.nodes?.filter(n=>n.name===name)??[];if(rows.length!==1)throw Error('OPOL_PIPELINE_GRAPH_CHANGED');return rows[0]};
 const normalizer=patchWriterOpolLiveProof(patchWriterNormalizerIds(node('Validar y normalizar OPMX MASTER').parameters.jsCode));
 const resolver=patchWriterResolverId(node('OPOL — Resolver categoría').parameters.jsCode,'OPOL');
 const secondary=patchOpolSecondary(node('OPOL — Completar borrador Gutenberg').parameters.jsonBody,node('OPOL — Validar antes de publicar').parameters.jsCode);
 const out=patchWriterOpolGraph(input,{normalizerCode:normalizer,proofCode,credential});
 out.nodes.find(n=>n.name==='OPOL — Resolver categoría').parameters.jsCode=resolver;
 out.nodes.find(n=>n.name==='OPOL — Completar borrador Gutenberg').parameters.jsonBody=secondary.writeExpression;
 out.nodes.find(n=>n.name==='OPOL — Validar antes de publicar').parameters.jsCode=secondary.readbackCode;
 return out;
}
