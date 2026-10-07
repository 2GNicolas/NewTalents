import { describe, expect, it, vi } from 'vitest';

import { AnalystPassportsController } from './analyst-passports.controller.js';
import { PassportController } from '../../player-passport/http/passport.controller.js';

const analystId = '11111111-1111-4111-8111-111111111111';

describe('AnalystPassportsController', () => {
  it('returns a stable no-store page projected by current custody', async () => {
    const page = { items: [{ passportId: '22222222-2222-4222-8222-222222222222' }], nextCursor: 'next' };
    const queries = { list: vi.fn().mockResolvedValue(page) };
    const controller = new AnalystPassportsController(queries as never);
    await expect(controller.list({ actor: { identityId: analystId } } as never, { limit: '20' })).resolves.toEqual({
      data: page.items,
      pagination: { hasMore: true, nextCursor: 'next' },
    });
    expect(queries.list).toHaveBeenCalledWith({ identityId: analystId, limit: 20 });
  });

  it('rejects unknown query fields and denies inactive/revoked Analysts safely', async () => {
    const queries = { list: vi.fn().mockResolvedValue({ outcome: 'forbidden' }) };
    const controller = new AnalystPassportsController(queries as never);
    await expect(controller.list({ actor: { identityId: analystId } } as never, { limit: '20', role: 'ANALYST' })).rejects.toMatchObject({ code: 'validation' });
    await expect(controller.list({ actor: { identityId: analystId } } as never, {})).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('makes detail, presentation, and internal history indistinguishable after custody revocation', async () => {
    const passportId = '22222222-2222-4222-8222-222222222222';
    const passport = { id: passportId, playerId: '33333333-3333-4333-8333-333333333333', state: 'ACTIVE', originKind: 'PARTICULAR', position: 'MIDFIELDER', ageCategory: 'SENIOR', city: 'Bogota', country: 'CO', dominantFoot: 'RIGHT', createdByIdentityId: analystId, originAcademyId: null, version: 1, createdAt: new Date(), updatedAt: new Date() };
    const prisma = {
      playerPassport: { findUnique: vi.fn().mockResolvedValue(passport) },
      passportPossibleDuplicateSignal: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn() },
      passportLifecycleEvent: { findMany: vi.fn() },
    };
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: false, reason: 'insufficient-resource-facts', policyVersion: '1' }) };
    const controller = new PassportController(prisma as never, authorization as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    const response = () => ({ setHeader: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis() });

    for (const invoke of [
      (res: ReturnType<typeof response>) => controller.status({ actor: { identityId: analystId } } as never, passportId, res as never),
      (res: ReturnType<typeof response>) => controller.presentation({ actor: { identityId: analystId } } as never, passportId, res as never),
      (res: ReturnType<typeof response>) => controller.internalHistory({ actor: { identityId: analystId } } as never, passportId, res as never),
    ]) {
      const res = response();
      await expect(invoke(res)).resolves.toMatchObject({ code: 'passport_not_found' });
      expect(res.status).toHaveBeenCalledWith(404);
    }
  });
});
