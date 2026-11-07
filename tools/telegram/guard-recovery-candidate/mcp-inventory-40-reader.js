function formatTelegramReaderResult(request,result) {
 const respond=(data,isError=false)=>({httpStatus:200,response:{jsonrpc:'2.0',id:request.id,result:{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError}}});
 if(result?.status!=='FOUND'||result.packageId!==request.body.packageId)return respond({status:'SOURCE_NOT_CONFIRMED',retryPermitted:false},true);
 if(request.action==='manifest') {
  if(!Array.isArray(result.items)||result.items.length>40||!Number.isSafeInteger(result.revision))return respond({status:'SOURCE_NOT_CONFIRMED'},true);
  const items=result.items.map(x=>({item_id:x.item_id,kind:x.kind,state:x.state,mime_type:x.attachment?.mime_type??'text/plain',file_name:x.attachment?.file_name??null,text_bytes:Buffer.byteLength(x.text_content??'','utf8'),original_bytes:x.kind==='FILE'?Number(x.content_bytes):0,sha256:x.sha256??null}));
  return respond({status:'PACKAGE_FOUND',package_id:result.packageId,state:result.state,revision:result.revision,items});
 }
 const valid=result.itemId===request.body.itemId&&result.stream===request.body.stream&&result.offset===request.body.offset&&Number.isSafeInteger(result.bytes)&&result.bytes>=0&&result.bytes<=request.body.length&&Number.isSafeInteger(result.totalBytes)&&result.totalBytes<=10485760&&result.totalBytes>=result.offset+result.bytes&&result.bytes===Math.min(request.body.length,result.totalBytes-result.offset)&&result.nextOffset===result.offset+result.bytes&&result.eof===(result.nextOffset===result.totalBytes)&&/^[a-f0-9]{64}$/.test(result.sha256??'')&&/^[a-f0-9]{64}$/.test(result.chunkSha256??'')&&typeof result.contentBase64==='string'&&result.contentBase64.length<=4*Math.ceil(65536/3);
 if(!valid)return respond({status:'SOURCE_NOT_CONFIRMED'},true);
 const bytes=Buffer.from(result.contentBase64,'base64');if(bytes.length!==result.bytes||bytes.toString('base64')!==result.contentBase64)return respond({status:'SOURCE_NOT_CONFIRMED'},true);
 return respond({status:'SOURCE_CHUNK',package_id:result.packageId,item_id:result.itemId,stream:result.stream,mime_type:result.mime_type,total_bytes:result.totalBytes,offset:result.offset,bytes:result.bytes,sha256:result.sha256,chunk_sha256:result.chunkSha256,content_base64:result.contentBase64,next_offset:result.nextOffset,eof:result.eof});
}
return [{json:formatTelegramReaderResult($('Protocolo MCP archivos').first(0,0).json.request,$input.first().json)}];
