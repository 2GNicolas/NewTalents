import { describe, expect, it, vi } from 'vitest';

import { AdminOperationalWorkspaceService } from './admin-operational-workspace.service.js';
import { AdminReviewProgressService } from './admin-review-progress.service.js';

const administratorId = '11111111-1111-4111-8111-111111111111';
const baseId = '22222222-2222-4222-8222-22222222222';
const at = (minute: number) => new Date(`2026-09-30T12:${String(minute).padStart(2, '0')}:00.000Z`);

const row = (suffix: string, overrides: Record<string, unknown> = {}) => ({
  id: `${baseId}${suffix}`,
  type: 'PERSONAL_ADULT',
  status: 'SUBMITTED',
  version: 3,
  approvalExecutionStatus: 'NONE',
  submittedAt: at(1),
  createdAt: at(0),
  updatedAt: at(2),
  adminReviewProgress: null,
  ...overrides,
});

describe('AdminOperationalWorkspaceService', () => {
  it('derives all five groups with the exact precedence and next actions', async () => {
    const rows = [
      row('1', { approvalExecutionStatus: 'DELETING_EVIDENCE', status: 'REQUIRES_CORRECTION' }),
      row('2', { status: 'REQUIRES_CORRECTION', adminReviewProgress: { stage: 'REVIEWED', observedRequestVersion: 3 } }),
      row('3', { adminReviewProgress: { stage: 'REVIEWED', observedRequestVersion: 3 } }),
      row('4', { adminReviewProgress: { stage: 'OPENED', observedRequestVersion: 3 } }),
      row('5', { adminReviewProgress: { stage: 'REVIEWED', observedRequestVersion: 2 } }),
      row('6', { approvalExecutionStatus: 'RECOVERY_REQUIRED' }),
    ];
    const prisma = { registrationRequest: { findMany: vi.fn().mockResolvedValue(rows) } };
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }) };
    const service = new AdminOperationalWorkspaceService(prisma as never, authorization as never, {} as never);

    const result = await service.list(administratorId, {});

    expect(result).toMatchObject({ outcome: 'found' });
    if (result.outcome !== 'found') throw new Error('expected workspace');
    expect(result.groups.map(({ group, total }) => [group, total])).toEqual([
      ['NEW', 1],
      ['CONTINUE_REVIEW', 1],
      ['REQUIRES_CORRECTION', 1],
      ['READY_FOR_DECISION', 1],
      ['WAITING_EVIDENCE_DELETION', 2],
    ]);
    expect(result.groups.flatMap(({ items }) => items).map(({ operationalGroup, nextAction }) => [operationalGroup, nextAction])).toEqual([
      ['NEW', 'REVIEW'],
      ['CONTINUE_REVIEW', 'CONTINUE'],
      ['REQUIRES_CORRECTION', 'VIEW_CORRECTION'],
      ['READY_FOR_DECISION', 'DECIDE'],
      ['WAITING_EVIDENCE_DELETION', 'VIEW_DELETION'],
      ['WAITING_EVIDENCE_DELETION', 'VIEW_DELETION'],
    ]);
  });

  it('excludes terminal requests, preserves type filtering, and projects minimum safe cards', async () => {
    const terminal = [row('7', { status: 'APPROVED' }), row('8', { status: 'REJECTED' })];
    const current = row('9', { type: 'FORMAL_ACADEMY' });
    const prisma = { registrationRequest: { findMany: vi.fn().mockResolvedValue([current, ...terminal]) } };
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }) };
    const service = new AdminOperationalWorkspaceService(prisma as never, authorization as never, {} as never);

    const result = await service.list(administratorId, { requestType: 'FORMAL_ACADEMY', query: '2229' });

    expect(prisma.registrationRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ type: 'FORMAL_ACADEMY', status: { in: ['SUBMITTED', 'REQUIRES_CORRECTION'] } }),
    }));
    if (result.outcome !== 'found') throw new Error('expected workspace');
    const cards = result.groups.flatMap(({ items }) => items);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toEqual({
      requestId: current.id,
      requestVersion: 3,
      maskedReference: 'SOL-••••-2229',
      displayLabel: 'Academia solicitante',
      requestType: 'FORMAL_ACADEMY',
      operationalGroup: 'NEW',
      relevantAt: at(1).toISOString(),
      nextAction: 'REVIEW',
    });
    expect(JSON.stringify(result)).not.toMatch(/encrypted|documentNumber|objectKey|email|phone/i);
  });

  it('fails closed when the Administrator list capability is absent', async () => {
    const prisma = { registrationRequest: { findMany: vi.fn() } };
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: false }) };
    const service = new AdminOperationalWorkspaceService(prisma as never, authorization as never, {} as never);

    await expect(service.list(administratorId, {})).resolves.toEqual({ outcome: 'denied' });
    expect(prisma.registrationRequest.findMany).not.toHaveBeenCalled();
  });
});

describe('AdminReviewProgressService', () => {
  const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }) };

  it('records OPENED then REVIEWED monotonically for the current request version without lifecycle events', async () => {
    const upsert = vi.fn()
      .mockResolvedValueOnce({ stage: 'OPENED', observedRequestVersion: 3, startedByIdentityId: administratorId, lastUpdatedByIdentityId: administratorId, startedAt: at(3), updatedAt: at(3) })
      .mockResolvedValueOnce({ stage: 'REVIEWED', observedRequestVersion: 3, startedByIdentityId: administratorId, lastUpdatedByIdentityId: administratorId, startedAt: at(3), updatedAt: at(4) });
    const findUnique = vi.fn()
      .mockResolvedValueOnce(row('1'))
      .mockResolvedValueOnce(row('1', { adminReviewProgress: { stage: 'OPENED', observedRequestVersion: 3, startedByIdentityId: administratorId, startedAt: at(3) } }));
    const transaction = { registrationRequest: { findUnique }, registrationAdminReviewProgress: { upsert }, registrationRequestEvent: { create: vi.fn() } };
    const prisma = { $transaction: vi.fn(async (callback) => callback(transaction)) };
    const service = new AdminReviewProgressService(prisma as never, authorization as never);

    await expect(service.update({ administratorIdentityId: administratorId, requestId: row('1').id, expectedRequestVersion: 3, stage: 'OPENED' })).resolves.toMatchObject({ outcome: 'updated', request: { adminReviewProgress: { stage: 'OPENED' } } });
    await expect(service.update({ administratorIdentityId: administratorId, requestId: row('1').id, expectedRequestVersion: 3, stage: 'REVIEWED' })).resolves.toMatchObject({ outcome: 'updated', request: { adminReviewProgress: { stage: 'REVIEWED' } } });
    expect(transaction.registrationRequestEvent.create).not.toHaveBeenCalled();
  });

  it('does not regress REVIEWED to OPENED within one version', async () => {
    const prior = { stage: 'REVIEWED', observedRequestVersion: 3, startedByIdentityId: administratorId, startedAt: at(3) };
    const current = row('2', { adminReviewProgress: prior });
    const upsert = vi.fn().mockResolvedValue({ ...prior, lastUpdatedByIdentityId: administratorId, updatedAt: at(5) });
    const transaction = { registrationRequest: { findUnique: vi.fn().mockResolvedValue(current) }, registrationAdminReviewProgress: { upsert } };
    const prisma = { $transaction: vi.fn(async (callback) => callback(transaction)) };
    const service = new AdminReviewProgressService(prisma as never, authorization as never);

    const result = await service.update({ administratorIdentityId: administratorId, requestId: current.id, expectedRequestVersion: 3, stage: 'OPENED' });

    expect(result).toMatchObject({ outcome: 'updated', request: { adminReviewProgress: { stage: 'REVIEWED' } } });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ stage: 'REVIEWED' }) }));
  });

  it('resets old-version progress and rejects stale commands or hidden requests safely', async () => {
    const prior = { stage: 'REVIEWED', observedRequestVersion: 2, startedByIdentityId: administratorId, startedAt: at(2) };
    const current = row('3', { version: 3, adminReviewProgress: prior });
    const upsert = vi.fn().mockResolvedValue({ stage: 'OPENED', observedRequestVersion: 3, startedByIdentityId: administratorId, lastUpdatedByIdentityId: administratorId, startedAt: at(6), updatedAt: at(6) });
    const transaction = { registrationRequest: { findUnique: vi.fn().mockResolvedValue(current) }, registrationAdminReviewProgress: { upsert } };
    const prisma = { $transaction: vi.fn(async (callback) => callback(transaction)) };
    const service = new AdminReviewProgressService(prisma as never, authorization as never);

    await expect(service.update({ administratorIdentityId: administratorId, requestId: current.id, expectedRequestVersion: 3, stage: 'OPENED' })).resolves.toMatchObject({ outcome: 'updated', request: { adminReviewProgress: { observedRequestVersion: 3, stage: 'OPENED' } } });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ observedRequestVersion: 3, stage: 'OPENED', startedByIdentityId: administratorId }) }));

    transaction.registrationRequest.findUnique.mockResolvedValueOnce(row('3', { version: 4 }));
    await expect(service.update({ administratorIdentityId: administratorId, requestId: current.id, expectedRequestVersion: 3, stage: 'REVIEWED' })).resolves.toEqual({ outcome: 'stale' });
    authorization.authorize.mockResolvedValueOnce({ allowed: false });
    await expect(service.update({ administratorIdentityId: administratorId, requestId: current.id, expectedRequestVersion: 4, stage: 'REVIEWED' })).resolves.toEqual({ outcome: 'not-found' });
  });
});
