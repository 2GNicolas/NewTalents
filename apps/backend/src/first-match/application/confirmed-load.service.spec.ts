import { randomUUID } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { ConfirmedLoadService } from './confirmed-load.service.js';
import { FirstMatchController } from '../http/first-match.controller.js';

const passportId = randomUUID();
const matchId = randomUUID();
const analystIdentityId = randomUUID();
const loadId = randomUUID();
const input = { passportId, matchId, analystIdentityId, loadId, expectedVersion: 1,
  confirmedAt: new Date('2026-10-13T15:00:00.000Z') };

describe('trusted first-match load boundary', () => {
  it('is not a public first-match controller operation', () => {
    expect(Object.getOwnPropertyNames(FirstMatchController.prototype)).not.toContain('confirmFirstMatchDataLoad');
  });
  it('requires a caller-owned serializable transaction and a matching durable confirmation verifier', async () => {
    const lockInTransaction = vi.fn().mockResolvedValue(true);
    const transaction = {
      firstMatch: { findFirst: vi.fn().mockResolvedValue({ id: matchId, passportId, state: 'WAITING', unitState: 'RESERVED', version: 1 }),
        update: vi.fn().mockResolvedValue({ id: matchId }) },
      passportCustody: { findUnique: vi.fn().mockResolvedValue({ currentAnalystIdentityId: analystIdentityId }) },
      analystOperationalProfile: { findFirst: vi.fn().mockResolvedValue({ identityId: analystIdentityId }) },
      firstMatchIntent: { create: vi.fn() },
    };
    const service = new ConfirmedLoadService({ lockInTransaction } as never);
    const verifyConfirmedData = vi.fn().mockResolvedValue({ matchId, loadId });
    await expect(service.confirmFirstMatchDataLoad(transaction as never, input, verifyConfirmedData))
      .resolves.toMatchObject({ outcome: 'applied', matchId });
    expect(lockInTransaction).toHaveBeenCalledWith(transaction, passportId);
    expect(verifyConfirmedData).toHaveBeenCalledWith(transaction, { matchId, loadId });
    expect(transaction.firstMatch.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ state: 'LOADED', unitState: 'USED', loadId, loadedByAnalystIdentityId: analystIdentityId }),
    }));
  });

  it('rejects absent, failed, foreign or mismatched confirmation without changing consumption', async () => {
    const transaction = {
      firstMatch: { findFirst: vi.fn().mockResolvedValue({ id: matchId, passportId, state: 'WAITING', unitState: 'RESERVED', version: 1 }), update: vi.fn() },
      passportCustody: { findUnique: vi.fn().mockResolvedValue({ currentAnalystIdentityId: analystIdentityId }) },
      analystOperationalProfile: { findFirst: vi.fn().mockResolvedValue({ identityId: analystIdentityId }) },
      firstMatchIntent: { create: vi.fn() },
    };
    const service = new ConfirmedLoadService({ lockInTransaction: vi.fn().mockResolvedValue(true) } as never);
    for (const proof of [null, { matchId: randomUUID(), loadId }, { matchId, loadId: randomUUID() }]) {
      await expect(service.confirmFirstMatchDataLoad(transaction as never, input, vi.fn().mockResolvedValue(proof)))
        .rejects.toMatchObject({ outcome: 'unconfirmed' });
    }
    expect(transaction.firstMatch.update).not.toHaveBeenCalled();
    expect(transaction.firstMatchIntent.create).not.toHaveBeenCalled();
  });
});
