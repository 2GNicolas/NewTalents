import { describe, expect, it, vi } from 'vitest';

import { AllowanceQuery } from './allowance-query.js';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const administratorId = '11111111-1111-4111-8111-111111111111';
const revisions = [
  { sequence: 1, cadence: 'MONTHLY', matchLimit: 4n, effectiveOn: new Date('2026-10-09T00:00:00Z'), confirmedAt: new Date('2026-10-09T15:00:00Z') },
  { sequence: 2, cadence: 'QUARTERLY', matchLimit: 6n, effectiveOn: new Date('2026-11-09T00:00:00Z'), confirmedAt: new Date('2026-10-10T15:00:00Z') },
];

describe('authorized allowance projection', () => {
  const make = (state: string, allowance: unknown, now = new Date('2026-10-15T04:00:00Z')) => {
    const prisma = { playerPassport: { findUnique: vi.fn().mockResolvedValue({ state }) },
      passportMatchAllowance: { findUnique: vi.fn().mockResolvedValue(allowance) } };
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }) };
    return { query: new AllowanceQuery(prisma as never, authorization as never, () => now), prisma, authorization };
  };

  it('reports null for absent configuration and the server Colombia day, not zero usage', async () => {
    const { query } = make('ACTIVE', null);
    expect(await query.get({ administratorId, passportId: id })).toEqual({
      passportId: id, canConfigure: true, colombiaToday: '2026-10-14', configuration: null,
    });
  });

  it('separates current and pending rules, fixed initial date, and current interval', async () => {
    const { query } = make('ACTIVE', { activatedOn: new Date('2026-10-09T00:00:00Z'), version: 2, revisions });
    const result = await query.get({ administratorId, passportId: id });
    expect(result).toMatchObject({ canConfigure: true, configuration: {
      version: 2, activatedOn: '2026-10-09',
      currentRule: { cadence: 'MONTHLY', matchLimit: 4 },
      currentPeriod: { start: '2026-10-09', endExclusive: '2026-11-09' },
      pendingRule: { cadence: 'QUARTERLY', matchLimit: 6, effectiveOn: '2026-11-09' },
      lastModifiedAt: '2026-10-10T15:00:00.000Z',
    } });
    expect(JSON.stringify(result)).not.toMatch(/used|available|contact|credential|confirmedByIdentityId/);
    const afterBoundary = make('ACTIVE', { activatedOn: new Date('2026-10-09T00:00:00Z'), version: 2, revisions }, new Date('2026-11-10T16:00:00Z'));
    expect(await afterBoundary.query.get({ administratorId, passportId: id })).toMatchObject({ configuration: {
      currentRule: { cadence: 'QUARTERLY', matchLimit: 6, effectiveOn: '2026-11-09' },
      pendingRule: null,
    } });
  });

  it('makes inactive passports read-only and denies missing or revoked access without allowance disclosure', async () => {
    const { query } = make('DRAFT', null);
    expect(await query.get({ administratorId, passportId: id })).toMatchObject({ canConfigure: false });
    const configured = make('DRAFT', { activatedOn: new Date('2026-10-09T00:00:00Z'), version: 2, revisions });
    expect(await configured.query.get({ administratorId, passportId: id })).toMatchObject({
      canConfigure: false,
      configuration: { currentRule: { cadence: 'MONTHLY', matchLimit: 4 } },
    });
    const missing = make('ACTIVE', null);
    missing.authorization.authorize.mockResolvedValue({ allowed: false });
    expect(await missing.query.get({ administratorId, passportId: id })).toEqual({ outcome: 'not-found' });
    expect(missing.prisma.passportMatchAllowance.findUnique).not.toHaveBeenCalled();
  });
});
