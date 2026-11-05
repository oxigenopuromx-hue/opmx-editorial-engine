// Candidate only: the active receiver and Motor do not import this module.
import { resolveDestinations, destinationLabel } from '../mcp-publisher/destinations.mjs';

export function parseDestinationCommand(text) {
  if (typeof text !== 'string') throw Error('INVALID_COMMAND');
  const match = /^\/(publicar|borrador)(?:[ \t]+([A-Za-z0-9_, ]+))?$/i.exec(text.trim());
  if (!match) throw Error('INVALID_COMMAND');
  const destinations = resolveDestinations(match[2] ?? 'AMBOS');
  return { mode: match[1].toLowerCase() === 'publicar' ? 'PUBLISH' : 'DRAFT',
    destination: destinationLabel(destinations), destinations };
}
