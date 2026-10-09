import { describe, expect, it } from 'vitest';

import {
  allowanceBoundary,
  colombiaLocalDate,
  periodContaining,
  type AllowanceCadence,
} from './allowance-period.js';

describe('Feature 008 allowance period boundaries', () => {
  it.each([
    ['MONTHLY', '2026-11-09'],
    ['QUARTERLY', '2027-01-09'],
    ['SEMIANNUAL', '2027-04-09'],
    ['ANNUAL', '2027-10-09'],
  ] as const)('%s uses its calendar-month anniversary', (cadence, endExclusive) => {
    expect(periodContaining('2026-10-09', cadence, '2026-10-09')).toEqual({
      start: '2026-10-09',
      endExclusive,
      nextStart: endExclusive,
    });
  });

  it('treats 9 October–8 November as one monthly period, with an exclusive 9 November end', () => {
    expect(periodContaining('2026-10-09', 'MONTHLY', '2026-11-08')).toMatchObject({
      start: '2026-10-09',
      endExclusive: '2026-11-09',
    });
    expect(periodContaining('2026-10-09', 'MONTHLY', '2026-11-09')).toEqual({
      start: '2026-11-09',
      endExclusive: '2026-12-09',
      nextStart: '2026-12-09',
    });
  });

  it('uses the Colombia date at the UTC midnight boundary', () => {
    expect(colombiaLocalDate(new Date('2026-10-09T04:59:59.999Z'))).toBe('2026-10-08');
    expect(colombiaLocalDate(new Date('2026-10-09T05:00:00.000Z'))).toBe('2026-10-09');
  });

  it('clamps absent 29, 30 and 31 anniversaries without shifting the original anchor', () => {
    expect(allowanceBoundary('2024-01-29', 'MONTHLY', 1)).toBe('2024-02-29');
    expect(allowanceBoundary('2026-01-29', 'MONTHLY', 1)).toBe('2026-02-28');
    expect(allowanceBoundary('2026-01-30', 'MONTHLY', 1)).toBe('2026-02-28');
    expect(allowanceBoundary('2026-01-30', 'MONTHLY', 2)).toBe('2026-03-30');
    expect(allowanceBoundary('2026-01-31', 'MONTHLY', 1)).toBe('2026-02-28');
    expect(allowanceBoundary('2026-01-31', 'MONTHLY', 2)).toBe('2026-03-31');
    expect(allowanceBoundary('2026-01-31', 'MONTHLY', 3)).toBe('2026-04-30');
    expect(allowanceBoundary('2026-01-31', 'MONTHLY', 4)).toBe('2026-05-31');
  });

  it('handles quarter, half-year, year rollover and leap-day anchors', () => {
    expect(allowanceBoundary('2023-11-30', 'QUARTERLY', 1)).toBe('2024-02-29');
    expect(allowanceBoundary('2023-11-30', 'QUARTERLY', 2)).toBe('2024-05-30');
    expect(allowanceBoundary('2026-10-31', 'SEMIANNUAL', 1)).toBe('2027-04-30');
    expect(allowanceBoundary('2026-10-31', 'SEMIANNUAL', 2)).toBe('2027-10-31');
    expect(allowanceBoundary('2024-02-29', 'ANNUAL', 1)).toBe('2025-02-28');
    expect(allowanceBoundary('2024-02-29', 'ANNUAL', 4)).toBe('2028-02-29');
  });

  it.each(['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'] as AllowanceCadence[])(
    '%s produces adjacent intervals without gaps or overlap',
    (cadence) => {
      for (let index = 0; index < 36; index += 1) {
        const start = allowanceBoundary('2024-01-31', cadence, index);
        const endExclusive = allowanceBoundary('2024-01-31', cadence, index + 1);
        expect(periodContaining('2024-01-31', cadence, start)).toEqual({
          start,
          endExclusive,
          nextStart: endExclusive,
        });
        expect(endExclusive > start).toBe(true);
      }
    },
  );

  it('uses a new anchor only for a cadence change, while a limit-only change keeps it', () => {
    const oldPeriod = periodContaining('2026-01-31', 'MONTHLY', '2026-02-10');
    expect(oldPeriod.endExclusive).toBe('2026-02-28');
    expect(periodContaining('2026-01-31', 'MONTHLY', '2026-03-15').start).toBe('2026-02-28');
    expect(periodContaining(oldPeriod.nextStart, 'QUARTERLY', '2026-03-15')).toEqual({
      start: '2026-02-28',
      endExclusive: '2026-05-28',
      nextStart: '2026-05-28',
    });
  });
});
