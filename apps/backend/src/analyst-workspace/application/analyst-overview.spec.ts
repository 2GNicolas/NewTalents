import { describe, expect, it, vi } from 'vitest';

import { AnalystOverview, classifyOverview } from './analyst-overview.js';
import type { ConfirmedMatch } from '../persistence/confirmed-match-source.js';

const match = (state: 'WAITING' | 'LOADED', date: string, time: string, id = '11111111-1111-4111-8111-111111111111'): ConfirmedMatch => ({
  id, passportId: '22222222-2222-4222-8222-222222222222', sourceKind: 'FIRST_MATCH',
  matchDate: date, matchTime: time, opponent: 'Rival', competition: 'Liga', venue: 'Cancha', state,
});

describe('America/Bogota overview classification', () => {
  it('puts equality in pending, never upcoming, independent of the host timezone', () => {
    const scheduled = match('WAITING', '2026-10-15', '10:00');
    expect(classifyOverview([scheduled], new Date('2026-10-15T14:59:59.000Z')).upcoming).toEqual([scheduled]);
    expect(classifyOverview([scheduled], new Date('2026-10-15T15:00:00.000Z')).pending).toEqual([scheduled]);
    const after = classifyOverview([scheduled], new Date('2026-10-15T15:01:00.000Z'));
    expect(after.pending).toEqual([scheduled]);
    expect(after.upcoming).toEqual([]);
  });

  it('does not count loaded matches or duplicated IDs as completed analyses', () => {
    const current = match('WAITING', '2026-10-15', '10:00');
    const canceled = { ...match('WAITING', '2026-10-15', '08:00', '44444444-4444-4444-8444-444444444444'), state: 'CANCELED' } as never;
    const result = classifyOverview([current, current, match('LOADED', '2026-10-15', '09:00', '33333333-3333-4333-8333-333333333333'), canceled],
      new Date('2026-10-15T15:00:00.000Z'));
    expect(result.pending).toEqual([current]);
    expect(result.upcoming).toEqual([]);
  });

  it('uses Bogota calendar dates across UTC midnight, not the device date', () => {
    const scheduled = match('WAITING', '2026-10-15', '00:00');
    expect(classifyOverview([scheduled], new Date('2026-10-15T04:59:59.000Z')).upcoming).toEqual([scheduled]);
    expect(classifyOverview([scheduled], new Date('2026-10-15T05:00:00.000Z')).pending).toEqual([scheduled]);
  });

  it('marks both sections partial when the source page has more and never invents global totals', async () => {
    const source = { list: vi.fn().mockResolvedValue({ items: [match('WAITING', '2026-10-16', '10:00')], nextCursor: 'cursor' }) };
    const scope = { actorIdentityId: 'analyst', tx: { analystOperationalProfile: { findUnique: vi.fn().mockResolvedValue({ displayLabel: 'Analista de prueba' }) }, playerPassport: { findMany: vi.fn().mockResolvedValue([
      { id: '22222222-2222-4222-8222-222222222222', player: { privateIdentity: { encryptedLegalName: 'cipher' } } },
    ]) } } };
    const access = { readCollection: vi.fn(async (_actor: string, project: (value: typeof scope) => Promise<unknown>) => project(scope)) };
    const query = new AnalystOverview(access as never, source as never, { decrypt: () => 'Jugador de prueba' },
      () => new Date('2026-10-15T15:00:00.000Z'));
    const result = await query.get('analyst');
    expect(result.analystLabel).toBe('Analista de prueba');
    expect(result.upcoming).toMatchObject({ availability: 'AVAILABLE', hasMore: true, data: [{ playerName: 'Jugador de prueba' }] });
    expect(result.pending).toMatchObject({ availability: 'AVAILABLE', hasMore: true, data: [] });
    expect(result.completed).toEqual({ availability: 'UNAVAILABLE' });
    expect(JSON.stringify(result)).not.toMatch(/"count"|"total"|cipher/);
  });
});
