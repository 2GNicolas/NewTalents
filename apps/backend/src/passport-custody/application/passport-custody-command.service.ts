import { Injectable, Optional } from '@nestjs/common';

import type { CustodyTransactionClient } from '../persistence/passport-custody-transaction.runner.js';
import { PassportCustodyTransactionRunner } from '../persistence/passport-custody-transaction.runner.js';

export type AssignPassportCustodyCommand = Readonly<{
  passportId: string;
  administratorIdentityId: string;
  analystIdentityId: string;
  expectedVersion: number;
  idempotencyKey: string;
}>;

export type ChangePassportCustodyCommand = AssignPassportCustodyCommand & Readonly<{ reason: string }>;
export type RemovePassportCustodyCommand = Readonly<Omit<ChangePassportCustodyCommand, 'analystIdentityId'>>;

export type CustodyCommandCurrentState =
  | Readonly<{ state: 'UNASSIGNED'; version: number }>
  | Readonly<{ state: 'ASSIGNED'; version: number; analystIdentityId: string; assignedAt?: string }>;

type CustodyCommandConflict =
  | Readonly<{ outcome: 'conflict' | 'idempotency-conflict'; current: CustodyCommandCurrentState }>;

export type AssignPassportCustodyResult =
  | Readonly<{ outcome: 'applied' | 'idempotent'; passportId: string; eventId: string; custody: Readonly<{ state: 'ASSIGNED'; version: number; analystIdentityId: string; assignedAt: string }> }>
  | Readonly<{ outcome: 'invalid' | 'not-found' | 'unavailable' }>
  | Readonly<{ outcome: 'ineligible-passport' | 'ineligible-analyst'; current: CustodyCommandCurrentState }>
  | CustodyCommandConflict;

export type ChangePassportCustodyResult = AssignPassportCustodyResult;
export type RemovePassportCustodyResult =
  | Readonly<{ outcome: 'applied' | 'idempotent'; passportId: string; eventId: string; custody: Readonly<{ state: 'UNASSIGNED'; version: number }> }>
  | Readonly<{ outcome: 'invalid' | 'not-found' | 'unavailable' }>
  | Readonly<{ outcome: 'ineligible-passport'; current: CustodyCommandCurrentState }>
  | CustodyCommandConflict;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class PassportCustodyCommandService {
  constructor(
    private readonly transactions: PassportCustodyTransactionRunner,
    @Optional()
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async assign(input: AssignPassportCustodyCommand): Promise<AssignPassportCustodyResult> {
    if (!UUID.test(input.passportId) || !UUID.test(input.administratorIdentityId) || !UUID.test(input.analystIdentityId)
      || !UUID.test(input.idempotencyKey) || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) return { outcome: 'invalid' };
    return this.execute(input.passportId, (transaction) => this.assignLocked(transaction, input));
  }

  async change(input: ChangePassportCustodyCommand): Promise<ChangePassportCustodyResult> {
    const reason = safeReason(input.reason);
    if (!reason || !validBaseCommand(input) || !UUID.test(input.analystIdentityId)) return { outcome: 'invalid' };
    return this.execute(input.passportId, (transaction) => this.changeLocked(transaction, { ...input, reason }));
  }

  async remove(input: RemovePassportCustodyCommand): Promise<RemovePassportCustodyResult> {
    const reason = safeReason(input.reason);
    if (!reason || !validBaseCommand(input)) return { outcome: 'invalid' };
    return this.execute(input.passportId, (transaction) => this.removeLocked(transaction, { ...input, reason }));
  }

  private async execute<T>(passportId: string, operation: (transaction: CustodyTransactionClient) => Promise<T>): Promise<T | Readonly<{ outcome: 'unavailable' }>> {
    try {
      return await this.transactions.executeLocked(passportId, operation);
    } catch (error) {
      if (errorCode(error) === 'P2002') {
        try { return await this.transactions.executeLocked(passportId, operation); }
        catch { return { outcome: 'unavailable' }; }
      }
      return { outcome: 'unavailable' };
    }
  }

  private async assignLocked(transaction: CustodyTransactionClient, input: AssignPassportCustodyCommand): Promise<AssignPassportCustodyResult> {
    const replay = await transaction.passportCustodyEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: {
        id: true, passportId: true, action: true, administratorIdentityId: true, nextAnalystIdentityId: true,
        safeReason: true, expectedVersion: true, resultingVersion: true, createdAt: true,
      },
    });
    if (replay) {
      const same = replay.passportId === input.passportId && replay.action === 'ASSIGNED'
        && replay.administratorIdentityId === input.administratorIdentityId && replay.nextAnalystIdentityId === input.analystIdentityId
        && replay.safeReason === null && replay.expectedVersion === input.expectedVersion;
      if (!same) return { outcome: 'idempotency-conflict', current: await readCurrentState(transaction, input.passportId) };
      const assignedAt = replay.createdAt ?? this.clock();
      return appliedResult('idempotent', input, replay.id, replay.resultingVersion, assignedAt);
    }

    const passport = await transaction.playerPassport.findUnique({
      where: { id: input.passportId },
      select: { id: true, state: true, enrichmentStatus: true },
    });
    if (!passport) return { outcome: 'not-found' };
    if (passport.state !== 'ACTIVE' || passport.enrichmentStatus !== 'AWAITING_ANALYST_ENRICHMENT') return { outcome: 'ineligible-passport', current: await readCurrentState(transaction, input.passportId) };

    const current = await transaction.passportCustody.findUnique({
      where: { passportId: input.passportId },
      select: { id: true, version: true, currentAnalystIdentityId: true, assignedAt: true },
    });
    const version = current?.version ?? 0;
    if (version !== input.expectedVersion || current?.currentAnalystIdentityId) return { outcome: 'conflict', current: projectCurrent(current) };

    const analyst = await transaction.analystOperationalProfile.findFirst({
      where: {
        identityId: input.analystIdentityId,
        identity: { status: 'ACTIVE', roleAssignments: { some: { role: 'ANALYST', status: 'ACTIVE' } } },
      },
      select: { identityId: true },
    });
    if (!analyst) return { outcome: 'ineligible-analyst', current: projectCurrent(current) };

    const assignedAt = this.clock();
    const resultingVersion = version + 1;
    if (current) {
      await transaction.passportCustody.update({
        where: { passportId: input.passportId },
        data: { currentAnalystIdentityId: input.analystIdentityId, version: resultingVersion, assignedAt },
      });
    } else {
      await transaction.passportCustody.create({
        data: { passportId: input.passportId, currentAnalystIdentityId: input.analystIdentityId, version: resultingVersion, assignedAt },
      });
    }
    const event = await transaction.passportCustodyEvent.create({
      data: {
        passportId: input.passportId,
        sequence: resultingVersion,
        action: 'ASSIGNED',
        administratorIdentityId: input.administratorIdentityId,
        previousAnalystIdentityId: null,
        nextAnalystIdentityId: input.analystIdentityId,
        safeReason: null,
        expectedVersion: input.expectedVersion,
        resultingVersion,
        idempotencyKey: input.idempotencyKey,
        createdAt: assignedAt,
      },
      select: { id: true },
    });
    return appliedResult('applied', input, event.id, resultingVersion, assignedAt);
  }

  private async changeLocked(transaction: CustodyTransactionClient, input: ChangePassportCustodyCommand & { reason: string }): Promise<ChangePassportCustodyResult> {
    const replay = await transaction.passportCustodyEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: {
        id: true, passportId: true, action: true, administratorIdentityId: true, previousAnalystIdentityId: true,
        nextAnalystIdentityId: true, safeReason: true, expectedVersion: true, resultingVersion: true, createdAt: true,
      },
    });
    if (replay) {
      const same = replay.passportId === input.passportId && replay.action === 'CHANGED'
        && replay.administratorIdentityId === input.administratorIdentityId && replay.nextAnalystIdentityId === input.analystIdentityId
        && replay.safeReason === input.reason && replay.expectedVersion === input.expectedVersion;
      if (!same) return { outcome: 'idempotency-conflict', current: await readCurrentState(transaction, input.passportId) };
      const assignedAt = replay.createdAt ?? this.clock();
      return appliedResult('idempotent', input, replay.id, replay.resultingVersion, assignedAt);
    }

    const passport = await transaction.playerPassport.findUnique({ where: { id: input.passportId }, select: { id: true, state: true, enrichmentStatus: true } });
    if (!passport) return { outcome: 'not-found' };
    if (passport.state !== 'ACTIVE' || passport.enrichmentStatus !== 'AWAITING_ANALYST_ENRICHMENT') return { outcome: 'ineligible-passport', current: await readCurrentState(transaction, input.passportId) };
    const current = await transaction.passportCustody.findUnique({
      where: { passportId: input.passportId }, select: { id: true, version: true, currentAnalystIdentityId: true, assignedAt: true },
    });
    if (!current?.currentAnalystIdentityId || current.version !== input.expectedVersion || current.currentAnalystIdentityId === input.analystIdentityId) return { outcome: 'conflict', current: projectCurrent(current) };
    const analyst = await transaction.analystOperationalProfile.findFirst({
      where: { identityId: input.analystIdentityId, identity: { status: 'ACTIVE', roleAssignments: { some: { role: 'ANALYST', status: 'ACTIVE' } } } },
      select: { identityId: true },
    });
    if (!analyst) return { outcome: 'ineligible-analyst', current: projectCurrent(current) };

    const assignedAt = this.clock();
    const resultingVersion = current.version + 1;
    await transaction.passportCustody.update({
      where: { passportId: input.passportId },
      data: { currentAnalystIdentityId: input.analystIdentityId, version: resultingVersion, assignedAt },
    });
    const event = await transaction.passportCustodyEvent.create({
      data: {
        passportId: input.passportId, sequence: resultingVersion, action: 'CHANGED', administratorIdentityId: input.administratorIdentityId,
        previousAnalystIdentityId: current.currentAnalystIdentityId, nextAnalystIdentityId: input.analystIdentityId,
        safeReason: input.reason, expectedVersion: input.expectedVersion, resultingVersion, idempotencyKey: input.idempotencyKey,
        createdAt: assignedAt,
      },
      select: { id: true },
    });
    return appliedResult('applied', input, event.id, resultingVersion, assignedAt);
  }

  private async removeLocked(transaction: CustodyTransactionClient, input: RemovePassportCustodyCommand & { reason: string }): Promise<RemovePassportCustodyResult> {
    const replay = await transaction.passportCustodyEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: {
        id: true, passportId: true, action: true, administratorIdentityId: true, previousAnalystIdentityId: true,
        nextAnalystIdentityId: true, safeReason: true, expectedVersion: true, resultingVersion: true, createdAt: true,
      },
    });
    if (replay) {
      const same = replay.passportId === input.passportId && replay.action === 'REMOVED'
        && replay.administratorIdentityId === input.administratorIdentityId && replay.nextAnalystIdentityId === null
        && replay.safeReason === input.reason && replay.expectedVersion === input.expectedVersion;
      if (!same) return { outcome: 'idempotency-conflict', current: await readCurrentState(transaction, input.passportId) };
      return removedResult('idempotent', input.passportId, replay.id, replay.resultingVersion);
    }

    const passport = await transaction.playerPassport.findUnique({ where: { id: input.passportId }, select: { id: true, state: true, enrichmentStatus: true } });
    if (!passport) return { outcome: 'not-found' };
    if (passport.state !== 'ACTIVE' || passport.enrichmentStatus !== 'AWAITING_ANALYST_ENRICHMENT') return { outcome: 'ineligible-passport', current: await readCurrentState(transaction, input.passportId) };
    const current = await transaction.passportCustody.findUnique({
      where: { passportId: input.passportId }, select: { id: true, version: true, currentAnalystIdentityId: true, assignedAt: true },
    });
    if (!current?.currentAnalystIdentityId || current.version !== input.expectedVersion) return { outcome: 'conflict', current: projectCurrent(current) };
    const resultingVersion = current.version + 1;
    const removedAt = this.clock();
    await transaction.passportCustody.update({
      where: { passportId: input.passportId }, data: { currentAnalystIdentityId: null, version: resultingVersion, assignedAt: null },
    });
    const event = await transaction.passportCustodyEvent.create({
      data: {
        passportId: input.passportId, sequence: resultingVersion, action: 'REMOVED', administratorIdentityId: input.administratorIdentityId,
        previousAnalystIdentityId: current.currentAnalystIdentityId, nextAnalystIdentityId: null,
        safeReason: input.reason, expectedVersion: input.expectedVersion, resultingVersion, idempotencyKey: input.idempotencyKey,
        createdAt: removedAt,
      },
      select: { id: true },
    });
    return removedResult('applied', input.passportId, event.id, resultingVersion);
  }
}

function appliedResult(outcome: 'applied' | 'idempotent', input: AssignPassportCustodyCommand, eventId: string, version: number, assignedAt: Date): AssignPassportCustodyResult {
  return Object.freeze({
    outcome,
    passportId: input.passportId,
    eventId,
    custody: Object.freeze({ state: 'ASSIGNED' as const, version, analystIdentityId: input.analystIdentityId, assignedAt: assignedAt.toISOString() }),
  });
}

function removedResult(outcome: 'applied' | 'idempotent', passportId: string, eventId: string, version: number): RemovePassportCustodyResult {
  return Object.freeze({ outcome, passportId, eventId, custody: Object.freeze({ state: 'UNASSIGNED' as const, version }) });
}

type CurrentRow = Readonly<{ version: number; currentAnalystIdentityId: string | null; assignedAt?: Date | null }> | null;

async function readCurrentState(transaction: CustodyTransactionClient, passportId: string): Promise<CustodyCommandCurrentState> {
  const current = await transaction.passportCustody.findUnique({
    where: { passportId },
    select: { version: true, currentAnalystIdentityId: true, assignedAt: true },
  });
  return projectCurrent(current);
}

function projectCurrent(current: CurrentRow): CustodyCommandCurrentState {
  if (!current?.currentAnalystIdentityId) return Object.freeze({ state: 'UNASSIGNED' as const, version: current?.version ?? 0 });
  return Object.freeze({
    state: 'ASSIGNED' as const,
    version: current.version,
    analystIdentityId: current.currentAnalystIdentityId,
    ...(current.assignedAt ? { assignedAt: current.assignedAt.toISOString() } : {}),
  });
}

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
}

function validBaseCommand(input: RemovePassportCustodyCommand): boolean {
  return UUID.test(input.passportId) && UUID.test(input.administratorIdentityId) && UUID.test(input.idempotencyKey)
    && Number.isSafeInteger(input.expectedVersion) && input.expectedVersion >= 0;
}

function safeReason(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const reason = value.trim().replace(/\s+/g, ' ');
  if (!reason || reason.length > 500 || /[\u0000-\u001f\u007f@]/u.test(reason) || /\d{6,}/u.test(reason)) return null;
  return reason;
}
