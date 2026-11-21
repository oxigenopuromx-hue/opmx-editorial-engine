// Candidate prompt transform for the existing single Motor. Not an automation
// update. Activate only after matching Guard/Publisher/receiver deployment and
// full integration tests. Rejects drift and avoids growing the saved prompt.
const oldPin='e7fae39e62d8b233c379198d24c516fe4b580071';
export const candidatePin='b7648ab68722358d01112c590ba730f1ea7e0e3a';
export function patchMotorPromptV3(prompt){
 if(typeof prompt!=='string'||prompt.length>65536)throw Error('MOTOR_PROMPT_INVALID');let s=prompt;
 function once(a,b){if(s.split(a).length!==2)throw Error('MOTOR_PROMPT_CHANGED');s=s.replace(a,()=>b)}
 function line(prefix,replacement){const matches=s.split('\n').filter(x=>x.startsWith(prefix));if(matches.length!==1)throw Error('MOTOR_PROMPT_CHANGED');once(matches[0],replacement)}
 once('Fija chooseMotorPolicy y las herramientas de perfil LITERAL a '+oldPin,'Fija chooseMotorPolicy y las herramientas de perfil LITERAL a '+candidatePin);
 once('chooseMotorPolicy desde el commit fijo vigente '+oldPin,'chooseMotorPolicy desde el selector v3 fijado al commit '+candidatePin);
 once('motor-policy.mjs del repositorio oxigenopuromx-hue/opmx-editorial-engine, commit '+oldPin,'motor-policy-v3.mjs del repositorio oxigenopuromx-hue/opmx-editorial-engine, commit '+candidatePin);
 line('CATEGORÍAS POR DESTINO:',"CATEGORÍAS: valida con validation_tools.editorial_category_preflight los destinos OPURO, OPOL y LIBERAL seleccionados, con los nombres exactos de sus catálogos; no copies categorías ni uses SEO.CATEGORIA como respaldo para OPOL o LIBERAL. Si sólo se seleccionó HORIZONTE omite ese validador local. Para HORIZONTE agrega CATEGORIAS.HORIZONTE con PRINCIPAL='sin-categoria', REGION (bcs, mexico o mundo), TEMA (politica, economia, sociedad-y-derechos, horizonte-verde o cultura-e-identidad), TIPO (news, analysis u opinion) y MUNICIPIO opcional sólo en bcs (la-paz, los-cabos, comondu, loreto o mulege), según los hechos, sin inventar. Publisher verifica esos slugs contra el catálogo autenticado antes de aceptar archivos. Si falla una validación, bloquea.");
 line('Para publish-todos-v2,','DESTINOS: conserva el resultado canónico de chooseMotorPolicy para request_id y Publisher. En v3, AMBOS son OPURO y OPOL; ACTIVOS agrega LIBERAL; TODOS agrega HORIZONTE y es predeterminado. En v2 TODOS conserva los tres primeros; en v1 AMBOS conserva OPURO y OPOL. Nunca amplíes paquetes anteriores.');
 line('Carga y ejecuta validatePublisherSubmissionOutcome', 'Carga y ejecuta validatePublisherSubmissionOutcome de tools/telegram/guard-recovery-candidate/publisher-submission-policy-v3.mjs con todos sus imports al commit '+candidatePin+'. Usa el inventario auténtico y expected con packageId, revision, requestId, phase, destination, slug, submissionHash y, cuando el selector los devuelva, policy y destinations exactamente como fueron acreditados. submissionHash es el de SUBMITTED o null si se perdió. Exige validación del recibo SHA256 y todos sus destinos e IDs; nunca lo sustituyas por una interpretación.');
 line('Carga motor-policy.mjs y sus imports','Carga motor-policy-v3.mjs y todos sus imports del directorio tools/telegram/guard-recovery-candidate en el commit '+candidatePin+'. Para LITERAL usa tools/editorial/literal-delivery-v3.mjs y literal-text-v3.mjs del mismo commit. Ejecuta los módulos completos; si faltan o hay conflicto de perfil/manifest, bloquea.');
 once('DESTACADA LITERAL (#43): Antes de buildLiteralDelivery','DESTACADA LITERAL (#43): Para HORIZONTE incluye la clasificación de la sección CATEGORÍAS también en LITERAL. Antes de buildLiteralDelivery');
 once('Antes de cualquier escritura llama una sola vez validar_archivos_opmx.','Antes de cualquier escritura llama una sola vez validar_archivos_opmx con el request_id canónico del paquete.');
 once('Usa validar_archivos_opmx antes de escribir.','Calcula primero el request_id canónico indicado abajo y pásalo a validar_archivos_opmx antes de escribir.');
 if(s.length>65536||s.length>prompt.length)throw Error('MOTOR_PROMPT_TOO_LONG');return s;
}
