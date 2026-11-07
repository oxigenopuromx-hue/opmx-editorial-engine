function prepareSeal(context, reserved) {
  if (!context.seal_after_close) return { seal_requested:false, passthrough:reserved };
  const validItem=id=>typeof id==='string'&&/^ti_[a-f0-9]{40}$/.test(id);
  const stored = reserved?.status==='STORED' && reserved.packageId===context.packageId && validItem(reserved.itemId);
  const replay = reserved?.status==='RESERVATION_REPLAY' && reserved.state==='STORED' && validItem(reserved.itemId);
  if (!stored && !replay) return { seal_requested:false,passthrough:{status:'CLOSE_NOT_CONFIRMED'} };
  return { seal_requested:true, seal_body:{owner:context.user_id,chat:context.chat_id,packageId:context.packageId,receiptId:context.receipt_id} };
}
return [{json:prepareSeal($('Resolver paquete Telegram').first(0,0).json,$input.first().json)}];
