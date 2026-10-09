import { Inject, Injectable, Optional } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';

export const CUSTODY_TRANSACTION_TOTAL_ATTEMPTS = 3;
export const CUSTODY_TRANSACTION_RETRY_DELAYS_MS = [50, 100] as const;
export const CUSTODY_TRANSACTION_DELAY = Symbol('CUSTODY_TRANSACTION_DELAY');
export type CustodyTransactionClient = Prisma.TransactionClient;
export type CustodyTransactionDelay = (milliseconds: number) => Promise<void>;

const sleep: CustodyTransactionDelay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

@Injectable()
export class PassportCustodyTransactionRunner {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(CUSTODY_TRANSACTION_DELAY) private readonly delay: CustodyTransactionDelay = sleep,
  ) {}

  async executeLocked<T>(passportId: string, operation: (transaction: CustodyTransactionClient) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < CUSTODY_TRANSACTION_TOTAL_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (transaction) => {
          await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "PlayerPassport" WHERE "id" = ${passportId}::uuid FOR UPDATE`);
          return operation(transaction);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        lastError = error;
        if (errorCode(error) !== 'P2034' || attempt === CUSTODY_TRANSACTION_TOTAL_ATTEMPTS - 1) throw error;
        await this.delay(CUSTODY_TRANSACTION_RETRY_DELAYS_MS[attempt]!);
      }
    }
    throw lastError;
  }
}

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
}
