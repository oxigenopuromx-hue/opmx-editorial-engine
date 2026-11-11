function formatTelegramReaderResult(request,result) {
 const respond=(data,isError=false)=>({httpStatus:200,response:{jsonrpc:'2.0',id:request.id,result:{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError}}});
 if(result?.status!=='FOUND'||result.packageId!==request.body.packageId)return respond({status:'SOURCE_NOT_CONFIRMED',retryPermitted:false},true);
 if(request.action==='manifest') {
  if(!Array.isArray(result.items)||result.items.length>40||!Number.isSafeInteger(result.revision))return respond({status:'SOURCE_NOT_CONFIRMED'},true);
  const items=result.items.map(x=>({item_id:x.item_id,kind:x.kind,state:x.state,mime_type:x.attachment?.mime_type??'text/plain',file_name:x.attachment?.file_name??null,text_bytes:Buffer.byteLength(x.text_content??'','utf8'),original_bytes:x.kind==='FILE'?Number(x.content_bytes):0,sha256:x.sha256??null}));
  let recovered_policy;
  if(Object.hasOwn(result,'recoveredPolicy')) {
   const p=result.recoveredPolicy, ids=new Set(items.filter(i=>i.state==='STORED').map(i=>i.item_id));
   if(result.state!=='READY'||!p||typeof p!=='object'||Array.isArray(p)||p.authorized!==true||!['PUBLISH','DRAFT'].includes(p.mode)||typeof p.explicit!=='boolean'||!['DIRECT_MODE_COMMAND','ANNOUNCED_DEFAULT_AND_DIRECT_CLOSE'].includes(p.authorization)||
      (p.authorization==='DIRECT_MODE_COMMAND'&&p.explicit!==true)||(p.authorization==='ANNOUNCED_DEFAULT_AND_DIRECT_CLOSE'&&(p.explicit!==false||p.mode!=='PUBLISH'))||
      !['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'].includes(p.destination)||!Array.isArray(p.control_item_ids)||!p.control_item_ids.length||new Set(p.control_item_ids).size!==p.control_item_ids.length||p.control_item_ids.some(id=>!ids.has(id)))return respond({status:'SOURCE_NOT_CONFIRMED'},true);
   recovered_policy={mode:p.mode,authorized:true,explicit:p.explicit,authorization:p.authorization,destination:p.destination,control_item_ids:[...p.control_item_ids]};
  }
  let confirmed_correction;
  if(Object.hasOwn(result,'confirmedCorrection')) {
   const c=result.confirmedCorrection;
   if(!recovered_policy||!c||typeof c!=='object'||Array.isArray(c)||c.package_id!==result.packageId||c.revision!==result.revision||!['CREATE','UPDATE'].includes(c.action)||!['LITERAL','EDITORIAL'].includes(c.content_mode)||!['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'].includes(c.destination)||!/^[a-f0-9]{64}$/.test(c.preview_hash??''))return respond({status:'SOURCE_NOT_CONFIRMED'},true);
   confirmed_correction={package_id:c.package_id,revision:c.revision,action:c.action,content_mode:c.content_mode,destination:c.destination,preview_hash:c.preview_hash};
   if(c.action==='UPDATE'){
    const expected=c.destination==='TODOS'?['OPURO','OPOL','LIBERAL']:c.destination==='AMBOS'?['OPURO','OPOL']:c.destination.split(',');
    if(!Array.isArray(c.posts)||c.posts.length!==expected.length||c.posts.some((p,i)=>!p||p.destination!==expected[i]||!Number.isSafeInteger(p.post_id)||p.post_id<1))return respond({status:'SOURCE_NOT_CONFIRMED'},true);
    confirmed_correction.posts=c.posts.map(p=>({destination:p.destination,post_id:p.post_id}));
   }
  }
  return respond({status:'PACKAGE_FOUND',package_id:result.packageId,state:result.state,revision:result.revision,items,...(recovered_policy?{recovered_policy}:{}),...(confirmed_correction?{confirmed_correction}:{})});
 }
 const valid=result.itemId===request.body.itemId&&result.stream===request.body.stream&&result.offset===request.body.offset&&Number.isSafeInteger(result.bytes)&&result.bytes>=0&&result.bytes<=request.body.length&&Number.isSafeInteger(result.totalBytes)&&result.totalBytes<=10485760&&result.totalBytes>=result.offset+result.bytes&&result.bytes===Math.min(request.body.length,result.totalBytes-result.offset)&&result.nextOffset===result.offset+result.bytes&&result.eof===(result.nextOffset===result.totalBytes)&&/^[a-f0-9]{64}$/.test(result.sha256??'')&&/^[a-f0-9]{64}$/.test(result.chunkSha256??'')&&typeof result.contentBase64==='string'&&result.contentBase64.length<=4*Math.ceil(65536/3);
 if(!valid)return respond({status:'SOURCE_NOT_CONFIRMED'},true);
 const bytes=Buffer.from(result.contentBase64,'base64');if(bytes.length!==result.bytes||bytes.toString('base64')!==result.contentBase64)return respond({status:'SOURCE_NOT_CONFIRMED'},true);
 return respond({status:'SOURCE_CHUNK',package_id:result.packageId,item_id:result.itemId,stream:result.stream,mime_type:result.mime_type,total_bytes:result.totalBytes,offset:result.offset,bytes:result.bytes,sha256:result.sha256,chunk_sha256:result.chunkSha256,content_base64:result.contentBase64,next_offset:result.nextOffset,eof:result.eof});
}
return [{json:formatTelegramReaderResult($('Protocolo MCP archivos').first(0,0).json.request,$input.first().json)}];
