import { Inject, Injectable, Optional } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';

export type AllowanceTransactionClient = Prisma.TransactionClient;
export const ALLOWANCE_TRANSACTION_ATTEMPTS = 3;
export const ALLOWANCE_TRANSACTION_DELAY = Symbol('ALLOWANCE_TRANSACTION_DELAY');
type Delay = (milliseconds: number) => Promise<void>;
const sleep: Delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

@Injectable()
export class AllowanceTransactionRunner {
  constructor(private readonly prisma: PrismaService, @Optional() @Inject(ALLOWANCE_TRANSACTION_DELAY) private readonly delay: Delay = sleep) {}

  async executeLocked<T>(passportId: string, operation: (transaction: AllowanceTransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < ALLOWANCE_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (transaction) => {
          await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "PlayerPassport" WHERE "id" = ${passportId}::uuid FOR UPDATE`);
          return operation(transaction);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (errorCode(error) !== 'P2034' || attempt === ALLOWANCE_TRANSACTION_ATTEMPTS - 1) throw error;
        await this.delay(50 * (attempt + 1));
      }
    }
    throw new Error('Allowance transaction retry exhausted');
  }
}

export function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
}
