import { describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';

import { DatabaseReadinessService } from './database-readiness.service.js';
import { PrismaService } from './prisma.service.js';

describe('DatabaseReadinessService', () => {
  it('uses the explicit Prisma provider when design:paramtypes is unavailable', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const originalMetadata = Reflect.getMetadata('design:paramtypes', DatabaseReadinessService);
    Reflect.deleteMetadata('design:paramtypes', DatabaseReadinessService);
    try {
      const module = await Test.createTestingModule({
        providers: [DatabaseReadinessService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      const readiness = module.get(DatabaseReadinessService);

      expect((readiness as unknown as { prisma: unknown }).prisma).toBe(prisma);
      await expect(readiness.check()).resolves.toEqual({ status: 'ready' });
      expect(prisma.$queryRaw).toHaveBeenCalledOnce();
      await module.close();
    } finally {
      if (originalMetadata === undefined) Reflect.deleteMetadata('design:paramtypes', DatabaseReadinessService);
      else Reflect.defineMetadata('design:paramtypes', originalMetadata, DatabaseReadinessService);
    }
  });

  it('returns ready after the static tagged query succeeds', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
    await expect(new DatabaseReadinessService(prisma as never, 100).check()).resolves.toEqual({ status: 'ready' });
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });

  it.each([
    Object.assign(new Error('password authentication failed'), { code: '28P01' }),
    Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' }),
    new Error('unexpected sensitive driver text'),
  ])('normalizes database failures', async (failure) => {
    const prisma = { $queryRaw: vi.fn().mockRejectedValue(failure) };
    await expect(new DatabaseReadinessService(prisma as never, 100).check()).resolves.toEqual({ status: 'unavailable' });
  });

  it('enforces the configured upper bound', async () => {
    vi.useFakeTimers();
    const prisma = { $queryRaw: vi.fn(() => new Promise(() => undefined)) };
    const result = new DatabaseReadinessService(prisma as never, 5_000).check();
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(result).resolves.toEqual({ status: 'unavailable' });
    vi.useRealTimers();
  });

  it('disconnects the application-scoped client during shutdown', async () => {
    const client = { $disconnect: vi.fn().mockResolvedValue(undefined) };
    await PrismaService.prototype.onModuleDestroy.call(client as never);
    expect(client.$disconnect).toHaveBeenCalledOnce();
  });
});
