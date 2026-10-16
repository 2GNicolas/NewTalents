import { describe, expect, it, vi } from 'vitest';

import { Feature009ConfirmedMatchSource, type ConfirmedMatchSource } from './confirmed-match-source.js';

const actor = '00000000-0000-4000-8000-000000000001';
const passport = '00000000-0000-4000-8000-000000000002';
const matchId = '00000000-0000-4000-8000-000000000003';
const row = { id: matchId, passportId: passport, matchDate: new Date('2026-11-01T00:00:00.000Z'), matchTime: '10:00', opponent: 'Rival', competition: 'Liga', venue: 'Cancha', state: 'WAITING' };

function harness(rows = [row]) {
  const findMany = vi.fn().mockResolvedValue(rows);
  const findFirst = vi.fn().mockResolvedValue(rows[0] ?? null);
  const scope = { actorIdentityId: actor, tx: { firstMatch: { findMany, findFirst } } } as never;
  return { source: new Feature009ConfirmedMatchSource() as ConfirmedMatchSource, scope, findMany, findFirst };
}

describe('Feature009ConfirmedMatchSource', () => {
  it('lists a bounded page of confirmed matches behind a source-independent interface', async () => {
    const { source, scope, findMany } = harness([row, { ...row, id: '00000000-0000-4000-8000-000000000004', state: 'LOADED' }]);
    const page = await source.list(scope, { limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeTruthy();
    expect(page.items[0]).toMatchObject({ sourceKind: 'FIRST_MATCH', state: 'WAITING', matchDate: '2026-11-01' });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2, where: expect.objectContaining({
      state: { in: ['WAITING', 'LOADED'] }, passport: { state: 'ACTIVE', custody: { currentAnalystIdentityId: actor } },
    }) }));
  });

  it('does not read canceled rows or use current-first-match lookup for direct reads', async () => {
    const { source, scope, findFirst } = harness();
    expect(await source.find(scope, matchId)).toMatchObject({ id: matchId, state: 'WAITING' });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: matchId, state: { in: ['WAITING', 'LOADED'] } }) }));
  });

  it('allows a future source to implement the same read contract without registering fabricated data', async () => {
    const synthetic = { id: matchId, sourceKind: 'TEST_ONLY_LATER_MATCH', passportId: passport,
      matchDate: '2026-11-02', matchTime: '11:00', opponent: 'Rival', competition: 'Liga', venue: 'Cancha', state: 'WAITING' as const };
    const future: ConfirmedMatchSource = {
      list: async () => ({ items: [synthetic] }),
      find: async () => synthetic,
    };
    const { scope } = harness();
    expect((await future.list(scope, { limit: 10 })).items[0]?.sourceKind).toBe('TEST_ONLY_LATER_MATCH');
    expect(await future.find(scope, matchId)).toEqual(synthetic);
  });
});
