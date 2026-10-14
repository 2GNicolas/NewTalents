import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { resolveAllowancePeriod, type AllowancePeriodSource } from '../../passport-match-allowance/application/allowance-period-query.js';
import type { CalendarDate } from '../../passport-match-allowance/domain/allowance-period.js';
import { AllowanceTransactionRunner } from '../../passport-match-allowance/persistence/allowance-transaction.runner.js';

export type FirstMatchTransaction = Prisma.TransactionClient;

function dateOnly(value: Date): CalendarDate {
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class FirstMatchRepository {
  constructor(private readonly transactions: AllowanceTransactionRunner) {}

  executeLocked<T>(passportId: string, operation: (transaction: FirstMatchTransaction) => Promise<T>): Promise<T> {
    return this.transactions.executeLocked(passportId, operation);
  }

  /** The caller's transaction must be serializable and must lock before reading/mutating. */
  lockInTransaction(transaction: FirstMatchTransaction, passportId: string): Promise<boolean> {
    return this.transactions.lockInTransaction(transaction, passportId);
  }

  async findCurrent(transaction: FirstMatchTransaction, passportId: string) {
    return transaction.firstMatch.findFirst({
      where: { passportId, state: { in: ['WAITING', 'LOADED'] } },
    });
  }

  async loadAllowanceSource(transaction: FirstMatchTransaction, passportId: string): Promise<AllowancePeriodSource | null> {
    const allowance = await transaction.passportMatchAllowance.findUnique({
      where: { passportId },
      select: { activatedOn: true, revisions: { orderBy: { sequence: 'asc' }, select: {
        sequence: true, effectiveOn: true, cadence: true, matchLimit: true,
      } } },
    });
    if (!allowance) return null;
    return {
      passportId,
      activatedOn: dateOnly(allowance.activatedOn),
      revisions: allowance.revisions.map((revision) => ({
        sequence: revision.sequence,
        effectiveOn: dateOnly(revision.effectiveOn),
        cadence: revision.cadence,
        matchLimit: Number(revision.matchLimit),
      })),
    };
  }

  async countPeriod(
    transaction: FirstMatchTransaction,
    source: AllowancePeriodSource | null,
    onDate: CalendarDate,
  ) {
    const target = resolveAllowancePeriod(source, onDate);
    if (!target || !source) return null; // Unconfigured is not a zero-capacity period.
    const units = await transaction.firstMatch.findMany({
      where: { passportId: source.passportId, unitState: { in: ['RESERVED', 'USED'] } },
      select: { matchDate: true, unitState: true },
    });
    let reserved = 0;
    let used = 0;
    for (const unit of units) {
      const bucket = resolveAllowancePeriod(source, dateOnly(unit.matchDate));
      if (bucket?.period.start !== target.period.start || bucket.period.endExclusive !== target.period.endExclusive) continue;
      if (unit.unitState === 'RESERVED') reserved += 1;
      else used += 1;
    }
    return {
      ...target,
      reserved,
      used,
      available: Math.max(0, target.matchLimit - reserved - used),
    };
  }
}
