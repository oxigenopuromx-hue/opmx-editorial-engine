// Construct a candidate only from a freshly read automation prompt. The
// caller must compare the full current prompt and triggers before any update.
export function patchMotorLiveCategories(prompt,commit) {
 if(typeof prompt!=='string'||!/^([a-f0-9]{40})$/.test(commit))throw Error('MOTOR_CATEGORY_PATCH_INVALID');
 const lines=prompt.split('\n'),indices=[];for(let i=0;i<lines.length;i++)if(lines[i].startsWith('CATEGORÍAS: valida con validation_tools.editorial_category_preflight '))indices.push(i);
 if(indices.length!==1)throw Error('MOTOR_CATEGORY_PROMPT_CHANGED');
 lines[indices[0]]=`CATEGORÍAS: Consulta consultar_categorias_editoriales_opmx para cada site seleccionado y page=1..totalPages; sin catálogo completo bloquea. OPURO, OPOL y LIBERAL: elige PRINCIPAL y PRINCIPAL_ID de la misma fila; OPOL SECUNDARIA y SECUNDARIA_ID opcionales son hija de PRINCIPAL. SEO.CATEGORIA coincide con OPURO.PRINCIPAL. HORIZONTE: elige slug de editorialSlugs; PRINCIPAL igual a TEMA, REGION bcs/mexico/mundo, TIPO news/analysis/opinion, MUNICIPIO opcional sólo en bcs. Usa validateLiveEditorialDestinations de tools/editorial/live-editorial-preflight.mjs@${commit}: fetchPage devuelve la respuesta de la herramienta; para Horizonte fetchHorizonteCatalog devuelve {statusCode:200,body:catalog} y fetchHorizonteEditorialClassification {statusCode:200,body:editorialClassification}, ambos de la respuesta real de la herramienta. Si falla bloquea. No conectes WordPress desde el Motor.`;
 const result=lines.join('\n');if(result.length>65536)throw Error('MOTOR_CATEGORY_PROMPT_TOO_LONG');return result;
}
