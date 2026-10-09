import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

import { AuthorizationService } from '../../src/authorization/authorization.service.js';
import { AdministratorAllowanceAuthorization } from '../../src/passport-match-allowance/application/administrator-allowance-authorization.js';
import { AllowanceQuery } from '../../src/passport-match-allowance/application/allowance-query.js';
import { resolveAllowancePeriod } from '../../src/passport-match-allowance/application/allowance-period-query.js';
import { allowanceBoundary, type AllowanceCadence } from '../../src/passport-match-allowance/domain/allowance-period.js';
import { command, fixture, isolatedClient } from './feature-008-fixture.js';

describe('Feature 008 persisted period projections', () => {
  const prisma = isolatedClient();
  afterAll(() => prisma.$disconnect());

  it.each([
    ['MONTHLY', '2026-11-09'], ['QUARTERLY', '2027-01-09'],
    ['SEMIANNUAL', '2027-04-09'], ['ANNUAL', '2027-10-09'],
  ] as const)('agrees between the authorized projection and read port for %s', async (cadence, next) => {
    const row = await fixture(prisma);
    const at = new Date('2026-10-09T05:01:00.000Z');
    expect((await command(prisma, at).create({ passportId: row.passportId, administratorIdentityId: row.administratorId,
      expectedVersion: 0, idempotencyKey: randomUUID(), cadence, matchLimit: 4, expectedActivationDate: '2026-10-09' })).outcome).toBe('applied');
    const query = new AllowanceQuery(prisma as never, new AdministratorAllowanceAuthorization(prisma as never, new AuthorizationService()), () => at);
    const result = await query.get({ administratorId: row.administratorId, passportId: row.passportId });
    expect(result).toMatchObject({ configuration: { currentPeriod: { start: '2026-10-09', endExclusive: next } } });
    const revisions = await prisma.passportMatchAllowanceRevision.findMany({ where: { allowance: { passportId: row.passportId } } });
    const port = resolveAllowancePeriod({ passportId: row.passportId, activatedOn: '2026-10-09',
      revisions: revisions.map((revision) => ({ sequence: revision.sequence, effectiveOn: revision.effectiveOn.toISOString().slice(0, 10),
        cadence: revision.cadence, matchLimit: Number(revision.matchLimit) })) }, '2026-10-09');
    expect(port?.period).toMatchObject({ start: '2026-10-09', endExclusive: next });
  });

  it('keeps 29–31 and leap anchors without gaps and reanchors only on cadence change', async () => {
    for (const [anchor, february, march] of [
      ['2026-01-29', '2026-02-28', '2026-03-29'],
      ['2026-01-30', '2026-02-28', '2026-03-30'],
      ['2026-01-31', '2026-02-28', '2026-03-31'],
      ['2024-01-31', '2024-02-29', '2024-03-31'],
    ]) {
      expect(allowanceBoundary(anchor!, 'MONTHLY', 1)).toBe(february);
      expect(allowanceBoundary(anchor!, 'MONTHLY', 2)).toBe(march);
      const source = { passportId: randomUUID(), activatedOn: anchor!, revisions: [
        { sequence: 1, effectiveOn: anchor!, cadence: 'MONTHLY' as AllowanceCadence, matchLimit: 2 },
      ] };
      expect(resolveAllowancePeriod(source, anchor!)?.period.endExclusive).toBe(february);
      expect(resolveAllowancePeriod(source, february!)?.period.start).toBe(february);
      expect(resolveAllowancePeriod(source, february!)?.period.endExclusive).toBe(march);
      const changed = { ...source, revisions: [...source.revisions,
        { sequence: 2, effectiveOn: february!, cadence: 'QUARTERLY' as AllowanceCadence, matchLimit: 3 }] };
      expect(resolveAllowancePeriod(changed, february!)?.period).toMatchObject({ start: february!, endExclusive: allowanceBoundary(february!, 'QUARTERLY', 1) });
    }
  });
});
