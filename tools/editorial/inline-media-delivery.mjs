import {createHash} from 'node:crypto';
import {readInlinePlan,decodeInlineBundle,assertInlineImageHash,imageSignature} from './inline-media.mjs';

// Called by Motor after source integrity and editorial image selection. The
// resulting JSON is transported through the existing native MASTER file input;
// the server verifies signatures, byte counts and SHA-256 before any write.
export function prepareInlineMediaMaster(master,images){
  if(!master||typeof master!=='object'||Array.isArray(master)||!Array.isArray(images))throw Error('INLINE_DELIVERY_INVALID');
  if(!images.length)return JSON.parse(JSON.stringify(master));
  if(master.IMAGENES?.INTERIORES!==undefined||master.MEDIA_ARCHIVOS!==undefined)throw Error('INLINE_DELIVERY_ALREADY_DECLARED');
  const result=JSON.parse(JSON.stringify(master));
  result.IMAGENES={...(result.IMAGENES??{}),INTERIORES:images.map(image=>{
    if(!image||!Buffer.isBuffer(image.bytes)||!image.bytes.length)throw Error('INLINE_DELIVERY_BYTES_INVALID');
    return {ID:image.id,ITEM_ID:image.itemId??null,SHA256:createHash('sha256').update(image.bytes).digest('hex'),
      BYTES:image.bytes.length,MIME:imageSignature(image.bytes),DESPUES_PARRAFO:image.afterParagraph,
      ALT:image.alt,LEYENDA:image.caption??'',CREDITO:image.credit??''};
  })};
  result.MEDIA_ARCHIVOS={schema:'opmx.inline-images.v1',images:images.map(image=>({id:image.id,base64:image.bytes.toString('base64')}))};
  const plan=readInlinePlan(result);const assets=decodeInlineBundle(result.MEDIA_ARCHIVOS,plan);
  for(const asset of assets)assertInlineImageHash(asset,createHash('sha256').update(asset.buffer).digest('hex'));
  return result;
}
