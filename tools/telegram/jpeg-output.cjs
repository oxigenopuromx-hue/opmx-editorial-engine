// Convert editorial derivatives only; never overwrite or modify the original.
const sharp = require('sharp');
const FEATURED_LIMIT = 500 * 1024;
async function toEditorialJpeg(input, role) {
  if (!Buffer.isBuffer(input) || !input.length || input.length > 10 * 1024 * 1024) throw Error('Imagen original inválida');
  if (!['hero', 'featured'].includes(role)) throw Error('Rol de imagen inválido');
  const source = sharp(input, { limitInputPixels: 40_000_000, failOn: 'error' });
  const original = await source.metadata();
  if (!['jpeg','png','webp'].includes(original.format) || (original.pages ?? 1) !== 1) throw Error('Formato de imagen no admitido');
  const normalized = await source.rotate().flatten({background:'#ffffff'}).toColourspace('srgb').toBuffer({resolveWithObject:true});
  if (role === 'featured' && (normalized.info.width !== 1200 || normalized.info.height !== 630)) throw Error('La destacada debe estar previamente encuadrada a 1200 × 630');
  for (const quality of [85,80,75,70]) {
    const output = await sharp(normalized.data).jpeg({quality,progressive:true,mozjpeg:true}).toBuffer({resolveWithObject:true});
    if (role === 'featured' && output.data.length > FEATURED_LIMIT) continue;
    const check = await sharp(output.data,{failOn:'error'}).metadata();
    if (check.format !== 'jpeg' || check.hasAlpha || check.width !== normalized.info.width || check.height !== normalized.info.height) throw Error('JPEG de salida no verificado');
    return {bytes:output.data, mimeType:'image/jpeg', width:check.width, height:check.height, quality, size:output.data.length};
  }
  throw Error('La destacada supera 500 KiB incluso con calidad JPEG 70');
}
module.exports = {toEditorialJpeg, FEATURED_LIMIT};
