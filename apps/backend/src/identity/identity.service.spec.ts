import { describe, expect, it, vi } from 'vitest';

import { IdentityService } from './identity.service.js';

const identity = (overrides: Record<string, unknown> = {}) => ({
  id: '8d5d8f41-91a8-4c52-bd73-2a1db0f45671',
  status: 'ACTIVE',
  createdAt: new Date('2026-09-11T12:00:00.000Z'),
  updatedAt: new Date('2026-09-11T12:00:00.000Z'),
  deactivatedAt: null,
  ...overrides,
});

describe('IdentityService', () => {
  it('creates a unique opaque identity through the internal boundary', async () => {
    const prisma = { identity: { create: vi.fn().mockResolvedValue(identity()) } };
    const service = new IdentityService(prisma as never);

    await expect(service.create()).resolves.toEqual({
      id: '8d5d8f41-91a8-4c52-bd73-2a1db0f45671',
      kind: 'active',
    });
    expect(prisma.identity.create).toHaveBeenCalledWith({ data: {} });
  });

  it('looks up an active identity without exposing persistence fields', async () => {
    const prisma = { identity: { findUnique: vi.fn().mockResolvedValue(identity()) } };
    const service = new IdentityService(prisma as never);

    await expect(service.lookup('8d5d8f41-91a8-4c52-bd73-2a1db0f45671')).resolves.toEqual({
      kind: 'active',
      id: '8d5d8f41-91a8-4c52-bd73-2a1db0f45671',
    });
  });

  it('returns safe outcomes for unknown, malformed, unsupported, and unavailable lookups', async () => {
    const prisma = { identity: { findUnique: vi.fn().mockResolvedValue(null) } };
    const service = new IdentityService(prisma as never);

    await expect(service.lookup('8d5d8f41-91a8-4c52-bd73-2a1db0f45671')).resolves.toEqual({ kind: 'unknown' });
    await expect(service.lookup('not-an-identity')).resolves.toEqual({ kind: 'invalid' });
    await expect(service.lookup(42 as never)).resolves.toEqual({ kind: 'invalid' });

    prisma.identity.findUnique.mockRejectedValueOnce(new Error('database details must remain private'));
    await expect(service.lookup('8d5d8f41-91a8-4c52-bd73-2a1db0f45671')).resolves.toEqual({ kind: 'unavailable' });
  });

  it('inactivates an active identity, preserves its record, and prevents it from being active', async () => {
    const prisma = {
      identity: {
        findUnique: vi.fn().mockResolvedValueOnce(identity()).mockResolvedValueOnce(identity({ status: 'INACTIVE' })),
        update: vi.fn().mockResolvedValue(identity({ status: 'INACTIVE', deactivatedAt: new Date() })),
      },
    };
    const service = new IdentityService(prisma as never);

    await expect(service.inactivate('8d5d8f41-91a8-4c52-bd73-2a1db0f45671')).resolves.toEqual({
      kind: 'inactive',
      id: '8d5d8f41-91a8-4c52-bd73-2a1db0f45671',
    });
    await expect(service.lookup('8d5d8f41-91a8-4c52-bd73-2a1db0f45671')).resolves.toEqual({
      kind: 'inactive',
      id: '8d5d8f41-91a8-4c52-bd73-2a1db0f45671',
    });
    expect(prisma.identity.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: '8d5d8f41-91a8-4c52-bd73-2a1db0f45671' },
      data: expect.objectContaining({ status: 'INACTIVE', deactivatedAt: expect.any(Date) }),
    }));
    expect(prisma.identity).not.toHaveProperty('delete');
  });
});
