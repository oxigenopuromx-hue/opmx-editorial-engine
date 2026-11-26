// Issue #62: immutable image manifests and destination-local Gutenberg images.
// This module grants no write permission. SHA-256 is checked by the caller's
// binary hash step before this manifest can reach a writer.
export const INLINE_MEDIA_LIMITS=Object.freeze({count:16,fileBytes:10*1024*1024,totalBytes:25*1024*1024});
const imageId=/^img(?:0[1-9]|1[0-6])$/;
const digest=/^[a-f0-9]{64}$/;
const mimeTypes=new Set(['image/jpeg','image/png','image/webp']);
const unsafe=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const validText=(v,max)=>typeof v==='string'&&v.length<=max&&!unsafe.test(v)&&!/<\/?[A-Za-z!]/.test(v);
const escape=v=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const fail=code=>{throw Error(code)};

// Some WordPress roles store esc_html-equivalent attachment captions. Compare
// one encoding layer only; this never removes HTML or changes editorial text.
export function inlineMetadataMatches(actual,expected){
  if(typeof actual!=='string'||typeof expected!=='string')return false;
  if(actual===expected)return true;
  const named={amp:'&',AMP:'&',lt:'<',LT:'<',gt:'>',GT:'>',quot:'"',QUOT:'"',apos:"'",nbsp:'\u00a0'};
  return actual.replace(/&(#(?:[0-9]+|x[a-f0-9]+)|amp|AMP|lt|LT|gt|GT|quot|QUOT|apos|nbsp);/gi,(token,key)=>{
    if(Object.hasOwn(named,key))return named[key];
    const point=/^#x/i.test(key)?parseInt(key.slice(2),16):Number(key.slice(1));
    return Number.isSafeInteger(point)&&point>0&&point<=0x10ffff&&!(point>=0xd800&&point<=0xdfff)?String.fromCodePoint(point):token;
  })===expected;
}

export function inlineMediaRole(id){if(!imageId.test(id??''))fail('INLINE_IMAGE_ID_INVALID');return 'interior_'+id.slice(3);}

export function readInlinePlan(master){
  const input=master?.IMAGENES?.INTERIORES;
  if(input===undefined)return [];
  if(!Array.isArray(input)||!input.length||input.length>INLINE_MEDIA_LIMITS.count)fail('INLINE_IMAGE_COUNT_INVALID');
  const seen=new Set();let bytes=0;
  const allowed=['ID','ITEM_ID','SHA256','BYTES','MIME','DESPUES_PARRAFO','ALT','LEYENDA','CREDITO'];
  const result=input.map(row=>{
    if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!allowed.includes(k)))fail('INLINE_IMAGE_MANIFEST_INVALID');
    if(!imageId.test(row.ID??'')||seen.has(row.ID))fail('INLINE_IMAGE_ID_INVALID');seen.add(row.ID);
    if(row.ITEM_ID!==undefined&&row.ITEM_ID!==null&&!/^ti_[a-f0-9]{40}$/.test(row.ITEM_ID))fail('INLINE_IMAGE_SOURCE_INVALID');
    if(!digest.test(row.SHA256??'')||!Number.isSafeInteger(row.BYTES)||row.BYTES<1||row.BYTES>INLINE_MEDIA_LIMITS.fileBytes||!mimeTypes.has(row.MIME))fail('INLINE_IMAGE_FILE_INVALID');
    bytes+=row.BYTES;if(bytes>INLINE_MEDIA_LIMITS.totalBytes)fail('INLINE_IMAGE_TOTAL_TOO_LARGE');
    if(!Number.isSafeInteger(row.DESPUES_PARRAFO)||row.DESPUES_PARRAFO<0||row.DESPUES_PARRAFO>10000)fail('INLINE_IMAGE_POSITION_INVALID');
    if(!validText(row.ALT,1000)||!row.ALT.trim()||!validText(row.LEYENDA??'',1000)||!validText(row.CREDITO??'',500))fail('INLINE_IMAGE_METADATA_INVALID');
    return {ID:row.ID,ITEM_ID:row.ITEM_ID??null,SHA256:row.SHA256,BYTES:row.BYTES,MIME:row.MIME,
      DESPUES_PARRAFO:row.DESPUES_PARRAFO,ALT:row.ALT,LEYENDA:row.LEYENDA??'',CREDITO:row.CREDITO??''};
  });
  for(const key of ['GUTENBERG_FINAL','GUTENBERG_ENRIQUECIDO_FINAL']){
    const boundaries=paragraphBoundaries(master[key]);
    if(result.some(row=>row.DESPUES_PARRAFO>boundaries.length))fail('INLINE_IMAGE_POSITION_OUT_OF_RANGE:'+key);
  }
  return result;
}

export function imageSignature(buffer){
  if(!buffer||buffer.length<12)fail('INLINE_IMAGE_SIGNATURE_INVALID');
  if(buffer[0]===255&&buffer[1]===216&&buffer[2]===255)return 'image/jpeg';
  const png=[137,80,78,71,13,10,26,10];
  if(png.every((n,i)=>buffer[i]===n))return 'image/png';
  if(String.fromCharCode(...buffer.subarray(0,4))==='RIFF'&&String.fromCharCode(...buffer.subarray(8,12))==='WEBP')return 'image/webp';
  fail('INLINE_IMAGE_SIGNATURE_INVALID');
}

export function decodeInlineBundle(bundle,plan){
  if(typeof bundle==='string'){try{bundle=JSON.parse(bundle)}catch{fail('INLINE_BUNDLE_JSON_INVALID')}}
  if(!bundle||typeof bundle!=='object'||Array.isArray(bundle)||Object.keys(bundle).sort().join(',')!=='images,schema'||bundle.schema!=='opmx.inline-images.v1'||!Array.isArray(bundle.images)||!Array.isArray(plan)||!plan.length||bundle.images.length!==plan.length)fail('INLINE_BUNDLE_INVALID');
  const seen=new Set();
  const assets=bundle.images.map(row=>{
    if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).sort().join(',')!=='base64,id'||!imageId.test(row.id??'')||seen.has(row.id))fail('INLINE_BUNDLE_ASSET_INVALID');
    seen.add(row.id);const declared=plan.find(x=>x.ID===row.id);
    if(!declared||typeof row.base64!=='string'||!row.base64.length||row.base64.length%4||row.base64.length>4*Math.ceil(INLINE_MEDIA_LIMITS.fileBytes/3)||/[^A-Za-z0-9+/=]/.test(row.base64))fail('INLINE_BUNDLE_ASSET_INVALID');
    const buffer=Buffer.from(row.base64,'base64');
    if(buffer.toString('base64')!==row.base64||buffer.length!==declared.BYTES||imageSignature(buffer)!==declared.MIME)fail('INLINE_BUNDLE_BYTES_INVALID');
    return {id:row.id,base64:row.base64,buffer,manifest:declared};
  });
  if(plan.some(row=>!seen.has(row.ID)))fail('INLINE_BUNDLE_MISSING_ASSET');
  return plan.map(row=>assets.find(asset=>asset.id===row.ID));
}

export function assertInlineImageHash(asset,hash){
  if(!asset?.manifest||!digest.test(hash??'')||hash!==asset.manifest.SHA256)fail('INLINE_IMAGE_SHA256_MISMATCH');
  return true;
}

// Count only top-level paragraphs. Inserting inside a list/quote would alter
// block structure and is not accepted as an ambiguous equivalent position.
export function paragraphBoundaries(gutenberg){
  if(typeof gutenberg!=='string'||!gutenberg.trim()||gutenberg.length>6*1024*1024)fail('INLINE_GUTENBERG_INVALID');
  const input=gutenberg.trim(),stack=[],boundaries=[];
  const tokens=/<!--\s*(\/?)wp:(?:core\/)?([a-z0-9-]+)(?:\s+(\{[\s\S]*?\}))?\s*(\/)?-->/g;
  let match;
  while((match=tokens.exec(input))){
    const [,closing,name,json,selfClosing]=match;
    if(name==='image'||name==='gallery'||name==='html'||name==='cover'||name==='media-text')fail('INLINE_EXISTING_MEDIA_REQUIRES_MAPPING');
    if(json){try{const attrs=JSON.parse(json);if(!attrs||typeof attrs!=='object'||Array.isArray(attrs))fail('INLINE_GUTENBERG_INVALID')}catch{fail('INLINE_GUTENBERG_INVALID')}}
    if(closing){
      if(json||selfClosing||stack.pop()!==name)fail('INLINE_GUTENBERG_INVALID');
      if(name==='paragraph'&&!stack.length)boundaries.push(tokens.lastIndex);
    }else if(!selfClosing)stack.push(name);
  }
  if(stack.length||!boundaries.length)fail('INLINE_GUTENBERG_INVALID');
  return boundaries;
}

const origins={OPURO:'https://cms.oxigenopuro.com.mx',OPOL:'https://cms.oxigenopolitico.com.mx',LIBERAL:'https://cms.elliberal.mx',HORIZONTE:'https://cms.horizontedecalifornia.mx'};
export function verifyInlineAttachment(row,attachment,destination){
  const origin=origins[destination];
  if(!origin||!attachment||!Number.isSafeInteger(attachment.id)||attachment.id<1||typeof attachment.url!=='string'||
    !attachment.url.startsWith(origin+'/wp-content/uploads/')||/[<>"'\s\\]/.test(attachment.url)||/%(?:2e|2f|5c|00)/i.test(attachment.url)||attachment.url.includes('..')||attachment.assetId!==row.ID)fail('INLINE_ATTACHMENT_UNCONFIRMED');
  return attachment;
}

export function inlineImageBlock(row,attachment,destination){
  verifyInlineAttachment(row,attachment,destination);
  const caption=[row.LEYENDA,row.CREDITO].filter(Boolean).join(' | ');
  const figure='<figure class="wp-block-image size-full"><img src="'+escape(attachment.url)+'" alt="'+escape(row.ALT)+'" class="wp-image-'+attachment.id+'" />'+
    (caption?'<figcaption class="wp-element-caption">'+escape(caption)+'</figcaption>':'')+'</figure>';
  return '<!-- wp:image '+JSON.stringify({id:attachment.id,sizeSlug:'full',linkDestination:'none'})+' -->\n'+figure+'\n<!-- /wp:image -->';
}

export function renderInlineMedia(gutenberg,plan,attachments,destination){
  if(!Array.isArray(plan)||!Array.isArray(attachments)||plan.length!==attachments.length)fail('INLINE_ATTACHMENTS_INCOMPLETE');
  const original=gutenberg.trim();if(!plan.length)return original;
  const boundaries=paragraphBoundaries(original),seen=new Set(),insertions=new Map();
  for(const row of plan){
    if(row.DESPUES_PARRAFO>boundaries.length)fail('INLINE_IMAGE_POSITION_OUT_OF_RANGE');
    const found=attachments.filter(x=>x.assetId===row.ID);if(found.length!==1||seen.has(found[0].id))fail('INLINE_ATTACHMENTS_INCOMPLETE');seen.add(found[0].id);
    const offset=row.DESPUES_PARRAFO===0?0:boundaries[row.DESPUES_PARRAFO-1];
    const block=inlineImageBlock(row,found[0],destination);
    const existing=insertions.get(offset)??[];existing.push(block);insertions.set(offset,existing);
  }
  let output=original;
  for(const [offset,blocks] of [...insertions].sort((a,b)=>b[0]-a[0])){
    const rendered=blocks.join('\n\n');output=output.slice(0,offset)+(offset===0?rendered+'\n\n':'\n\n'+rendered)+output.slice(offset);
  }
  return output;
}

// Remove only the exact native blocks associated with this request and CMS,
// then re-render to prove their positions and the surrounding original bytes.
// Unknown images, changed captions and duplicate blocks are never discarded.
export function stripVerifiedInlineMedia(gutenberg,plan,attachments,destination){
  let original=gutenberg.trim();
  for(const row of plan){
    const native=attachments.find(x=>x.assetId===row.ID);const block=inlineImageBlock(row,native,destination);
    const token=row.DESPUES_PARRAFO===0?block+'\n\n':'\n\n'+block;
    if(original.split(token).length!==2)fail('INLINE_READBACK_UNCONFIRMED');
    original=original.replace(token,'');
  }
  if(renderInlineMedia(original,plan,attachments,destination)!==gutenberg.trim())fail('INLINE_READBACK_UNCONFIRMED');
  return original;
}
