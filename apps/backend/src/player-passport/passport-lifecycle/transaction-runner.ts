import { Inject, Injectable, Optional } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';

export const PASSPORT_TOTAL_ATTEMPTS = 3;
export const PASSPORT_RETRY_DELAYS_MS = [50, 100] as const;
export const PASSPORT_DELAY = Symbol('PASSPORT_DELAY');

export type PassportTransactionClient = Prisma.TransactionClient;
export type PassportDelay = (milliseconds: number) => Promise<void>;

const sleep: PassportDelay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

@Injectable()
export class PassportTransactionRunner {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(PASSPORT_DELAY) private readonly delay: PassportDelay = sleep,
  ) {}

  async execute<T>(operation: (transaction: PassportTransactionClient) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < PASSPORT_TOTAL_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        lastError = error;
        if (this.code(error) !== 'P2034' || attempt === PASSPORT_TOTAL_ATTEMPTS - 1) throw error;
        await this.delay(PASSPORT_RETRY_DELAYS_MS[attempt]!);
      }
    }
    throw lastError;
  }

  private code(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  }
}
