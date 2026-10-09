import { describe, expect, it, vi } from 'vitest';

import { AllowanceHistory } from './allowance-history.js';

const passportId = '22222222-2222-4222-8222-222222222222';
const administratorId = '11111111-1111-4111-8111-111111111111';
const first = { id: 'revision-1', sequence: 1, cadence: 'MONTHLY', matchLimit: 2n,
  effectiveOn: new Date('2026-01-31T00:00:00Z'), confirmedAt: new Date('2026-01-31T15:00:00Z'),
  confirmedByIdentityId: administratorId, previousCadence: null, previousMatchLimit: null, previousEffectiveOn: null };
const second = { ...first, id: 'revision-2', sequence: 2, matchLimit: 3n,
  effectiveOn: new Date('2026-02-28T00:00:00Z'), confirmedAt: new Date('2026-02-10T16:00:00Z'),
  previousCadence: 'MONTHLY', previousMatchLimit: 2n, previousEffectiveOn: first.effectiveOn };

function setup(options: { state?: string | null; allowance?: object | null; allowed?: boolean; rows?: object[] } = {}) {
  const prisma = {
    playerPassport: { findUnique: vi.fn().mockResolvedValue(options.state === null ? null : { state: options.state ?? 'ACTIVE' }) },
    passportMatchAllowance: { findUnique: vi.fn().mockResolvedValue(options.allowance === null ? null : options.allowance ?? { id: 'allowance-1' }) },
    passportMatchAllowanceRevision: { findMany: vi.fn().mockResolvedValue(options.rows ?? [second, first]) },
  };
  const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: options.allowed ?? true }) };
  return { query: new AllowanceHistory(prisma as never, authorization as never), prisma, authorization };
}

describe('authorized append-only allowance history', () => {
  it('orders confirmed revisions stably and includes safe before/after snapshots, actor label and effective date', async () => {
    const { query, prisma, authorization } = setup();
    const result = await query.list({ administratorId, passportId, limit: 20 });
    expect(result).toEqual({ items: [
      { sequence: 2, confirmedAt: '2026-02-10T16:00:00.000Z', actorLabel: 'Administrador de New Talents', effectiveOn: '2026-02-28',
        previousRule: { cadence: 'MONTHLY', matchLimit: 2, effectiveOn: '2026-01-31' },
        newRule: { cadence: 'MONTHLY', matchLimit: 3, effectiveOn: '2026-02-28' } },
      { sequence: 1, confirmedAt: '2026-01-31T15:00:00.000Z', actorLabel: 'Administrador de New Talents', effectiveOn: '2026-01-31',
        previousRule: null, newRule: { cadence: 'MONTHLY', matchLimit: 2, effectiveOn: '2026-01-31' } },
    ], nextCursor: null });
    expect(JSON.stringify(result)).not.toContain(administratorId);
    expect(authorization.authorize).toHaveBeenCalledWith(administratorId, 'passport.allowance.history', { exists: true, active: true });
    expect(prisma.passportMatchAllowanceRevision.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ sequence: 'desc' }, { id: 'desc' }] }));
  });

  it('pages by a stable cursor, includes superseded accepted pending revisions and excludes unconfirmed proposals', async () => {
    const { query, prisma } = setup({ rows: [second, first] });
    const page = await query.list({ administratorId, passportId, limit: 1 });
    expect(page).toMatchObject({ items: [{ sequence: 2 }], nextCursor: expect.any(String) });
    if (!('nextCursor' in page) || !page.nextCursor) throw new Error('Missing cursor');
    await query.list({ administratorId, passportId, limit: 1, cursor: page.nextCursor });
    expect(prisma.passportMatchAllowanceRevision.findMany.mock.calls[1]?.[0]).toMatchObject({ where: { allowanceId: 'allowance-1', sequence: { lt: 2 } } });
  });

  it('hides missing and denied direct IDs equivalently and supports absent history', async () => {
    for (const options of [{ state: null }, { allowed: false }]) {
      const { query, prisma } = setup(options);
      expect(await query.list({ administratorId, passportId, limit: 20 })).toEqual({ outcome: 'not-found' });
      expect(prisma.passportMatchAllowanceRevision.findMany).not.toHaveBeenCalled();
    }
    const absent = setup({ allowance: null });
    expect(await absent.query.list({ administratorId, passportId, limit: 20 })).toEqual({ items: [], nextCursor: null });
    expect(await absent.query.list({ administratorId, passportId, limit: 0 })).toEqual({ outcome: 'invalid-query' });
  });
});
