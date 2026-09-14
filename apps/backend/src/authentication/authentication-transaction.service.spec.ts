import { describe, expect, it } from 'vitest';

import { AUTHENTICATION_RETRY_DELAYS_MS, AuthenticationTransactionService } from './authentication-transaction.service.js';

describe('AuthenticationTransactionService', () => {
  it('retries the complete Serializable operation only for P2034 with 50ms then 100ms delays', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const prisma = { $transaction: async (operation: (transaction: object) => Promise<string>) => {
      attempts += 1;
      if (attempts < 3) throw { code: 'P2034' };
      return operation({});
    } };
    const service = new AuthenticationTransactionService(prisma as never, async (milliseconds) => { delays.push(milliseconds); });
    await expect(service.execute(async () => 'complete-operation')).resolves.toBe('complete-operation');
    expect(attempts).toBe(3);
    expect(delays).toEqual(AUTHENTICATION_RETRY_DELAYS_MS);
  });

  it('does not retry a non-P2034 failure', async () => {
    let attempts = 0;
    const service = new AuthenticationTransactionService({ $transaction: async () => { attempts += 1; throw { code: 'P2002' }; } } as never, async () => undefined);
    await expect(service.execute(async () => 'unused')).rejects.toMatchObject({ code: 'P2002' });
    expect(attempts).toBe(1);
  });
});
