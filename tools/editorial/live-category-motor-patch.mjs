// Construct a candidate only from a freshly read automation prompt. The
// caller must compare the full current prompt and triggers before any update.
export function patchMotorLiveCategories(prompt,commit) {
 if(typeof prompt!=='string'||!/^([a-f0-9]{40})$/.test(commit))throw Error('MOTOR_CATEGORY_PATCH_INVALID');
 const lines=prompt.split('\n'),indices=[];for(let i=0;i<lines.length;i++)if(lines[i].startsWith('CATEGORÍAS: valida con validation_tools.editorial_category_preflight '))indices.push(i);
 if(indices.length!==1)throw Error('MOTOR_CATEGORY_PROMPT_CHANGED');
 lines[indices[0]]=`CATEGORÍAS: Por cada OPURO, OPOL o LIBERAL seleccionado consulta consultar_categorias_editoriales_opmx con site y page=1..totalPages; sin catálogo completo bloquea. El catálogo vivo prevalece sobre snapshots. Elige de ese medio y escribe CATEGORIAS.<medio>.PRINCIPAL y PRINCIPAL_ID con nombre e ID de la misma fila. OPOL SECUNDARIA y SECUNDARIA_ID son opcionales, hija de PRINCIPAL. SEO.CATEGORIA coincide con OPURO.PRINCIPAL. Usa validateLiveEditorialDestinations de tools/editorial/live-editorial-preflight.mjs@${commit}, con respuestas de la herramienta en fetchPage; si falla bloquea. HORIZONTE: PRINCIPAL igual a TEMA (politica, economia, sociedad-y-derechos, horizonte-verde o cultura-e-identidad), nunca sin-categoria; REGION bcs/mexico/mundo, TIPO news/analysis/opinion y MUNICIPIO opcional sólo en bcs (la-paz, los-cabos, comondu, loreto o mulege). Publisher verifica su catálogo. No conectes WordPress desde el Motor.`;
 const result=lines.join('\n');if(result.length>65536)throw Error('MOTOR_CATEGORY_PROMPT_TOO_LONG');return result;
}
