import { createHash } from 'node:crypto';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const packagePattern = /^tg_[a-f0-9]{40}$/;
const itemPattern = /^ti_[a-f0-9]{40}$/;

/** Verify a closed Telegram package before any editorial or Publisher work. */
export function prepareDraftHandoff({ inventory, revision, sources, destination }) {
 if (!inventory || !packagePattern.test(inventory.package_id ?? '') || inventory.state !== 'READY' ||
     !Number.isSafeInteger(revision) || revision < 1 || inventory.revision !== revision ||
     !Array.isArray(inventory.items) || inventory.items.length === 0 || inventory.items.length > 20 ||
     !Array.isArray(sources) || !['OPURO', 'OPOL', 'AMBOS'].includes(destination)) throw Error('Paquete o destino inválido');
 const itemIds = new Set();
 const expectedStreams = [];
 for (const item of inventory.items) {
  if (!itemPattern.test(item.item_id ?? '') || itemIds.has(item.item_id) || item.state !== 'STORED') throw Error('Inventario inválido');
  itemIds.add(item.item_id);
  if (item.kind === 'TEXT') expectedStreams.push([item, 'text', item.text_bytes]);
  else if (item.kind === 'FILE') {
   expectedStreams.push([item, 'original', item.original_bytes]);
   if (item.text_bytes > 0) expectedStreams.push([item, 'text', item.text_bytes]);
  } else throw Error('Tipo no admitido');
 }
 if (sources.length !== expectedStreams.length) throw Error('Fuentes incompletas');
 const used = new Set();
 for (const [item, stream, size] of expectedStreams) {
  const matches = sources.filter(s => s.item_id === item.item_id && s.stream === stream);
  if (matches.length !== 1 || !Buffer.isBuffer(matches[0].bytes) || matches[0].bytes.length !== size) throw Error('Fuente inválida');
  const source = matches[0];
  const key = `${item.item_id}:${stream}`;
  if (used.has(key)) throw Error('Fuente duplicada');
  used.add(key);
  // Inventory SHA describes the original file, or the text stream for TEXT items.
  if ((stream === 'original' || item.kind === 'TEXT') && sha256(source.bytes) !== item.sha256) throw Error('Huella inválida');
  // Captions have no inventory hash; callers must provide the independently verified stream hash.
  if (stream === 'text' && item.kind === 'FILE' && (!/^[a-f0-9]{64}$/.test(source.verified_sha256 ?? '') || sha256(source.bytes) !== source.verified_sha256)) throw Error('Caption sin verificar');
 }
 const key = `${inventory.package_id}:${revision}:${destination}:draft-v1`;
 return { package_id: inventory.package_id, revision, destination, request_id: `tg_${sha256(key)}`, source_count: inventory.items.length, publication: false };
}

