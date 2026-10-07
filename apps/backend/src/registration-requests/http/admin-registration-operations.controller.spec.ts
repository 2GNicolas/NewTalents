import { HEADERS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';

import { AdminRegistrationOperationsController } from './admin-registration-operations.controller.js';
import { AdminRegistrationReviewController } from './admin-registration-review.controller.js';
import { RegistrationRequestHttpError } from './registration-request-exception.filter.js';

const administratorId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const request = { actor: { identityId: administratorId, sessionId: 'session-1' } };

const groups = [
  { group: 'NEW', total: 0, items: [] },
  { group: 'CONTINUE_REVIEW', total: 0, items: [] },
  { group: 'REQUIRES_CORRECTION', total: 0, items: [] },
  { group: 'READY_FOR_DECISION', total: 0, items: [] },
  { group: 'WAITING_EVIDENCE_DELETION', total: 0, items: [] },
];

describe('AdminRegistrationOperationsController', () => {
  it('returns the authorized five-group workspace with no-store metadata and closed query parsing', async () => {
    const workspace = { list: vi.fn().mockResolvedValue({ outcome: 'found', groups }) };
    const controller = new AdminRegistrationOperationsController(workspace as never);

    await expect(controller.operations(request, { query: 'solicitante', requestType: 'PERSONAL_ADULT' })).resolves.toEqual({ data: { groups } });
    expect(workspace.list).toHaveBeenCalledWith(administratorId, { query: 'solicitante', requestType: 'PERSONAL_ADULT' });
    expect(Reflect.getMetadata(HEADERS_METADATA, controller.operations)).toContainEqual({ name: 'Cache-Control', value: 'no-store' });

    await expect(controller.operations(request, { unexpected: 'value' })).rejects.toMatchObject({ code: 'validation' });
    await expect(controller.operations(request, { query: '' })).rejects.toMatchObject({ code: 'validation' });
  });

  it('denies the collection without exposing workspace data', async () => {
    const controller = new AdminRegistrationOperationsController({ list: vi.fn().mockResolvedValue({ outcome: 'denied' }) } as never);
    await expect(controller.operations(request, {})).rejects.toEqual(expect.objectContaining({ code: 'forbidden' }));
  });

  it('updates current-version progress with a closed OPENED or REVIEWED command and no-store metadata', async () => {
    const card = { requestId, requestVersion: 3, maskedReference: 'SOL-••••-2222', displayLabel: 'Solicitante', requestType: 'PERSONAL_ADULT', operationalGroup: 'CONTINUE_REVIEW', relevantAt: '2026-09-30T12:00:00.000Z', nextAction: 'CONTINUE' };
    const workspace = { updateProgress: vi.fn().mockResolvedValue({ outcome: 'updated', request: card }) };
    const controller = new AdminRegistrationOperationsController(workspace as never);

    await expect(controller.reviewProgress(request, requestId, { expectedRequestVersion: 3, stage: 'OPENED' })).resolves.toEqual({ data: card });
    expect(workspace.updateProgress).toHaveBeenCalledWith(administratorId, requestId, { expectedRequestVersion: 3, stage: 'OPENED' });
    expect(Reflect.getMetadata(HEADERS_METADATA, controller.reviewProgress)).toContainEqual({ name: 'Cache-Control', value: 'no-store' });

    for (const body of [
      { expectedRequestVersion: 3, stage: 'STARTED' },
      { expectedRequestVersion: -1, stage: 'OPENED' },
      { expectedRequestVersion: 3, stage: 'OPENED', extra: true },
    ]) {
      await expect(controller.reviewProgress(request, requestId, body)).rejects.toMatchObject({ code: 'validation' });
    }
  });

  it('maps hidden requests to safe 404 and stale versions to 409 without exposing internals', async () => {
    const updateProgress = vi.fn()
      .mockResolvedValueOnce({ outcome: 'not-found' })
      .mockResolvedValueOnce({ outcome: 'stale' });
    const controller = new AdminRegistrationOperationsController({ updateProgress } as never);

    await expect(controller.reviewProgress(request, requestId, { expectedRequestVersion: 3, stage: 'REVIEWED' })).rejects.toEqual(expect.objectContaining({ code: 'not-found' }));
    await expect(controller.reviewProgress(request, requestId, { expectedRequestVersion: 3, stage: 'REVIEWED' })).rejects.toEqual(expect.objectContaining({ code: 'stale-version' }));
  });

  it('does not duplicate or replace any Feature 006 decision route', () => {
    expect(typeof AdminRegistrationReviewController.prototype.correction).toBe('function');
    expect(typeof AdminRegistrationReviewController.prototype.reject).toBe('function');
    expect(typeof AdminRegistrationReviewController.prototype.approve).toBe('function');
    expect(typeof AdminRegistrationReviewController.prototype.retryDeletion).toBe('function');
    expect('correction' in AdminRegistrationOperationsController.prototype).toBe(false);
    expect('approve' in AdminRegistrationOperationsController.prototype).toBe(false);
  });

  it('uses the existing safe HTTP error contract', () => {
    expect(new RegistrationRequestHttpError('not-found').code).toBe('not-found');
    expect(new RegistrationRequestHttpError('stale-version').code).toBe('stale-version');
  });
});
