// Candidate only: the active receiver and Motor do not import this module.
import { resolveDestinations, destinationLabel } from './original-destinations.mjs';

// Only a standalone direct Telegram text message may attest this command.
// The receiver canonicalizes these exact aliases before storing the control;
// neither article text nor captions are passed here as execution authority.
export function parseContentModeCommand(text) {
  if (typeof text !== 'string') throw Error('INVALID_CONTENT_MODE_COMMAND');
  const value=text.trim().replace(/[ \t]+/g,' ').toLowerCase();
  if (/[\r\n]/.test(value)) throw Error('INVALID_CONTENT_MODE_COMMAND');
  if (value==='/editorial') return {command:'/editorial',contentMode:'EDITORIAL'};
  if (['/literal','tal cual','publica tal cual','publicar tal cual','sin agregar nada','tal cual sin agregar nada','publica tal cual sin agregar nada','publicar tal cual sin agregar nada','la publicación va tal cual, sin agregarle nada.','la publicación va tal cual, sin agregarle nada','la publicacion va tal cual, sin agregarle nada.','la publicacion va tal cual, sin agregarle nada'].includes(value)) return {command:'/literal',contentMode:'LITERAL'};
  throw Error('INVALID_CONTENT_MODE_COMMAND');
}

export function parseDestinationCommand(text) {
  if (typeof text !== 'string') throw Error('INVALID_COMMAND');
  const match = /^\/(publicar|borrador)(?:[ \t]+([A-Za-z0-9_, ]+))?$/i.exec(text.trim());
  if (!match) throw Error('INVALID_COMMAND');
  const destinations = resolveDestinations(match[2] ?? 'TODOS');
  return { mode: match[1].toLowerCase() === 'publicar' ? 'PUBLISH' : 'DRAFT',
    destination: destinationLabel(destinations), destinations };
}
