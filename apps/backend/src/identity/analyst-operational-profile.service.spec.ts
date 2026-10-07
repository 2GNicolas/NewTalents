import { describe, expect, it, vi } from 'vitest';

import { AnalystOperationalProfileService } from './analyst-operational-profile.service.js';

const identityId = '11111111-1111-4111-8111-111111111111';

const eligibleIdentity = () => ({
  id: identityId,
  status: 'ACTIVE',
  roleAssignments: [{ id: 'role-1' }],
});

const prismaDouble = (overrides: Record<string, unknown> = {}) => ({
  identity: { findUnique: vi.fn().mockResolvedValue(eligibleIdentity()) },
  analystOperationalProfile: {
    findUnique: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockImplementation(async ({ create }: { create: Record<string, unknown> }) => create),
  },
  ...overrides,
});

describe('AnalystOperationalProfileService', () => {
  it('provisions a trimmed safe label and a deterministic normalized label', async () => {
    const prisma = prismaDouble();
    const service = new AnalystOperationalProfileService(prisma as never);

    await expect(service.provision({ identityId, displayLabel: '  Analista Ágil  ' })).resolves.toEqual({
      outcome: 'provisioned',
      profile: { identityId, displayLabel: 'Analista Ágil', normalizedLabel: 'analista agil' },
    });
    expect(prisma.analystOperationalProfile.upsert).toHaveBeenCalledWith({
      where: { identityId },
      create: { identityId, displayLabel: 'Analista Ágil', normalizedLabel: 'analista agil' },
      update: { displayLabel: 'Analista Ágil', normalizedLabel: 'analista agil' },
      select: { identityId: true, displayLabel: true, normalizedLabel: true },
    });
  });

  it.each([
    '',
    ' '.repeat(5),
    'A'.repeat(121),
    'analyst@example.test',
    'CC 123456789',
    'password temporal',
    'token secreto',
  ])('rejects empty, excessive, credential-like, or identity-document labels: %s', async (displayLabel) => {
    const prisma = prismaDouble();
    const service = new AnalystOperationalProfileService(prisma as never);

    await expect(service.provision({ identityId, displayLabel })).resolves.toEqual({ outcome: 'invalid-label' });
    expect(prisma.identity.findUnique).not.toHaveBeenCalled();
    expect(prisma.analystOperationalProfile.upsert).not.toHaveBeenCalled();
  });

  it('is idempotent when the controlled label is already current', async () => {
    const profile = { identityId, displayLabel: 'Analista Norte', normalizedLabel: 'analista norte' };
    const prisma = prismaDouble({
      analystOperationalProfile: {
        findUnique: vi.fn().mockResolvedValue(profile),
        upsert: vi.fn(),
      },
    });
    const service = new AnalystOperationalProfileService(prisma as never);

    await expect(service.provision({ identityId, displayLabel: 'Analista Norte' })).resolves.toEqual({ outcome: 'unchanged', profile });
    expect(prisma.analystOperationalProfile.upsert).not.toHaveBeenCalled();
  });

  it('fails closed for an inactive identity or a missing/revoked ANALYST assignment', async () => {
    for (const identity of [
      { ...eligibleIdentity(), status: 'INACTIVE' },
      { ...eligibleIdentity(), roleAssignments: [] },
      null,
    ]) {
      const prisma = prismaDouble({ identity: { findUnique: vi.fn().mockResolvedValue(identity) } });
      const service = new AnalystOperationalProfileService(prisma as never);
      await expect(service.provision({ identityId, displayLabel: 'Analista Seguro' })).resolves.toEqual({ outcome: 'ineligible' });
      await expect(service.lookup(identityId)).resolves.toEqual({ outcome: 'unavailable' });
      expect(prisma.analystOperationalProfile.upsert).not.toHaveBeenCalled();
    }
  });

  it('returns only the safe operational projection and fails closed when the profile is absent', async () => {
    const safeProfile = { identityId, displayLabel: 'Analista Centro', normalizedLabel: 'analista centro' };
    const prisma = prismaDouble({
      analystOperationalProfile: {
        findUnique: vi.fn().mockResolvedValue(safeProfile),
        upsert: vi.fn(),
      },
    });
    const service = new AnalystOperationalProfileService(prisma as never);

    await expect(service.lookup(identityId)).resolves.toEqual({ outcome: 'available', profile: safeProfile });
    const queryText = JSON.stringify(prisma.identity.findUnique.mock.calls);
    expect(queryText).not.toMatch(/email|document|credential|password/i);

    prisma.analystOperationalProfile.findUnique.mockResolvedValueOnce(null);
    await expect(service.lookup(identityId)).resolves.toEqual({ outcome: 'unavailable' });
  });

  it('does not leak provider failures and rejects invalid identity identifiers', async () => {
    const prisma = prismaDouble({ identity: { findUnique: vi.fn().mockRejectedValue(new Error('database-secret')) } });
    const service = new AnalystOperationalProfileService(prisma as never);

    await expect(service.lookup('not-an-identity')).resolves.toEqual({ outcome: 'unavailable' });
    await expect(service.lookup(identityId)).resolves.toEqual({ outcome: 'unavailable' });
    await expect(service.provision({ identityId, displayLabel: 'Analista Seguro' })).resolves.toEqual({ outcome: 'unavailable' });
  });
});
