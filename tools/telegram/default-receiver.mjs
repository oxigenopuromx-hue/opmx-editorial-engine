// Pure functions compiled into the existing n8n receiver's Code nodes.
export const DEFAULT_HELP = 'Para una nota: envía /nuevo, después texto, fotos y documentos, y termina con /listo. Las notas nuevas se PUBLICAN EN AMBOS destinos por defecto tras las validaciones. Sólo si deseas borradores escribe /borrador (o /borrador opuro, /borrador opol) como mensaje aparte antes de /listo. /publicar opuro y /publicar opol permiten elegir un solo destino. /imagen generar solicita una ilustración; no omite las validaciones.';

export function openingNotice(result, messageId) {
  const newPolicy = ['OPEN','OPEN_REPLAY'].includes(result.status) && result.state !== 'READY';
  return {
    newPolicy,
    reply: result.state==='READY'
      ? 'Este comando corresponde a un paquete cerrado; no se ha cambiado su modo. Envía /nuevo para otra nota.'
      : newPolicy
        ? `Paquete abierto: <code>${result.packageId}</code>. Por defecto se PUBLICARÁ EN AMBOS destinos al enviar /listo, si supera las validaciones. Para dejar borradores escribe /borrador antes de /listo. Envía ahora texto, fotos y documentos.`
        : `Paquete ya abierto: <code>${result.packageId}</code>. Conserva su modo anterior. Para publicar usa /publicar ambos; para borradores /borrador. Termina con /listo.`,
  };
}

export function prepareOpeningRecord(context, sent, encode) {
  const message = sent?.result ?? sent;
  if (!context?.default_policy_candidate || context.package_operation !== 'OPEN' || context.package_state !== 'OPEN') return null;
  if (sent?.ok===false || String(message?.chat?.id)!==context.chat_id || !Number.isSafeInteger(message?.message_id) || message.message_id<=context.message_id) throw Error('OPENING_NOTICE_NOT_CONFIRMED');
  return {
    owner:context.user_id,chat:context.chat_id,packageId:context.packageId,
    receiptId:context.receipt_id,kind:'TEXT',
    text:encode('/nuevo',context.packageId,context.message_id,message.message_id),attachment:null,
  };
}

export function prepareSeal(context, reserved) {
  if (!context.seal_after_close) return { seal_requested:false, passthrough:reserved };
  const validItem=id=>typeof id==='string'&&/^ti_[a-f0-9]{40}$/.test(id);
  const stored = reserved?.status==='STORED' && reserved.packageId===context.packageId && validItem(reserved.itemId);
  const replay = reserved?.status==='RESERVATION_REPLAY' && reserved.state==='STORED' && validItem(reserved.itemId);
  if (!stored && !replay) return { seal_requested:false,passthrough:{status:'CLOSE_NOT_CONFIRMED'} };
  return { seal_requested:true, seal_body:{owner:context.user_id,chat:context.chat_id,packageId:context.packageId} };
}
