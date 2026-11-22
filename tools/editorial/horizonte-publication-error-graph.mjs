// Keep the already wired uncertain-result branch reachable if the post-write
// Horizon evaluator throws; never retry a possibly completed publication.
export function patchHorizontePublicationError(input){
 if(!Array.isArray(input?.nodes)||!input.connections)throw Error('HORIZONTE_ERROR_GRAPH_INVALID');
 const g=structuredClone(input),rows=g.nodes.filter(n=>n.name==='Publicación — Evaluar HORIZONTE');
 const lanes=g.connections['Publicación — Evaluar HORIZONTE']?.main;
 if(rows.length!==1||rows[0].onError!==undefined||lanes?.[0]?.[0]?.node!=='Conservar publicación HORIZONTE'||lanes?.[1]?.[0]?.node!=='Publicación resultado incierto')throw Error('HORIZONTE_ERROR_GRAPH_CHANGED');
 rows[0].onError='continueErrorOutput';return g;
}
