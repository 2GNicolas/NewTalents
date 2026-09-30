import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import { ApplicantRequestService } from './applicant-request.service.js';

const identityId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const key = '33333333-3333-4333-8333-333333333333';

function dependencies() {
  const typed = { create: vi.fn().mockResolvedValue({ outcome: 'created', requestId }), update: vi.fn().mockResolvedValue({ outcome: 'updated' }), readiness: vi.fn().mockResolvedValue({ ageRouteCompatible: true, representationComplete: true }) };
  const repository = { listOwned: vi.fn().mockResolvedValue({ items: [] }), listAcademy: vi.fn().mockResolvedValue({ items: [] }), findIdempotentResult: vi.fn().mockResolvedValue(null) };
  const prisma = { registrationRequest: { findUnique: vi.fn().mockResolvedValue({ id: requestId, type: 'PERSONAL_ADULT', status: 'DRAFT', version: 0, createdAt: new Date(), submittedAt: null, latestSafeReason: null, evidenceItems: [], corrections: [], deletionRecords: [] }) }, registrationEvidenceItem: { findFirst: vi.fn().mockResolvedValue(null), aggregate: vi.fn().mockResolvedValue({ _sum: { sizeBytes: 0 } }), create: vi.fn() } };
  const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }), projectCapabilities: vi.fn().mockResolvedValue(['registration.request.own.view']) };
  const lifecycle = { update: vi.fn().mockResolvedValue({ outcome: 'applied', snapshot: { id: requestId } }), submit: vi.fn().mockResolvedValue({ outcome: 'applied', snapshot: { id: requestId } }), resubmit: vi.fn().mockResolvedValue({ outcome: 'applied', snapshot: { id: requestId } }) };
  const history = { applicantHistory: vi.fn().mockResolvedValue([]) };
  const ingestion = { ingest: vi.fn().mockResolvedValue({ outcome: 'clean', projection: { status: 'CLEAN', sizeBytes: 10, declaredMime: 'application/pdf', detectedMime: 'application/pdf' }, internal: { objectKey: 'evidence/0123456789abcdef0123456789abcdef', contentDigest: 'digest' } }) };
  const deletion = { replaceCorrectedEvidence: vi.fn().mockResolvedValue({ outcome: 'replaced', evidenceId: 'replacement-1' }) };
  return { typed, repository, prisma, authorization, lifecycle, history, ingestion, deletion };
}

describe('ApplicantRequestService', () => {
  it('delegates typed public creation without projecting credentials', async () => {
    const deps = dependencies();
    const service = new ApplicantRequestService(deps.typed as never, deps.repository as never, deps.prisma as never, deps.authorization as never, deps.lifecycle as never, deps.history as never, deps.ingestion as never, deps.deletion as never);
    const payload = { credentials: { email: 'person@example.com', password: 'secret-value', passwordConfirmation: 'secret-value' } };
    await expect(service.createPublic('PERSONAL_ADULT', payload)).resolves.toMatchObject({ outcome: 'created', requestId, data: { id: requestId, capabilities: [] } });
    expect(deps.typed.create).toHaveBeenCalledWith({ type: 'PERSONAL_ADULT', payload });
    expect(JSON.stringify(await service.createPublic('PERSONAL_ADULT', payload))).not.toContain('secret-value');
  });

  it('uses backend ownership facts and returns indistinguishable not-found denial', async () => {
    const deps = dependencies();
    deps.authorization.authorize.mockResolvedValueOnce({ allowed: false });
    const service = new ApplicantRequestService(deps.typed as never, deps.repository as never, deps.prisma as never, deps.authorization as never, deps.lifecycle as never, deps.history as never, deps.ingestion as never, deps.deletion as never);
    await expect(service.detailOwn(identityId, requestId)).resolves.toEqual({ outcome: 'not-found' });
  });

  it('lists only the backend-authorized academy context', async () => {
    const deps = dependencies();
    const academyId = '44444444-4444-4444-8444-444444444444';
    const service = new ApplicantRequestService(deps.typed as never, deps.repository as never, deps.prisma as never, deps.authorization as never, deps.lifecycle as never, deps.history as never, deps.ingestion as never, deps.deletion as never);
    await expect(service.listAcademy(identityId, academyId, { limit: 20 })).resolves.toEqual({ items: [] });
    expect(deps.authorization.authorize).toHaveBeenCalledWith({ identityId, permission: 'registration.request.academy.list', academyId });
    expect(deps.repository.listAcademy).toHaveBeenCalledWith(academyId, { limit: 20 });
  });

  it('projects submit for a ready represented-minor draft using the same server facts as the transition', async () => {
    const deps = dependencies();
    const categories = ['IDENTITY_FRONT', 'IDENTITY_BACK', 'MINOR_CIVIL_IDENTITY', 'REPRESENTATION_AUTHORITY'];
    deps.prisma.registrationRequest.findUnique.mockResolvedValue({
      id: requestId, type: 'REPRESENTED_MINOR', status: 'DRAFT', version: 0,
      createdAt: new Date('2026-09-28T17:33:11.944Z'), submittedAt: null, latestSafeReason: null,
      evidenceItems: categories.map((category, index) => ({ id: `e-${index}`, category, status: 'CLEAN', sizeBytes: 128 })),
      corrections: [], deletionRecords: [],
    });
    deps.authorization.projectCapabilities.mockImplementation(async (facts) =>
      facts.evidenceCompleteAndClean && facts.ageRouteCompatible && facts.representationComplete
        ? ['registration.request.own.view', 'registration.request.own.submit']
        : ['registration.request.own.view']);
    const service = new ApplicantRequestService(deps.typed as never, deps.repository as never, deps.prisma as never, deps.authorization as never, deps.lifecycle as never, deps.history as never, deps.ingestion as never, deps.deletion as never);

    const result = await service.detailOwn(identityId, requestId);

    expect(result).toMatchObject({ outcome: 'found', request: { status: 'DRAFT', version: 0, capabilities: ['registration.request.own.view', 'registration.request.own.submit'] } });
    expect(deps.authorization.projectCapabilities).toHaveBeenCalledWith(expect.objectContaining({ identityId, requestId, expectedVersion: 0, evidenceCompleteAndClean: true, ageRouteCompatible: true, representationComplete: true }), expect.any(Array));
  });

  it('submits and resubmits only after authorization and server-derived readiness', async () => {
    const deps = dependencies();
    const service = new ApplicantRequestService(deps.typed as never, deps.repository as never, deps.prisma as never, deps.authorization as never, deps.lifecycle as never, deps.history as never, deps.ingestion as never, deps.deletion as never);
    await expect(service.submit(identityId, requestId, { expectedVersion: 0, idempotencyKey: key })).resolves.toMatchObject({ outcome: 'applied' });
    await expect(service.resubmit(identityId, requestId, { expectedVersion: 0, idempotencyKey: key })).resolves.toMatchObject({ outcome: 'applied' });
    expect(deps.typed.readiness).toHaveBeenCalledTimes(2);
  });

  it('returns an owned prior transition before status/version authorization rejects an idempotent retry', async () => {
    const deps = dependencies();
    deps.repository.findIdempotentResult.mockResolvedValue({ id: requestId, type: 'PERSONAL_ADULT', status: 'SUBMITTED', version: 1, approvalExecutionStatus: 'NONE' });
    const service = new ApplicantRequestService(deps.typed as never, deps.repository as never, deps.prisma as never, deps.authorization as never, deps.lifecycle as never, deps.history as never, deps.ingestion as never, deps.deletion as never);

    await expect(service.submit(identityId, requestId, { expectedVersion: 0, idempotencyKey: key })).resolves.toMatchObject({ outcome: 'idempotent', snapshot: { status: 'SUBMITTED', version: 1 } });
    expect(deps.authorization.authorize).toHaveBeenCalledWith({ identityId, permission: 'registration.request.own.view', requestId });
    expect(deps.lifecycle.submit).not.toHaveBeenCalled();
  });

  it('persists only internal evidence metadata while returning a safe projection', async () => {
    const deps = dependencies();
    const service = new ApplicantRequestService(deps.typed as never, deps.repository as never, deps.prisma as never, deps.authorization as never, deps.lifecycle as never, deps.history as never, deps.ingestion as never, deps.deletion as never);
    deps.prisma.registrationEvidenceItem.create.mockResolvedValue({ id: 'e1', category: 'IDENTITY_FRONT', status: 'CLEAN', sizeBytes: 10 });
    const result = await service.uploadEvidence(identityId, requestId, { expectedVersion: 0, category: 'IDENTITY_FRONT', fileName: 'canary.pdf', declaredMime: 'application/pdf', body: Readable.from('%PDF-canary') });
    expect(result).toEqual({ outcome: 'created', evidence: { id: 'e1', category: 'IDENTITY_FRONT', status: 'CLEAN', sizeBytes: 10 } });
    expect(JSON.stringify(result)).not.toMatch(/objectKey|contentDigest|evidence\//);
  });

  it('returns the current clean category on an upload retry without ingesting duplicate evidence', async () => {
    const deps = dependencies();
    deps.prisma.registrationEvidenceItem.findFirst.mockResolvedValue({ id: 'existing', category: 'IDENTITY_FRONT', status: 'CLEAN', sizeBytes: 10, uploadedAt: new Date() });
    const service = new ApplicantRequestService(deps.typed as never, deps.repository as never, deps.prisma as never, deps.authorization as never, deps.lifecycle as never, deps.history as never, deps.ingestion as never, deps.deletion as never);

    await expect(service.uploadEvidence(identityId, requestId, { expectedVersion: 0, category: 'IDENTITY_FRONT', fileName: 'retry.pdf', declaredMime: 'application/pdf', body: Readable.from('%PDF-retry') })).resolves.toEqual({
      outcome: 'created', evidence: { id: 'existing', category: 'IDENTITY_FRONT', status: 'CLEAN', sizeBytes: 10 },
    });
    expect(deps.ingestion.ingest).not.toHaveBeenCalled();
    expect(deps.prisma.registrationEvidenceItem.create).not.toHaveBeenCalled();
  });

  it('projects only safe correction reason and explicitly permitted evidence categories', async () => {
    const deps = dependencies();
    deps.prisma.registrationRequest.findUnique.mockResolvedValue({
      id: requestId, type: 'PERSONAL_ADULT', status: 'REQUIRES_CORRECTION', version: 3,
      createdAt: new Date('2026-09-23T12:00:00Z'), submittedAt: new Date('2026-09-23T12:05:00Z'),
      latestSafeReason: 'Carga un reverso más nítido.',
      corrections: [{ correctionTargets: ['IDENTITY_BACK'] }],
      evidenceItems: [
        { id: 'front', category: 'IDENTITY_FRONT', status: 'CLEAN', sizeBytes: 10 },
        { id: 'back', category: 'IDENTITY_BACK', status: 'CLEAN', sizeBytes: 10 },
      ],
      deletionRecords: [],
    });
    const service = new ApplicantRequestService(deps.typed as never, deps.repository as never, deps.prisma as never, deps.authorization as never, deps.lifecycle as never, deps.history as never, deps.ingestion as never, deps.deletion as never);

    await expect(service.detailOwn(identityId, requestId)).resolves.toMatchObject({ outcome: 'found', request: {
      safeReason: 'Carga un reverso más nítido.',
      evidence: [
        { id: 'front', correctionRequired: false },
        { id: 'back', correctionRequired: true },
      ],
    } });
  });

  it('routes a clean correction upload through atomic evidence replacement', async () => {
    const deps = dependencies();
    deps.prisma.registrationRequest.findUnique.mockResolvedValue({ status: 'REQUIRES_CORRECTION', version: 3, corrections: [{ correctionTargets: ['IDENTITY_BACK'] }] });
    const service = new ApplicantRequestService(deps.typed as never, deps.repository as never, deps.prisma as never, deps.authorization as never, deps.lifecycle as never, deps.history as never, deps.ingestion as never, deps.deletion as never);

    await expect(service.uploadEvidence(identityId, requestId, { expectedVersion: 3, category: 'IDENTITY_BACK', fileName: 'replacement.pdf', declaredMime: 'application/pdf', body: Readable.from('%PDF-replacement') })).resolves.toEqual({
      outcome: 'created', evidence: { id: 'replacement-1', category: 'IDENTITY_BACK', status: 'CLEAN', sizeBytes: 10 },
    });
    expect(deps.deletion.replaceCorrectedEvidence).toHaveBeenCalledWith(expect.objectContaining({ actorIdentityId: identityId, requestId, expectedVersion: 3, category: 'IDENTITY_BACK' }));
    expect(deps.prisma.registrationEvidenceItem.create).not.toHaveBeenCalled();
  });

  it('rejects an unrelated correction category before ingesting or mutating evidence', async () => {
    const deps = dependencies();
    deps.prisma.registrationRequest.findUnique.mockResolvedValue({ status: 'REQUIRES_CORRECTION', version: 3, corrections: [{ correctionTargets: ['IDENTITY_BACK'] }] });
    const service = new ApplicantRequestService(deps.typed as never, deps.repository as never, deps.prisma as never, deps.authorization as never, deps.lifecycle as never, deps.history as never, deps.ingestion as never, deps.deletion as never);

    await expect(service.uploadEvidence(identityId, requestId, { expectedVersion: 3, category: 'IDENTITY_FRONT', fileName: 'unrelated.pdf', declaredMime: 'application/pdf', body: Readable.from('%PDF-unrelated') })).resolves.toEqual({ outcome: 'not-found' });
    expect(deps.ingestion.ingest).not.toHaveBeenCalled();
    expect(deps.deletion.replaceCorrectedEvidence).not.toHaveBeenCalled();
    expect(deps.prisma.registrationEvidenceItem.create).not.toHaveBeenCalled();
  });
});
