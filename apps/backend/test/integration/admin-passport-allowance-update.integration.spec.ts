import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

import { AuthorizationService } from '../../src/authorization/authorization.service.js';
import { AdministratorAllowanceAuthorization } from '../../src/passport-match-allowance/application/administrator-allowance-authorization.js';
import { AllowanceCommand } from '../../src/passport-match-allowance/application/allowance-command.js';
import { AllowanceHistory } from '../../src/passport-match-allowance/application/allowance-history.js';
import { command, fixture, isolatedClient } from './feature-008-fixture.js';

describe('Feature 008 updates and two-Administrator concurrency on isolated PostgreSQL', () => {
  const firstClient = isolatedClient();
  const secondClient = isolatedClient();
  afterAll(async () => { await firstClient.$disconnect(); await secondClient.$disconnect(); });

  it('preserves the current period, fixed activation and append-only old/new history', async () => {
    const row = await fixture(firstClient);
    const now = new Date('2026-10-09T15:00:00.000Z');
    const first = command(firstClient, now);
    const base = { passportId: row.passportId, administratorIdentityId: row.administratorId,
      expectedVersion: 0, idempotencyKey: randomUUID(), cadence: 'MONTHLY' as const,
      matchLimit: 4, expectedActivationDate: '2026-10-09' };
    expect((await first.create(base)).outcome).toBe('applied');
    const update = { passportId: row.passportId, administratorIdentityId: row.administratorId,
      expectedVersion: 1, idempotencyKey: randomUUID(), cadence: 'QUARTERLY' as const, matchLimit: 6 };
    expect(await first.confirm(update)).toMatchObject({ outcome: 'applied', configuration: {
      activatedOn: '2026-10-09', version: 2, currentRule: { cadence: 'MONTHLY', matchLimit: 4 },
      pendingRule: { cadence: 'QUARTERLY', matchLimit: 6, effectiveOn: '2026-11-09' },
    } });
    expect((await first.confirm(update)).outcome).toBe('idempotent');
    expect((await first.confirm({ ...update, matchLimit: 7 })).outcome).toBe('idempotency-conflict');
    expect((await first.confirm({ ...update, idempotencyKey: randomUUID(), matchLimit: 7 })).outcome).toBe('conflict');
    const aggregate = await firstClient.passportMatchAllowance.findUniqueOrThrow({ where: { passportId: row.passportId }, include: { revisions: { orderBy: { sequence: 'asc' } } } });
    expect(aggregate.activatedOn.toISOString().slice(0, 10)).toBe('2026-10-09');
    expect(aggregate.version).toBe(2);
    expect(aggregate.revisions).toHaveLength(2);
    expect(aggregate.revisions[1]).toMatchObject({ sequence: 2, cadence: 'QUARTERLY', matchLimit: 6n,
      previousCadence: 'MONTHLY', previousMatchLimit: 4n, confirmedByIdentityId: row.administratorId });
    const history = new AllowanceHistory(firstClient as never, new AdministratorAllowanceAuthorization(firstClient as never, new AuthorizationService()));
    const page = await history.list({ administratorId: row.administratorId, passportId: row.passportId, limit: 1 });
    expect(page).toMatchObject({ items: [{ sequence: 2, previousRule: { matchLimit: 4 }, newRule: { matchLimit: 6 } }] });
    if (!('nextCursor' in page) || !page.nextCursor) throw new Error('Missing history cursor');
    expect(await history.list({ administratorId: row.administratorId, passportId: row.passportId, limit: 1, cursor: page.nextCursor })).toMatchObject({ items: [{ sequence: 1, previousRule: null }] });
    expect(JSON.stringify(page)).not.toContain(row.administratorId);
  });

  it('lets exactly one same-version Administrator win and requires a fresh version for another confirmation', async () => {
    const row = await fixture(firstClient);
    const at = new Date('2026-10-09T15:00:00.000Z');
    const a = command(firstClient, at);
    const b = command(secondClient, at);
    expect((await a.create({ passportId: row.passportId, administratorIdentityId: row.administratorId,
      expectedVersion: 0, idempotencyKey: randomUUID(), cadence: 'MONTHLY', matchLimit: 2, expectedActivationDate: '2026-10-09' })).outcome).toBe('applied');
    const common = { passportId: row.passportId, expectedVersion: 1, cadence: 'MONTHLY' as const };
    const outcomes = await Promise.all([
      a.confirm({ ...common, administratorIdentityId: row.administratorId, idempotencyKey: randomUUID(), matchLimit: 3 }),
      b.confirm({ ...common, administratorIdentityId: row.otherAdministratorId, idempotencyKey: randomUUID(), matchLimit: 4 }),
    ]);
    expect(outcomes.map((result) => result.outcome).sort()).toEqual(['applied', 'conflict']);
    expect((await firstClient.passportMatchAllowance.findUniqueOrThrow({ where: { passportId: row.passportId } })).version).toBe(2);
    expect(await firstClient.passportMatchAllowanceRevision.count({ where: { allowance: { passportId: row.passportId } } })).toBe(2);
    expect((await b.confirm({ ...common, administratorIdentityId: row.otherAdministratorId, idempotencyKey: randomUUID(), matchLimit: 5 })).outcome).toBe('conflict');
    expect((await b.confirm({ ...common, expectedVersion: 2, administratorIdentityId: row.otherAdministratorId, idempotencyKey: randomUUID(), matchLimit: 5 })).outcome).toBe('applied');
    expect(await firstClient.passportMatchAllowanceRevision.count({ where: { allowance: { passportId: row.passportId } } })).toBe(3);
  });

  it('rolls back creation when a precommit failure is injected', async () => {
    const row = await fixture(firstClient);
    const auth = new AdministratorAllowanceAuthorization(firstClient as never, new AuthorizationService());
    const runner = { executeLocked: async (_passportId: string, operation: (transaction: never) => Promise<unknown>) => firstClient.$transaction(async (transaction) => {
      await operation(transaction as never);
      throw new Error('synthetic precommit failure');
    }) };
    const service = new AllowanceCommand(runner as never, auth, () => new Date('2026-10-09T15:00:00.000Z'));
    expect((await service.create({ passportId: row.passportId, administratorIdentityId: row.administratorId,
      expectedVersion: 0, idempotencyKey: randomUUID(), cadence: 'MONTHLY', matchLimit: 2, expectedActivationDate: '2026-10-09' })).outcome).toBe('unavailable');
    expect(await firstClient.passportMatchAllowance.count({ where: { passportId: row.passportId } })).toBe(0);
    expect(await firstClient.passportMatchAllowanceRevision.count({ where: { allowance: { passportId: row.passportId } } })).toBe(0);
  });
});
