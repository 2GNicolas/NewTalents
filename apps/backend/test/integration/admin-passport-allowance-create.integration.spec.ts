import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

import { AdminPassportsQuery } from '../../src/passport-match-allowance/application/admin-passports-query.js';
import { AdministratorAllowanceAuthorization } from '../../src/passport-match-allowance/application/administrator-allowance-authorization.js';
import { AllowanceQuery } from '../../src/passport-match-allowance/application/allowance-query.js';
import { AdminPassportsRepository } from '../../src/passport-match-allowance/persistence/admin-passports.repository.js';
import { AuthorizationService } from '../../src/authorization/authorization.service.js';
import { command, fixture, isolatedClient } from './feature-008-fixture.js';

describe('Feature 008 first confirmation on isolated PostgreSQL', () => {
  const prisma = isolatedClient();
  afterAll(() => prisma.$disconnect());

  it('pages all passport states and creates exactly one allowance on the server Colombia day', async () => {
    const active = await fixture(prisma);
    const draft = await fixture(prisma, 'DRAFT');
    const authorization = new AdministratorAllowanceAuthorization(prisma as never, new AuthorizationService());
    const passports = new AdminPassportsQuery(new AdminPassportsRepository(prisma as never), authorization, { decrypt: (value) => value });
    const ids = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await passports.list({ administratorId: active.administratorId, limit: 1, ...(cursor ? { cursor } : {}) });
      expect(page).toHaveProperty('items');
      if (!('items' in page)) throw new Error('List denied');
      page.items.forEach((item) => ids.add(item.passportId));
      cursor = page.nextCursor;
    } while (cursor);
    expect(ids).toContain(active.passportId);
    expect(ids).toContain(draft.passportId);
    expect(await passports.detail({ administratorId: active.administratorId, passportId: draft.passportId })).toMatchObject({ canConfigure: false });

    const before = await prisma.playerPassport.findUniqueOrThrow({ where: { id: active.passportId }, select: { version: true, state: true } });
    const custodyCount = await prisma.passportCustody.count();
    const approvalCount = await prisma.registrationApprovalExecution.count();
    const now = new Date('2026-10-09T05:01:00.000Z');
    const service = command(prisma, now);
    const input = { passportId: active.passportId, administratorIdentityId: active.administratorId,
      expectedVersion: 0, idempotencyKey: randomUUID(), cadence: 'MONTHLY' as const,
      matchLimit: 4, expectedActivationDate: '2026-10-09' };
    expect(await service.create({ ...input, matchLimit: 0 })).toEqual({ outcome: 'invalid' });
    expect(await service.create({ ...input, expectedActivationDate: '2026-10-08' })).toEqual({ outcome: 'activation-date-changed' });
    expect(await prisma.passportMatchAllowance.count({ where: { passportId: active.passportId } })).toBe(0);
    expect(await service.create(input)).toMatchObject({ outcome: 'applied', colombiaToday: '2026-10-09', configuration: { version: 1, activatedOn: '2026-10-09' } });
    const aggregate = await prisma.passportMatchAllowance.findUniqueOrThrow({ where: { passportId: active.passportId }, include: { revisions: true } });
    expect(aggregate.revisions).toHaveLength(1);
    expect(aggregate.revisions[0]).toMatchObject({ sequence: 1, cadence: 'MONTHLY', matchLimit: 4n, confirmedByIdentityId: active.administratorId });
    expect(await prisma.playerPassport.findUniqueOrThrow({ where: { id: active.passportId }, select: { version: true, state: true } })).toEqual(before);
    expect(await prisma.passportCustody.count()).toBe(custodyCount);
    expect(await prisma.registrationApprovalExecution.count()).toBe(approvalCount);
    expect(await service.create({ ...input, passportId: draft.passportId, idempotencyKey: randomUUID() })).toEqual({ outcome: 'ineligible-passport' });
    expect(await prisma.passportMatchAllowance.count({ where: { passportId: draft.passportId } })).toBe(0);

    const read = new AllowanceQuery(prisma as never, authorization, () => now);
    expect(await read.get({ administratorId: active.administratorId, passportId: active.passportId })).toMatchObject({ configuration: { currentRule: { cadence: 'MONTHLY', matchLimit: 4 }, currentPeriod: { start: '2026-10-09', endExclusive: '2026-11-09' } } });
    await prisma.roleAssignment.updateMany({ where: { identityId: active.administratorId }, data: { status: 'REVOKED' } });
    expect(await passports.detail({ administratorId: active.administratorId, passportId: active.passportId })).toEqual({ outcome: 'not-found' });
    expect(await service.create({ ...input, idempotencyKey: randomUUID() })).toEqual({ outcome: 'not-found' });
  });
});
