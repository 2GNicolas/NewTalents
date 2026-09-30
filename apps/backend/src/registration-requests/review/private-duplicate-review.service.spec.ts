import { beforeAll, describe, expect, it, vi } from 'vitest';

const servicePath: string = './private-duplicate-review.service.js';
let Service: new (...dependencies: any[]) => any;

beforeAll(async () => {
  const module = await vi.importActual<Record<string, unknown>>(servicePath);
  Service = module.PrivateDuplicateReviewService as typeof Service;
});

describe('PrivateDuplicateReviewService contract', () => {
  it.each([
    [[], { state: 'CLEAR', canApprove: true }],
    [[{ status: 'OPEN' }], { state: 'REVIEW_REQUIRED', canApprove: false }],
    [[{ status: 'DISTINCT' }], { state: 'RESOLVED_DISTINCT', canApprove: true }],
    [[{ status: 'CONFIRMED_CONFLICT' }], { state: 'CONFLICT', canApprove: false }],
  ])('projects the controlled review state without candidate data', async (signals, expected) => {
    const prisma = { registrationPrivateDuplicateSignal: { findMany: vi.fn().mockResolvedValue(signals) } };
    const service = new Service(prisma, { authorize: vi.fn().mockResolvedValue({ allowed: true }) });
    const result = await service.read('admin', 'request');
    expect(result).toEqual(expected);
    expect(JSON.stringify(result)).not.toMatch(/candidate|document|fingerprint|representative|internal/i);
  });

  it('records a distinct resolution by an authorized Admin and blocks confirmed conflict approval', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const service = new Service({ registrationPrivateDuplicateSignal: { updateMany } }, { authorize: vi.fn().mockResolvedValue({ allowed: true }) });
    await expect(service.resolveDistinct('admin', 'request')).resolves.toEqual({ state: 'RESOLVED_DISTINCT', canApprove: true });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'DISTINCT', resolvedByIdentityId: 'admin' }) }));
    await expect(service.approvalFact('request', [{ status: 'CONFIRMED_CONFLICT' }])).resolves.toBe(false);
  });

  it('returns only the generic applicant conflict result', async () => {
    const service = new Service({}, {});
    expect(service.applicantConflict()).toEqual({ code: 'REGISTRATION_CONFLICT' });
  });
});
