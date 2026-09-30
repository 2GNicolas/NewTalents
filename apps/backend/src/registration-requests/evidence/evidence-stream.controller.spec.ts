import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../database/prisma.service.js';
import type { RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';
import { EvidenceAccessAuditService } from './evidence-access-audit.service.js';
import { EvidenceStreamController } from './evidence-stream.controller.js';
import type { EvidenceObjectKey, PrivateEvidenceStore } from './private-evidence-store.js';

const actorId = '10000000-0000-4000-8000-000000000001';
const sessionId = '90000000-0000-4000-8000-000000000009';
const requestId = '20000000-0000-4000-8000-000000000002';
const evidenceId = '30000000-0000-4000-8000-000000000003';
const objectKey = 'A'.repeat(43) as EvidenceObjectKey;

function response() {
  const headers = new Map<string, string>();
  return { headers, statusCode: 200, setHeader(name: string, value: string) { headers.set(name, value); return this; }, status(code: number) { this.statusCode = code; return this; } };
}

function setup(allowed = true) {
  const evidence = { id: evidenceId, requestId, category: 'IDENTITY_FRONT', objectKey, declaredMime: 'application/pdf', detectedMime: 'application/pdf', request: { version: 4, status: 'SUBMITTED' } };
  const prisma = {
    registrationEvidenceItem: { findFirst: vi.fn().mockResolvedValue(evidence) },
    registrationEvidenceAccessAudit: { create: vi.fn().mockResolvedValue({ id: 'audit' }) },
    registrationRequestEvent: { create: vi.fn() },
    registrationRequest: { update: vi.fn() },
  } as unknown as PrismaService;
  const authorization = { authorize: vi.fn().mockResolvedValue(allowed ? { allowed: true } : { allowed: false, reason: 'no-active-role' }) } as unknown as RegistrationAuthorizationAdapter;
  const store: PrivateEvidenceStore = {
    put: vi.fn(), delete: vi.fn(), exists: vi.fn(), listOrphanCandidates: vi.fn(),
    openStream: vi.fn().mockResolvedValue(Readable.from(['synthetic-evidence'])),
  };
  const audit = new EvidenceAccessAuditService(prisma);
  const controller = new EvidenceStreamController(prisma, authorization, store, audit);
  return { controller, prisma: prisma as any, authorization: authorization as any, store, audit, evidence };
}

describe('EvidenceStreamController', () => {
  it('reauthorizes every access and streams only current CLEAN submitted evidence with safe headers and filename', async () => {
    const { controller, authorization, prisma } = setup();
    for (let index = 0; index < 2; index += 1) {
      const res = response();
      const result = await controller.stream({ actor: { identityId: actorId, sessionId } }, requestId, evidenceId, res);
      expect(result).toHaveProperty('getStream');
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('Content-Disposition')).toBe('inline; filename="identity-front.pdf"');
      expect(JSON.stringify(result)).not.toMatch(/objectKey|bucket|digest|path|s3/i);
    }
    expect(authorization.authorize).toHaveBeenCalledTimes(2);
    expect(prisma.registrationEvidenceAccessAudit.create).toHaveBeenCalledTimes(2);
    expect(prisma.registrationRequestEvent.create).not.toHaveBeenCalled();
    expect(prisma.registrationRequest.update).not.toHaveBeenCalled();
  });

  it.each(['applicant', 'analyst', 'academy', 'public'])('safely denies %s without opening evidence and audits the attempt', async () => {
    const { controller, store, prisma } = setup(false);
    const res = response();
    await expect(controller.stream({ actor: { identityId: actorId, sessionId } }, requestId, evidenceId, res)).resolves.toEqual({ code: 'evidence_not_found', message: 'Evidence not found' });
    expect(res.statusCode).toBe(404);
    expect(store.openStream).not.toHaveBeenCalled();
    expect(prisma.registrationEvidenceAccessAudit.create).toHaveBeenCalledWith({ data: expect.objectContaining({ outcome: 'DENIED' }) });
  });

  it('denies superseded, non-clean, non-submitted, or missing provider objects without leaking storage details', async () => {
    const { controller, prisma, store } = setup();
    prisma.registrationEvidenceItem.findFirst.mockResolvedValueOnce(null);
    const first = response();
    await expect(controller.stream({ actor: { identityId: actorId, sessionId } }, requestId, evidenceId, first)).resolves.toEqual({ code: 'evidence_not_found', message: 'Evidence not found' });
    expect(first.statusCode).toBe(404);

    store.openStream = vi.fn().mockResolvedValue(null);
    const second = response();
    await expect(controller.stream({ actor: { identityId: actorId, sessionId } }, requestId, evidenceId, second)).resolves.toEqual({ code: 'evidence_not_found', message: 'Evidence not found' });
    expect(JSON.stringify(prisma.registrationEvidenceAccessAudit.create.mock.calls)).not.toContain(objectKey);
  });

  it('makes completed-deletion retrieval indistinguishable and never opens the provider object', async () => {
    const { controller, prisma, store, evidence } = setup();
    prisma.registrationEvidenceItem.findFirst
      .mockReset()
      .mockResolvedValueOnce(evidence)
      .mockResolvedValueOnce(null);

    const res = response();
    const result = await controller.stream(
      { actor: { identityId: actorId, sessionId } },
      requestId,
      evidenceId,
      res,
    );

    expect(result).toEqual({ code: 'evidence_not_found', message: 'Evidence not found' });
    expect(res.statusCode).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(store.openStream).not.toHaveBeenCalled();
    expect(prisma.registrationEvidenceAccessAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ outcome: 'NOT_FOUND' }),
    });
    expect(JSON.stringify(result)).not.toMatch(/objectKey|bucket|digest|path|s3/i);
  });
});
