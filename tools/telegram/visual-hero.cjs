'use strict';
const sharp = require('sharp');

// Recorte derivado: el archivo original permanece intacto. El foco usa
// coordenadas normalizadas del original ya orientado; no inventa contenido.
async function cropFeatured(input, {x=0.5,y=0.5}={}) {
 if(!Buffer.isBuffer(input)||!input.length||input.length>10*1024*1024)throw Error('IMAGE_INPUT_INVALID');
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)throw Error('IMAGE_FOCUS_INVALID');
 const source=sharp(input,{limitInputPixels:40_000_000,failOn:'error'}),meta=await source.metadata();
 if(!['jpeg','png','webp'].includes(meta.format)||(meta.pages??1)!==1)throw Error('IMAGE_FORMAT_UNSUPPORTED');
 const oriented=await source.rotate().flatten({background:'#ffffff'}).toColourspace('srgb').toBuffer({resolveWithObject:true});
 const {width,height}=oriented.info;
 if(!width||!height)throw Error('IMAGE_DIMENSIONS_INVALID');
 const targetRatio=1200/630,sourceRatio=width/height;
 const cropWidth=sourceRatio>targetRatio?Math.max(1,Math.floor(height*targetRatio)):width;
 const cropHeight=sourceRatio>targetRatio?height:Math.max(1,Math.floor(width/targetRatio));
 const left=Math.max(0,Math.min(width-cropWidth,Math.round(x*width-cropWidth/2)));
 const top=Math.max(0,Math.min(height-cropHeight,Math.round(y*height-cropHeight/2)));
 const result=await sharp(oriented.data).extract({left,top,width:cropWidth,height:cropHeight}).resize(1200,630,{fit:'fill'}).png().toBuffer({resolveWithObject:true});
 if(result.info.width!==1200||result.info.height!==630)throw Error('IMAGE_CROP_UNVERIFIED');
 return {bytes:result.data,width:1200,height:630,sourceWidth:width,sourceHeight:height,crop:{left,top,width:cropWidth,height:cropHeight},focus:{x,y}};
}
module.exports={cropFeatured};
