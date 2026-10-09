import { allowancePeriodLabel, formatColombiaDate } from './allowance-period-presentation';

describe('date-only allowance presentation', () => {
  it('shows 9 October through 8 November inclusively and the next start on 9 November', () => {
    expect(allowancePeriodLabel({ start: '2026-10-09', endExclusive: '2026-11-09' })).toMatchObject({ start: '9 oct. 2026', lastIncluded: '8 nov. 2026', nextStart: '9 nov. 2026' });
  });
  it('preserves 29–31 and leap transitions without browser-timezone shifts', () => {
    expect(allowancePeriodLabel({ start: '2026-01-31', endExclusive: '2026-02-28' }).lastIncluded).toBe('27 feb. 2026');
    expect(allowancePeriodLabel({ start: '2024-01-31', endExclusive: '2024-02-29' }).nextStart).toBe('29 feb. 2024');
    expect(formatColombiaDate('2026-12-31')).toBe('31 dic. 2026');
  });
});
