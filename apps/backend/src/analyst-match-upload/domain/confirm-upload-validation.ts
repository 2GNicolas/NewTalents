import { validateObservedEvent, type ObservedEvent } from './observed-event-validation.js';

export type ConfirmUploadInput = Readonly<{
  expectedVersion: number;
  participation: 'PARTICIPATED' | 'DID_NOT_PARTICIPATE';
  totalMinutesPlayed: number;
  youtubeUrl: string;
  events: readonly ObservedEvent[];
}>;

export class ConfirmUploadValidationError extends Error {
  constructor() { super('Invalid final match upload'); }
}
function invalid(): never { throw new ConfirmUploadValidationError(); }

function validYouTubeUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    if (host === 'youtu.be') return /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
    if (host !== 'youtube.com' && !host.endsWith('.youtube.com')) return false;
    if (url.pathname === '/watch') return /^[A-Za-z0-9_-]+$/.test(url.searchParams.get('v') ?? '');
    return /^\/(?:shorts|embed|live)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
  } catch { return false; }
}

/** A final upload is capture data, never an FEM evaluation. */
export function validateConfirmUpload(input: unknown): ConfirmUploadInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid();
  const row = input as Record<string, unknown>;
  const keys = ['expectedVersion', 'participation', 'totalMinutesPlayed', 'youtubeUrl', 'events'];
  if (Object.keys(row).some((key) => !keys.includes(key)) || keys.some((key) => !(key in row))) invalid();
  if (!Number.isSafeInteger(row.expectedVersion) || (row.expectedVersion as number) < 1) invalid();
  if (!Number.isSafeInteger(row.totalMinutesPlayed) || (row.totalMinutesPlayed as number) < 0
    || (row.totalMinutesPlayed as number) > 2147483647) invalid();
  if (!validYouTubeUrl(row.youtubeUrl) || !Array.isArray(row.events)) invalid();
  if (row.participation !== 'PARTICIPATED' && row.participation !== 'DID_NOT_PARTICIPATE') invalid();
  if (row.participation === 'PARTICIPATED' && ((row.totalMinutesPlayed as number) === 0 || row.events.length === 0)) invalid();
  if (row.participation === 'DID_NOT_PARTICIPATE' && ((row.totalMinutesPlayed as number) !== 0 || row.events.length !== 0)) invalid();
  const events: ObservedEvent[] = [];
  const seen = new Set<number>();
  for (const [index, item] of row.events.entries()) {
    let event: ObservedEvent;
    try { event = validateObservedEvent(item); } catch { return invalid(); }
    if (event.sequence !== index + 1 || seen.has(event.sequence)) invalid();
    seen.add(event.sequence);
    events.push(event);
  }
  return { expectedVersion: row.expectedVersion as number,
    participation: row.participation as ConfirmUploadInput['participation'],
    totalMinutesPlayed: row.totalMinutesPlayed as number, youtubeUrl: row.youtubeUrl as string, events };
}
