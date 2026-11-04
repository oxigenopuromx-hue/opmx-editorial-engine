// Prompt-only migration. Never persist the full prompt: it can contain private
// package-specific attribution. All unrelated editorial/media rules stay intact.
export function patchMotorDefault(prompt, commit) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw Error('COMMIT_INVALID');
  const changes = [
    ['tools/telegram/mode-choice.mjs del repositorio oxigenopuromx-hue/opmx-editorial-engine, commit 277ac645bb3b86ee4fba3add9a0ec36e7f869c13',
      `tools/telegram/default-publication-policy.mjs del repositorio oxigenopuromx-hue/opmx-editorial-engine, commit ${commit}`],
    ['guarda marcadas las órdenes directas independientes /publicar o /borrador con destino opcional ambos, opuro u opol y las solicitudes directas de imagen que reconoce el receptor.',
      'guarda marcadas y ligadas al paquete las órdenes directas independientes /publicar o /borrador con destino opcional ambos, opuro u opol, la apertura real /nuevo sólo tras confirmar el aviso PUBLICAR AMBOS con excepción /borrador, el cierre real /listo antes de sellar, y las solicitudes directas de imagen que reconoce el receptor. No inventa un comando /publicar.'],
    ['El módulo exige hash e integridad y acepta únicamente las órdenes marcadas; la última prevalece.',
      'El módulo exige hash e integridad y acepta únicamente los controles acreditados. La última elección de modo prevalece por message_id Telegram. El cierre debe ser el último elemento almacenado; ante carrera o política incompleta bloquea.'],
    ['Si devuelve PUBLISH y explicit=true, esa es la orden explícita del usuario de publicar este paquete concreto en su destination; DRAFT indica borrador; ausencia de elección implica DRAFT y AMBOS.',
      'Valida mode, destination, authorized, explicit, authorization y control_item_ids devueltos. Sólo autoriza PUBLISH cuando authorized=true y (explicit=true con authorization=DIRECT_MODE_COMMAND, o explicit=false con authorization=ANNOUNCED_DEFAULT_AND_DIRECT_CLOSE). Esta segunda vía ejecuta la preferencia de publicar por defecto aprobada por el usuario el 2026-11-04, ligada al aviso de apertura confirmado y al /listo directo de este paquete. DRAFT sólo se ejecuta con explicit=true, authorized=true y authorization=DIRECT_MODE_COMMAND por /borrador. LEGACY_PRESERVED es histórico: no promover ni iniciar nuevas escrituras para ese paquete, informar que requiere conciliación o una nota nueva. Excluye del análisis editorial todos los control_item_ids de apertura, cierre y modo. Una política incompleta o resultado desconocido bloquea, nunca se convierte silenciosamente en borrador.'],
    ['sólo la elección directa marcada y comprobada por chooseTelegramMode autoriza la operación.',
      'sólo la autorización ligada a este paquete, comprobada por chooseTelegramMode según esta política, autoriza la operación.'],
    ['Si el modo es DRAFT, llama exactamente una vez a preparar_borrador_opmx,',
      'Si el modo es DRAFT y el /borrador explícito cumple las condiciones de autorización anteriores, llama exactamente una vez a preparar_borrador_opmx,'],
    ['Si el modo es PUBLISH y explicit=true, llama exactamente una vez a publicar_nota_opmx',
      'Si el modo es PUBLISH y cumple las condiciones de autorización anteriores (orden directa o preferencia anunciada con cierre directo acreditado), llama exactamente una vez a publicar_nota_opmx'],
    ['No publiques salvo una orden directa de este paquete validada por chooseTelegramMode y mediante publicar_nota_opmx;',
      'No publiques salvo autorización de este paquete validada por chooseTelegramMode conforme a esta política y mediante publicar_nota_opmx;'],
  ];
  for(const [from,to] of changes) {
    if(!prompt.includes(from)||prompt.indexOf(from)!==prompt.lastIndexOf(from))throw Error('PROMPT_BASELINE_CHANGED: '+from.slice(0,65));
    prompt=prompt.replace(from,to);
  }
  return prompt;
}
