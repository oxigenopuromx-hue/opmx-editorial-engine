// Offline candidate: preserve the existing encoding and outcome protocol. Apply
// only to a freshly read prompt and compare all other automation settings.
export function patchMotorFeaturedBlockers(prompt,commit){
 if(typeof prompt!=='string'||!/^[a-f0-9]{40}$/.test(commit))throw Error('FEATURED_MOTOR_PATCH_INVALID');
 const lines=prompt.split('\n'),enc=lines.map((x,i)=>x.startsWith('Para comunicar el bloqueo usa la MISMA herramienta informar_revision_telegram_opmx,')?i:-1).filter(i=>i>=0),last=lines.map((x,i)=>x==='46 PUBLISHER_PERMISSION_DENIED_LIBERAL'?i:-1).filter(i=>i>=0),reject=lines.map((x,i)=>x.startsWith('PUBLISHER_REJECTED_BEFORE_WRITE requiere una respuesta explícita')?i:-1).filter(i=>i>=0);
 if(enc.length!==1||last.length!==1||reject.length!==1||lines.some(x=>x.startsWith('47 MASTER_FEATURED_')))throw Error('FEATURED_MOTOR_PROMPT_CHANGED');
 lines[enc[0]]='Para avisar usa informar_revision_telegram_opmx con sus tres argumentos: outcome=SOURCES_VERIFIED es transporte, no afirmación editorial; package_id es el original. Calcula revision codificada con JavaScript/Python: 1099511627776 + revision_real*16384 + itemOrdinal*256 + codeId. Exige entero seguro, revision_real READY exacta, positiva y UInt32, e ID de la tabla. Nunca uses ese número para reclamar, confirmar o finalizar; el servidor muestra la revisión real.';
 lines[reject[0]]='PUBLISHER_REJECTED_BEFORE_WRITE exige respuesta explícita writesStarted=false, no HTTP400 aislado. Ante respuesta perdida o resultado parcial conserva solicitud e IDs y usa diagnóstico incierto/parcial; no afirmes no publicación por la etapa del error ni uses /nuevo o cambies request_id para eludir conciliación.';
 lines[last[0]]+=`\n47–52: ante VALIDATION_FAILED con code REQUIRED_FIELDS y writesStarted=false aplica featuredDiagnosticFromPreflight de tools/editorial/featured-blocker-diagnostic.mjs@${commit}; usa su ID de featuredBlockerEntries. Si no devuelve código conserva el diagnóstico existente. No supongas campos.`;
 const out=lines.join('\n');if(out.length>65536)throw Error('FEATURED_MOTOR_PROMPT_TOO_LONG');return out;
}
