import { createHash } from 'node:crypto';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const PREFIX = 'OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d\n';

// The intake must store the actual authenticated /nuevo and /listo messages,
// after showing the operator the default. Never synthesize /publicar.
export function chooseTelegramMode(inventory, sources) {
  if (!inventory || inventory.state !== 'READY' || !Array.isArray(inventory.items) || !Array.isArray(sources)) throw Error('Inventario inválido');
  let choice = { mode: 'DRAFT', destination: 'AMBOS', explicit: false };
  let hasExplicitChoice = false;
  let announcedDefault = false;
  let lastTextIsClose = false;
  for (const item of inventory.items) {
    if (item.kind !== 'TEXT') { lastTextIsClose = false; continue; }
    const matches = sources.filter(s => s.item_id === item.item_id && s.stream === 'text');
    if (matches.length !== 1 || !Buffer.isBuffer(matches[0].bytes) || matches[0].bytes.length !== item.text_bytes || digest(matches[0].bytes) !== item.sha256) throw Error('Texto no verificado');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(matches[0].bytes).trim();
    const command = text.startsWith(PREFIX) ? text.slice(PREFIX.length) : '';
    if (command === '/nuevo') announcedDefault = true;
    lastTextIsClose = command === '/listo';
    const match = /^\/(publicar|borrador)(?:\s+(ambos|opuro|opol))?$/i.exec(command);
    if (match) {
      choice = { mode: match[1].toLowerCase() === 'publicar' ? 'PUBLISH' : 'DRAFT', destination: (match[2] ?? 'ambos').toUpperCase(), explicit: true };
      hasExplicitChoice = true;
    }
  }
  if (!hasExplicitChoice && announcedDefault && lastTextIsClose) return { mode: 'PUBLISH', destination: 'AMBOS', explicit: true };
  return choice;
}
