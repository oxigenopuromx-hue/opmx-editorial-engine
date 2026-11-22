export function patchMotorFeaturedPolicy(prompt,commit){
 if(typeof prompt!=='string'||!/^[a-f0-9]{40}$/.test(commit))throw Error('FEATURED_POLICY_PROMPT_INVALID');
 const lines=prompt.split('\n'),indices=lines.map((line,i)=>line.startsWith('DESTACADA LITERAL (#43):')?i:-1).filter(i=>i>=0);
 if(indices.length!==1)throw Error('FEATURED_POLICY_PROMPT_CHANGED');
 lines[indices[0]]=`DESTACADA: Para CREATE EDITORIAL o LITERAL carga prepareFeaturedForPolicy de tools/editorial/featured-policy.mjs@${commit}. Usa policy verificada por chooseMotorPolicy y featuredAlt descrito de la imagen acreditada. Aplícalo al MASTER antes de validar; en LITERAL aplícalo a baseMaster antes de buildLiteralDelivery. Completa metadatos OPOL sólo si está autorizado; conserva originales, texto, crédito y modalidad. Si falta descripción verificable bloquea.`;
 const out=lines.join('\n');if(out.length>65536)throw Error('FEATURED_POLICY_PROMPT_TOO_LONG');return out;
}
