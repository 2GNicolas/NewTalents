import { describe, expect, it, vi } from 'vitest';

import { PASSPORT_RETRY_DELAYS_MS, PassportTransactionRunner } from './transaction-runner.js';

describe('PassportTransactionRunner', () => {
  it('retries the complete Serializable operation only for P2034 with 50ms then 100ms delays', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const prisma = {
      $transaction: async (operation: (transaction: object) => Promise<string>, options?: { isolationLevel?: string }) => {
        expect(options?.isolationLevel).toBe('Serializable');
        attempts += 1;
        if (attempts < 3) throw Object.assign(new Error('serialization'), { code: 'P2034' });
        return operation({});
      },
    };
    const service = new PassportTransactionRunner(prisma as never, async (milliseconds) => {
      delays.push(milliseconds);
    });
    await expect(service.execute(async () => 'complete-operation')).resolves.toBe('complete-operation');
    expect(attempts).toBe(3);
    expect(delays).toEqual(PASSPORT_RETRY_DELAYS_MS);
  });

  it('throws after three P2034 attempts', async () => {
    let attempts = 0;
    const delay = vi.fn().mockResolvedValue(undefined);
    const prisma = {
      $transaction: async () => {
        attempts += 1;
        throw Object.assign(new Error('serialization'), { code: 'P2034' });
      },
    };
    const service = new PassportTransactionRunner(prisma as never, delay);
    await expect(service.execute(async () => 'unused')).rejects.toMatchObject({ code: 'P2034' });
    expect(attempts).toBe(3);
    expect(delay).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-P2034 failure', async () => {
    let attempts = 0;
    const service = new PassportTransactionRunner(
      {
        $transaction: async () => {
          attempts += 1;
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        },
      } as never,
      async () => undefined,
    );
    await expect(service.execute(async () => 'unused')).rejects.toMatchObject({ code: 'P2002' });
    expect(attempts).toBe(1);
  });
});
