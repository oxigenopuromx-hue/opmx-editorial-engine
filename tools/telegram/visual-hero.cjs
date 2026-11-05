// The editorial agent visually chooses the focal point. Pixel operations below
// only crop and resize the supplied photograph; they do not generate imagery.
const sharp = require('sharp');

function cropRect(width, height, focusX, focusY) {
 if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
     !Number.isFinite(focusX) || focusX < 0 || focusX > 1 ||
     !Number.isFinite(focusY) || focusY < 0 || focusY > 1) throw Error('Punto focal o dimensiones inválidos');
 const ratio = 1200 / 630;
 let w = width, h = height;
 if (width / height > ratio) w = Math.max(1, Math.round(height * ratio));
 else h = Math.max(1, Math.round(width / ratio));
 const clamp = (value, limit) => Math.max(0, Math.min(limit, Math.round(value)));
 return { left: clamp(focusX * width - w / 2, width - w), top: clamp(focusY * height - h / 2, height - h), width: w, height: h };
}

async function makeHero(original, focusX, focusY) {
 if (!Buffer.isBuffer(original) || original.length < 1 || original.length > 10 * 1024 * 1024) throw Error('Imagen inválida');
 const input = sharp(original, {limitInputPixels: 40_000_000, failOn: 'error'});
 const meta = await input.metadata();
 if (!['jpeg','png','webp'].includes(meta.format) || (meta.pages ?? 1) !== 1) throw Error('Formato no admitido');
 const oriented = await input.rotate().toBuffer({resolveWithObject:true});
 const rect = cropRect(oriented.info.width, oriented.info.height, focusX, focusY);
 const result = await sharp(oriented.data).extract(rect).resize(1200, 630, {fit:'fill'}).jpeg({quality:90, mozjpeg:true}).toBuffer({resolveWithObject:true});
 if (result.info.width !== 1200 || result.info.height !== 630) throw Error('Dimensiones inesperadas');
 return {bytes:result.data, crop:rect, inputWidth:oriented.info.width, inputHeight:oriented.info.height, width:1200, height:630};
}
module.exports = { cropRect, makeHero };

