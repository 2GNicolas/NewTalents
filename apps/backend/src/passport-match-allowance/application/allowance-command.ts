import { Injectable, Optional } from '@nestjs/common';

import { colombiaLocalDate, periodContaining, type AllowanceCadence } from '../domain/allowance-period.js';
import { AllowanceTransactionRunner, errorCode, type AllowanceTransactionClient } from '../persistence/allowance-transaction.runner.js';
import { AdministratorAllowanceAuthorization } from './administrator-allowance-authorization.js';
import { resolveAllowancePeriod, type AllowanceRuleRevision } from './allowance-period-query.js';

export type CreateAllowanceInput = Readonly<{
  passportId: string;
  administratorIdentityId: string;
  expectedVersion: number;
  idempotencyKey: string;
  cadence: AllowanceCadence;
  matchLimit: number;
  expectedActivationDate: string;
}>;

export type CreateAllowanceResult =
  | Readonly<{ outcome: 'applied' | 'idempotent'; configuration: ReturnType<typeof configuration>; colombiaToday: string }>
  | Readonly<{ outcome: 'invalid' | 'not-found' | 'ineligible-passport' | 'activation-date-changed' | 'conflict' | 'idempotency-conflict' | 'unavailable' }>;

export type UpdateAllowanceInput = Readonly<Omit<CreateAllowanceInput, 'expectedActivationDate'>>;
export type ConfirmAllowanceInput = CreateAllowanceInput | UpdateAllowanceInput;
export type ConfirmAllowanceResult = CreateAllowanceResult
  | Readonly<{ outcome: 'applied' | 'idempotent'; configuration: ReturnType<typeof projectSnapshot>; colombiaToday: string }>
  | Readonly<{ outcome: 'conflict' | 'idempotency-conflict'; current: Readonly<{ version: number }> }>;

type StoredRevision = Readonly<{
  sequence: number; idempotencyKey: string; expectedVersion: number; cadence: AllowanceCadence;
  matchLimit: bigint; effectiveOn: Date; confirmedAt: Date; confirmedByIdentityId: string;
  previousCadence: AllowanceCadence | null; previousMatchLimit: bigint | null; previousEffectiveOn: Date | null;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CADENCES = new Set<AllowanceCadence>(['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']);

@Injectable()
export class AllowanceCommand {
  constructor(
    private readonly transactions: AllowanceTransactionRunner,
    private readonly authorization: AdministratorAllowanceAuthorization,
    @Optional() private readonly clock: () => Date = () => new Date(),
  ) {}

  async create(input: CreateAllowanceInput): Promise<CreateAllowanceResult> {
    if (!validInput(input)) return { outcome: 'invalid' };
    try {
      return await this.transactions.executeLocked(input.passportId, (transaction) => this.createLocked(transaction, input));
    } catch (error) {
      // A competing first creation may hit the unique passport index after a retry.
      if (errorCode(error) === 'P2002') {
        try { return await this.transactions.executeLocked(input.passportId, (transaction) => this.createLocked(transaction, input)); }
        catch { return { outcome: 'unavailable' }; }
      }
      return { outcome: 'unavailable' };
    }
  }

  async confirm(input: ConfirmAllowanceInput): Promise<ConfirmAllowanceResult> {
    if (!validConfirmInput(input)) return { outcome: 'invalid' };
    if (input.expectedVersion === 0) return this.create(input as CreateAllowanceInput);
    try {
      return await this.transactions.executeLocked(input.passportId, (transaction) => this.updateLocked(transaction, input));
    } catch (error) {
      if (errorCode(error) === 'P2002') {
        try { return await this.transactions.executeLocked(input.passportId, (transaction) => this.updateLocked(transaction, input)); }
        catch { return { outcome: 'unavailable' }; }
      }
      return { outcome: 'unavailable' };
    }
  }

  private async updateLocked(transaction: AllowanceTransactionClient, input: UpdateAllowanceInput): Promise<ConfirmAllowanceResult> {
    const passport = await transaction.playerPassport.findUnique({ where: { id: input.passportId }, select: { id: true, state: true } });
    const permission = passport?.state === 'ACTIVE' ? 'passport.allowance.write' : 'passport.allowance.view';
    const decision = await this.authorization.authorize(input.administratorIdentityId, permission, {
      exists: Boolean(passport), active: passport?.state === 'ACTIVE',
    }, transaction);
    if (!decision.allowed || !passport) return { outcome: 'not-found' };
    if (passport.state !== 'ACTIVE') return { outcome: 'ineligible-passport' };

    const aggregate = await transaction.passportMatchAllowance.findUnique({
      where: { passportId: input.passportId }, select: { id: true, version: true, activatedOn: true },
    });
    if (!aggregate) return { outcome: 'conflict', current: { version: 0 } };
    const replay = await transaction.passportMatchAllowanceRevision.findFirst({
      where: { allowanceId: aggregate.id, idempotencyKey: input.idempotencyKey },
      select: { id: true, sequence: true, idempotencyKey: true, expectedVersion: true, cadence: true,
        matchLimit: true, effectiveOn: true, confirmedAt: true, confirmedByIdentityId: true,
        previousCadence: true, previousMatchLimit: true, previousEffectiveOn: true },
    });
    if (replay) {
      const same = replay.expectedVersion === input.expectedVersion
        && replay.confirmedByIdentityId === input.administratorIdentityId
        && replay.cadence === input.cadence && replay.matchLimit === BigInt(input.matchLimit);
      if (!same) return { outcome: 'idempotency-conflict', current: { version: aggregate.version } };
      const revisions = await this.revisions(transaction, aggregate.id);
      const original = revisions.filter((revision) => revision.sequence <= replay.sequence);
      const date = colombiaLocalDate(replay.confirmedAt);
      return { outcome: 'idempotent', colombiaToday: date,
        configuration: projectSnapshot(input.passportId, aggregate.activatedOn, replay.sequence, original, date, replay.confirmedAt) };
    }
    // This comparison is mandatory even when an accepted pending revision targets the same boundary.
    if (aggregate.version !== input.expectedVersion) return { outcome: 'conflict', current: { version: aggregate.version } };

    const confirmedAt = this.clock();
    const date = colombiaLocalDate(confirmedAt);
    const revisions = await this.revisions(transaction, aggregate.id);
    const active = resolveAllowancePeriod({ passportId: input.passportId,
      activatedOn: dateOnly(aggregate.activatedOn), revisions: revisions.map(periodRevision) }, date);
    const latest = revisions.at(-1);
    if (!active || !latest || latest.sequence !== aggregate.version) return { outcome: 'unavailable' };
    const effectiveOn = active.period.endExclusive;
    const newVersion = aggregate.version + 1;
    const created = await transaction.passportMatchAllowanceRevision.create({
      data: { allowanceId: aggregate.id, sequence: newVersion, idempotencyKey: input.idempotencyKey,
        expectedVersion: input.expectedVersion, cadence: input.cadence, matchLimit: BigInt(input.matchLimit),
        effectiveOn: new Date(`${effectiveOn}T00:00:00.000Z`),
        previousCadence: latest.cadence, previousMatchLimit: latest.matchLimit,
        previousEffectiveOn: latest.effectiveOn,
        supersededPendingRevision: dateOnly(latest.effectiveOn) > date,
        confirmedByIdentityId: input.administratorIdentityId, confirmedAt },
      select: { id: true, confirmedAt: true },
    });
    await transaction.passportMatchAllowance.update({ where: { id: aggregate.id }, data: { version: newVersion } });
    const accepted: StoredRevision = { ...input, sequence: newVersion, effectiveOn: new Date(`${effectiveOn}T00:00:00.000Z`),
      matchLimit: BigInt(input.matchLimit), confirmedAt: created.confirmedAt,
      confirmedByIdentityId: input.administratorIdentityId, previousCadence: latest.cadence,
      previousMatchLimit: latest.matchLimit, previousEffectiveOn: latest.effectiveOn };
    return { outcome: 'applied', colombiaToday: date,
      configuration: projectSnapshot(input.passportId, aggregate.activatedOn, newVersion, [...revisions, accepted], date, created.confirmedAt) };
  }

  private async revisions(transaction: AllowanceTransactionClient, allowanceId: string): Promise<StoredRevision[]> {
    return transaction.passportMatchAllowanceRevision.findMany({ where: { allowanceId }, orderBy: { sequence: 'asc' },
      select: { sequence: true, idempotencyKey: true, expectedVersion: true, cadence: true, matchLimit: true,
        effectiveOn: true, confirmedAt: true, confirmedByIdentityId: true,
        previousCadence: true, previousMatchLimit: true, previousEffectiveOn: true } });
  }

  private async createLocked(transaction: AllowanceTransactionClient, input: CreateAllowanceInput): Promise<CreateAllowanceResult> {
    const passport = await transaction.playerPassport.findUnique({ where: { id: input.passportId }, select: { id: true, state: true } });
    const permission = passport?.state === 'ACTIVE' ? 'passport.allowance.write' : 'passport.allowance.view';
    const decision = await this.authorization.authorize(input.administratorIdentityId, permission, {
      exists: Boolean(passport), active: passport?.state === 'ACTIVE',
    }, transaction);
    if (!decision.allowed || !passport) return { outcome: 'not-found' };
    if (passport.state !== 'ACTIVE') return { outcome: 'ineligible-passport' };

    const aggregate = await transaction.passportMatchAllowance.findUnique({
      where: { passportId: input.passportId }, select: { id: true, version: true, activatedOn: true },
    });
    if (aggregate) {
      const replay = await transaction.passportMatchAllowanceRevision.findFirst({
        where: { allowanceId: aggregate.id, idempotencyKey: input.idempotencyKey },
        select: { id: true, sequence: true, expectedVersion: true, cadence: true, matchLimit: true,
          effectiveOn: true, confirmedAt: true, confirmedByIdentityId: true },
      });
      if (replay) {
        const same = replay.sequence === 1 && replay.expectedVersion === 0
          && replay.confirmedByIdentityId === input.administratorIdentityId
          && replay.cadence === input.cadence && replay.matchLimit === BigInt(input.matchLimit)
          && replay.effectiveOn.toISOString().slice(0, 10) === input.expectedActivationDate;
        if (!same) return { outcome: 'idempotency-conflict' };
        const date = replay.effectiveOn.toISOString().slice(0, 10);
        return { outcome: 'idempotent', configuration: configuration(replay.cadence, Number(replay.matchLimit), date, replay.confirmedAt), colombiaToday: date };
      }
      return { outcome: 'conflict' };
    }

    const confirmedAt = this.clock();
    const activatedOn = colombiaLocalDate(confirmedAt);
    if (activatedOn !== input.expectedActivationDate) return { outcome: 'activation-date-changed' };
    const created = await transaction.passportMatchAllowance.create({
      data: { passportId: input.passportId, activatedOn: new Date(`${activatedOn}T00:00:00.000Z`), version: 1 }, select: { id: true },
    });
    const revision = await transaction.passportMatchAllowanceRevision.create({
      data: { allowanceId: created.id, sequence: 1, idempotencyKey: input.idempotencyKey,
        expectedVersion: 0, cadence: input.cadence, matchLimit: BigInt(input.matchLimit),
        effectiveOn: new Date(`${activatedOn}T00:00:00.000Z`),
        previousCadence: null, previousMatchLimit: null, previousEffectiveOn: null,
        supersededPendingRevision: false, confirmedByIdentityId: input.administratorIdentityId, confirmedAt },
      select: { id: true, confirmedAt: true },
    });
    return { outcome: 'applied', configuration: configuration(input.cadence, input.matchLimit, activatedOn, revision.confirmedAt), colombiaToday: activatedOn };
  }
}

function configuration(cadence: AllowanceCadence, matchLimit: number, date: string, confirmedAt: Date) {
  const period = periodContaining(date, cadence, date);
  return { version: 1, activatedOn: date, currentRule: { cadence, matchLimit, effectiveOn: date },
    currentPeriod: { start: period.start, endExclusive: period.endExclusive }, pendingRule: null, lastModifiedAt: confirmedAt.toISOString() };
}

function validInput(value: unknown): value is CreateAllowanceInput {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((key) => !['passportId', 'administratorIdentityId', 'expectedVersion', 'idempotencyKey', 'cadence', 'matchLimit', 'expectedActivationDate'].includes(key))) return false;
  if (!UUID.test(String(v.passportId)) || !UUID.test(String(v.administratorIdentityId)) || !UUID.test(String(v.idempotencyKey))) return false;
  if (v.expectedVersion !== 0 || typeof v.cadence !== 'string' || !CADENCES.has(v.cadence as AllowanceCadence)) return false;
  if (typeof v.matchLimit !== 'number' || !Number.isSafeInteger(v.matchLimit) || v.matchLimit <= 0) return false;
  if (typeof v.expectedActivationDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.expectedActivationDate)) return false;
  const date = new Date(`${v.expectedActivationDate}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === v.expectedActivationDate;
}

function validConfirmInput(value: unknown): value is ConfirmAllowanceInput {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  if (input.expectedVersion === 0) return validInput(value);
  if (Object.keys(input).some((key) => !['passportId', 'administratorIdentityId', 'expectedVersion', 'idempotencyKey', 'cadence', 'matchLimit'].includes(key))) return false;
  return UUID.test(String(input.passportId)) && UUID.test(String(input.administratorIdentityId)) && UUID.test(String(input.idempotencyKey))
    && typeof input.expectedVersion === 'number' && Number.isSafeInteger(input.expectedVersion) && input.expectedVersion > 0
    && typeof input.cadence === 'string' && CADENCES.has(input.cadence as AllowanceCadence)
    && typeof input.matchLimit === 'number' && Number.isSafeInteger(input.matchLimit) && input.matchLimit > 0;
}

function dateOnly(value: Date): string { return value.toISOString().slice(0, 10); }
function periodRevision(revision: StoredRevision): AllowanceRuleRevision {
  return { sequence: revision.sequence, effectiveOn: dateOnly(revision.effectiveOn), cadence: revision.cadence,
    matchLimit: Number(revision.matchLimit) };
}

function projectSnapshot(passportId: string, activatedOn: Date, version: number, revisions: readonly StoredRevision[], date: string, modifiedAt: Date) {
  const source = { passportId, activatedOn: dateOnly(activatedOn), revisions: revisions.map(periodRevision) };
  const active = resolveAllowancePeriod(source, date);
  const currentRevision = [...revisions].reverse().find((revision) => dateOnly(revision.effectiveOn) <= date);
  const pending = [...revisions].reverse().find((revision) => dateOnly(revision.effectiveOn) > date);
  return { version, activatedOn: source.activatedOn,
    currentRule: active && currentRevision ? { cadence: active.cadence, matchLimit: active.matchLimit,
      effectiveOn: dateOnly(currentRevision.effectiveOn) } : null,
    currentPeriod: active ? { start: active.period.start, endExclusive: active.period.endExclusive } : null,
    pendingRule: pending ? { cadence: pending.cadence, matchLimit: Number(pending.matchLimit), effectiveOn: dateOnly(pending.effectiveOn) } : null,
    lastModifiedAt: modifiedAt.toISOString() };
}
