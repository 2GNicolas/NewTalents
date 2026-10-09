import { describe, expect, it, vi } from 'vitest';

import { ALLOWANCE_TRANSACTION_ATTEMPTS, AllowanceTransactionRunner } from './allowance-transaction.runner.js';

const passportId = '22222222-2222-4222-8222-222222222222';

describe('allowance serializable passport lock', () => {
  it('locks the existing passport and retries only bounded serialization conflicts', async () => {
    const transaction = { $queryRaw: vi.fn().mockResolvedValue([{ id: passportId }]) };
    const operation = vi.fn().mockResolvedValue('committed');
    const prisma = { $transaction: vi.fn().mockRejectedValueOnce({ code: 'P2034' })
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementation(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)) };
    const delay = vi.fn().mockResolvedValue(undefined);
    const runner = new AllowanceTransactionRunner(prisma as never, delay);
    await expect(runner.executeLocked(passportId, operation)).resolves.toBe('committed');
    expect(prisma.$transaction).toHaveBeenCalledTimes(ALLOWANCE_TRANSACTION_ATTEMPTS);
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledWith(transaction);
    expect(delay).toHaveBeenCalledTimes(2);
  });

  it('does not retry ordinary storage errors or retry forever', async () => {
    const delay = vi.fn().mockResolvedValue(undefined);
    const ordinary = { $transaction: vi.fn().mockRejectedValue(new Error('storage')) };
    await expect(new AllowanceTransactionRunner(ordinary as never, delay).executeLocked(passportId, vi.fn())).rejects.toThrow('storage');
    expect(ordinary.$transaction).toHaveBeenCalledTimes(1);
    const serialization = { $transaction: vi.fn().mockRejectedValue({ code: 'P2034' }) };
    await expect(new AllowanceTransactionRunner(serialization as never, delay).executeLocked(passportId, vi.fn())).rejects.toMatchObject({ code: 'P2034' });
    expect(serialization.$transaction).toHaveBeenCalledTimes(ALLOWANCE_TRANSACTION_ATTEMPTS);
  });
});
