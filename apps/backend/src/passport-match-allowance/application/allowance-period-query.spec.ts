import { describe, expect, it } from 'vitest';

import { resolveAllowancePeriod } from './allowance-period-query.js';

const base = { passportId: 'passport-1', activatedOn: '2026-10-09', revisions: [
  { sequence: 1, effectiveOn: '2026-10-09', cadence: 'MONTHLY' as const, matchLimit: 4 },
] };

describe('allowance period read port', () => {
  it('returns no rule for an unconfigured passport or before activation', () => {
    expect(resolveAllowancePeriod(null, '2026-10-09')).toBeNull();
    expect(resolveAllowancePeriod(base, '2026-10-08')).toBeNull();
  });

  it('resolves the current rule at a supplied Colombia calendar date without usage', () => {
    expect(resolveAllowancePeriod(base, '2026-10-31')).toEqual({
      passportId: 'passport-1', cadence: 'MONTHLY', matchLimit: 4,
      period: { start: '2026-10-09', endExclusive: '2026-11-09', nextStart: '2026-11-09' },
    });
  });

  it('keeps the original anchor when only the limit changes and ignores pending revisions', () => {
    const configured = { passportId: 'p', activatedOn: '2026-01-31', revisions: [
      { sequence: 1, effectiveOn: '2026-01-31', cadence: 'MONTHLY' as const, matchLimit: 2 },
      { sequence: 2, effectiveOn: '2026-02-28', cadence: 'MONTHLY' as const, matchLimit: 3 },
    ] };
    expect(resolveAllowancePeriod(configured, '2026-02-27')?.matchLimit).toBe(2);
    expect(resolveAllowancePeriod(configured, '2026-03-01')?.period).toEqual({ start: '2026-02-28', endExclusive: '2026-03-31', nextStart: '2026-03-31' });
    expect(resolveAllowancePeriod(configured, '2026-03-31')?.matchLimit).toBe(3);
  });

  it('reanchors a changed cadence at its effective old boundary', () => {
    const configured = { ...base, revisions: [
      ...base.revisions,
      { sequence: 2, effectiveOn: '2026-11-09', cadence: 'QUARTERLY' as const, matchLimit: 5 },
    ] };
    expect(resolveAllowancePeriod(configured, '2026-11-08')?.period.endExclusive).toBe('2026-11-09');
    expect(resolveAllowancePeriod(configured, '2026-11-10')).toMatchObject({
      cadence: 'QUARTERLY', matchLimit: 5,
      period: { start: '2026-11-09', endExclusive: '2027-02-09' },
    });
  });
});
