import { createHash } from 'node:crypto';
import { parseContentModeCommand } from './original-destination-command.mjs';
import { parseVersionedDestinationCommand } from './versioned-destinations.mjs';

// Candidate only: not connected to the production receiver or Motor.
function validControl(command, policy) {
  if (['/nuevo','/listo','/literal','/editorial'].includes(command)) return true;
  try { parseVersionedDestinationCommand(command, policy); return true; } catch { return false; }
}

export const ORDER_PREFIX = 'OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d\n';
export const POLICY = 'publish-ambos-v4';
export const HORIZONTE_POLICY = 'publish-todos-v3';
export const PREVIOUS_POLICY = 'publish-todos-v2';
export const LEGACY_POLICY = 'publish-ambos-v1';
const digest = value => createHash('sha256').update(value).digest('hex');

// Only the authenticated receiver writes these records. Policy must come from
// the package's persisted opening; new openings use POLICY. Do not substitute
// today's version when closing a package opened before the cutover.
export function attestedControl(command, packageId, messageId, noticeMessageId, policy) {
  try { command=parseContentModeCommand(command).command; } catch {}
  if (!/^tg_[a-f0-9]{40}$/.test(packageId) || !Number.isSafeInteger(messageId) || messageId < 1) throw Error('CONTROL_INVALID');
  if (![POLICY, HORIZONTE_POLICY, PREVIOUS_POLICY, LEGACY_POLICY].includes(policy)) throw Error('CONTROL_POLICY_UNCONFIRMED');
  if (!validControl(command, policy)) throw Error('CONTROL_INVALID');
  const data = { policy, package_id: packageId, message_id: messageId };
  if (command === '/nuevo') {
    if (!Number.isSafeInteger(noticeMessageId) || noticeMessageId <= messageId) throw Error('NOTICE_NOT_CONFIRMED');
    data.notice_message_id = noticeMessageId;
  }
  return ORDER_PREFIX + command + '\n' + JSON.stringify(data);
}

export function decodeControl(text, packageId) {
  if (!text.startsWith(ORDER_PREFIX)) return null;
  const marked = text.slice(ORDER_PREFIX.length);
  const legacy = /^\/(publicar|borrador)(?:\s+(ambos|opuro|opol))?$/i.exec(marked);
  if (legacy) return { command: marked, legacy: true };
  const split = marked.indexOf('\n');
  if (split === -1) {if (/^\/(?:literal|editorial)(?:\s|$)/i.test(marked))throw Error('CONTROL_INVALID');return null;} // image instructions and legacy non-mode records
  const command = marked.slice(0, split);
  // Other marked items, especially multiline image instructions, are not
  // policy envelopes. Identify a possible control before decoding its JSON.
  if (![POLICY, HORIZONTE_POLICY, PREVIOUS_POLICY, LEGACY_POLICY].some(policy=>validControl(command,policy))) {
    let contentAlias=false;try{parseContentModeCommand(command);contentAlias=true}catch{}
    if (contentAlias||/^\/(?:publicar|borrador|literal|editorial)(?:\s|$)/i.test(command)) throw Error('CONTROL_INVALID');
    return null;
  }
  let data;
  try { data = JSON.parse(marked.slice(split + 1)); } catch { throw Error('CONTROL_INVALID'); }
  if (![POLICY, HORIZONTE_POLICY, PREVIOUS_POLICY, LEGACY_POLICY].includes(data.policy) || data.package_id !== packageId || !Number.isSafeInteger(data.message_id) || data.message_id < 1) throw Error('CONTROL_BINDING_INVALID');
  if (!validControl(command, data.policy)) {
    let contentAlias=false;try{parseContentModeCommand(command);contentAlias=true}catch{}
    // A malformed or unsupported marked mode must never fall back to the default.
    if (contentAlias||/^\/(?:publicar|borrador|literal|editorial)(?:\s|$)/i.test(command)) throw Error('CONTROL_INVALID');
    return null;
  }
  if (command === '/nuevo' && (!Number.isSafeInteger(data.notice_message_id) || data.notice_message_id <= data.message_id)) throw Error('NOTICE_NOT_CONFIRMED');
  return { command, ...data, legacy: false };
}

export function chooseTelegramMode(inventory, sources) {
  if (!inventory || inventory.state !== 'READY' || !/^tg_[a-f0-9]{40}$/.test(inventory.package_id ?? inventory.packageId ?? '') || !Array.isArray(inventory.items) || !Array.isArray(sources)) throw Error('INVENTORY_INVALID');
  const packageId = inventory.package_id ?? inventory.packageId;
  const records = [], ids = new Set(), controlIds = [];
  let substantive = 0;
  for (const [index, item] of inventory.items.entries()) {
    if (!item.item_id || ids.has(item.item_id)) throw Error('DUPLICATE_ITEM');
    ids.add(item.item_id);
    if (item.state && item.state !== 'STORED') {
      if (item.state === 'DISCARDED') continue;
      throw Error('ITEM_NOT_STORED');
    }
    if (item.kind === 'FILE') { substantive++; continue; }
    if (item.kind !== 'TEXT') throw Error('ITEM_KIND_INVALID');
    const found = sources.filter(s => s.item_id === item.item_id && s.stream === 'text');
    if (found.length !== 1 || !Buffer.isBuffer(found[0].bytes) || found[0].bytes.length !== item.text_bytes || digest(found[0].bytes) !== item.sha256) throw Error('TEXT_INTEGRITY_FAILED');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(found[0].bytes).trim();
    const control = decodeControl(text, packageId);
    if (control) { records.push({ ...control, index, item_id: item.item_id }); controlIds.push(item.item_id); }
    else if (text && !text.startsWith(ORDER_PREFIX)) substantive++;
  }
  const opening = records.filter(r => r.command === '/nuevo' && !r.legacy);
  const closing = records.filter(r => r.command === '/listo' && !r.legacy);
  const choices = records.filter(r => /^\/(?:publicar|borrador)/i.test(r.command));
  const contentChoices=records.filter(r=>['/literal','/editorial'].includes(r.command));
  const modern = records.filter(r => !r.legacy);
  if (new Set(modern.map(r=>r.message_id)).size !== modern.length) throw Error('CONTROL_MESSAGE_DUPLICATE');
  if (opening.length > 1) throw Error('OPENING_AMBIGUOUS');
  if(contentChoices.length&&!opening.length)throw Error('CONTENT_MODE_BOUNDARY_UNCONFIRMED');
  if (opening.length) {
    const open = opening[0];
    const close = closing.toSorted((a,b)=>a.message_id-b.message_id).at(-1);
    if (!close || close.message_id <= open.message_id) throw Error('CLOSING_NOT_CONFIRMED');
    // A new source received between reservation and seal invalidates the boundary;
    // never silently turn a failed automatic publication into an implicit draft.
    const lastStored = inventory.items.map((i,index)=>({i,index})).filter(({i})=>!i.state||i.state==='STORED').at(-1);
    if (!lastStored || lastStored.index !== close.index || substantive === 0) throw Error('PACKAGE_BOUNDARY_INVALID');
    if (close.policy !== open.policy || choices.some(c=>!c.legacy && c.policy !== open.policy)) throw Error('POLICY_BOUNDARY_MISMATCH');
    if (choices.some(c=>c.legacy || c.message_id <= open.message_id || c.message_id >= close.message_id)) throw Error('MODE_ORDER_AMBIGUOUS');
    if(contentChoices.some(c=>c.legacy||c.policy!==open.policy||c.message_id<=open.message_id||c.message_id>=close.message_id||c.index<=open.index||c.index>=close.index))throw Error('CONTENT_MODE_ORDER_AMBIGUOUS');
    choices.sort((a,b)=>a.message_id-b.message_id);
  } else if (modern.length) {
    // A close record alone never upgrades an existing/legacy package.
    if (!choices.length) throw Error('DEFAULT_POLICY_NOT_CONFIRMED');
    // Without an opening, no single envelope can establish a mixed history.
    // In particular do not reinterpret a legacy choice using a later policy.
    if (new Set(modern.map(r=>r.policy)).size !== 1 || choices.some(c=>c.legacy)) throw Error('POLICY_BOUNDARY_MISMATCH');
    choices.sort((a,b)=>(a.message_id??a.index)-(b.message_id??b.index));
  }
  const last = choices.at(-1);
  contentChoices.sort((a,b)=>a.message_id-b.message_id);
  const content=contentChoices.at(-1);
  const withContent=result=>content?{...result,content_mode:content.command==='/literal'?'LITERAL':'EDITORIAL',content_control_item_ids:contentChoices.map(c=>c.item_id)}:result;
  if (last) {
    const policy=last.legacy?LEGACY_POLICY:last.policy;
    const selection = parseVersionedDestinationCommand(last.command,policy);
    return withContent({ mode: selection.mode, destination: selection.destination, destinations:selection.destinations, policy:selection.policy, explicit:true, authorized:true, authorization:'DIRECT_MODE_COMMAND', control_item_ids:controlIds });
  }
  if (opening.length) { const selected=parseVersionedDestinationCommand('/publicar',opening[0].policy); return withContent({ mode:'PUBLISH', destination:selected.destination, destinations:selected.destinations, policy:selected.policy, explicit:false, authorized:true, authorization:'ANNOUNCED_DEFAULT_AND_DIRECT_CLOSE', control_item_ids:controlIds }); }
  return { mode:'DRAFT', destination:'AMBOS', explicit:false, authorized:false, authorization:'LEGACY_PRESERVED', control_item_ids:controlIds };
}


