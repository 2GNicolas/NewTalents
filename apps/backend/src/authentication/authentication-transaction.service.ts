import { Inject, Injectable, Optional } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';

export const AUTHENTICATION_TOTAL_ATTEMPTS = 3;
export const AUTHENTICATION_RETRY_DELAYS_MS = [50, 100] as const;
export type AuthenticationTransactionClient = Prisma.TransactionClient;
export type AuthenticationDelay = (milliseconds: number) => Promise<void>;
export const AUTHENTICATION_DELAY = Symbol('AUTHENTICATION_DELAY');
const sleep: AuthenticationDelay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

@Injectable()
export class AuthenticationTransactionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(AUTHENTICATION_DELAY) private readonly delay: AuthenticationDelay = sleep,
  ) {}

  async execute<T>(operation: (transaction: AuthenticationTransactionClient) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < AUTHENTICATION_TOTAL_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        lastError = error;
        if (this.code(error) !== 'P2034' || attempt === AUTHENTICATION_TOTAL_ATTEMPTS - 1) throw error;
        await this.delay(AUTHENTICATION_RETRY_DELAYS_MS[attempt]!);
      }
    }
    throw lastError;
  }

  private code(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  }
}
