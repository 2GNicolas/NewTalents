import { periodContaining, type AllowanceCadence, type CalendarDate } from '../domain/allowance-period.js';

export type AllowanceRuleRevision = Readonly<{
  sequence: number;
  effectiveOn: CalendarDate;
  cadence: AllowanceCadence;
  matchLimit: number;
}>;

export type AllowancePeriodSource = Readonly<{
  passportId: string;
  activatedOn: CalendarDate;
  revisions: readonly AllowanceRuleRevision[];
}>;

/** Date-only read port. No matches, reservations, or usage are read or written. */
export function resolveAllowancePeriod(source: AllowancePeriodSource | null, onDate: CalendarDate) {
  if (!source || onDate < source.activatedOn) return null;
  const revisions = [...source.revisions].sort((a, b) => a.sequence - b.sequence);
  let active: AllowanceRuleRevision | undefined;
  let anchor = source.activatedOn;
  for (const revision of revisions) {
    if (revision.effectiveOn > onDate) break;
    if (active && active.cadence !== revision.cadence) anchor = revision.effectiveOn;
    active = revision;
  }
  if (!active) return null;
  return Object.freeze({
    passportId: source.passportId,
    cadence: active.cadence,
    matchLimit: active.matchLimit,
    period: periodContaining(anchor, active.cadence, onDate),
  });
}
