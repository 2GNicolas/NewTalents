import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { PassportCustodyCommandService } from './application/passport-custody-command.service.js';
import { PassportCustodyTransactionRunner } from './persistence/passport-custody-transaction.runner.js';

describe('PassportCustodyModule command wiring', () => {
  it('constructs the command service without requiring a runtime clock provider', async () => {
    const module = await Test.createTestingModule({
      providers: [
        PassportCustodyCommandService,
        { provide: PassportCustodyTransactionRunner, useValue: { executeLocked: async () => undefined } },
      ],
    }).compile();

    expect(module.get(PassportCustodyCommandService)).toBeInstanceOf(PassportCustodyCommandService);
    await module.close();
  });
});
