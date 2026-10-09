/** A date-only Colombia calendar value, formatted as YYYY-MM-DD. */
export type CalendarDate = string;
export type AllowanceCadence = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';

export type AllowancePeriod = Readonly<{
  start: CalendarDate;
  endExclusive: CalendarDate;
  nextStart: CalendarDate;
}>;

const MONTHS_BY_CADENCE: Readonly<Record<AllowanceCadence, number>> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
};

const colombiaFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function colombiaLocalDate(instant: Date): CalendarDate {
  if (!Number.isFinite(instant.getTime())) {
    throw new RangeError('Invalid instant');
  }
  const parts = colombiaFormatter.formatToParts(instant);
  const field = (kind: 'year' | 'month' | 'day'): string => {
    const value = parts.find((part) => part.type === kind)?.value;
    if (!value) throw new RangeError('Invalid Colombia calendar date');
    return value;
  };
  return `${field('year')}-${field('month')}-${field('day')}`;
}

export function allowanceBoundary(
  anchor: CalendarDate,
  cadence: AllowanceCadence,
  index: number,
): CalendarDate {
  const { year, month, day } = parseDate(anchor);
  const months = MONTHS_BY_CADENCE[cadence];
  if (!months || !Number.isSafeInteger(index) || index < 0) {
    throw new RangeError('Invalid cadence or boundary index');
  }

  const targetMonthIndex = year * 12 + month - 1 + index * months;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12 + 1;
  if (targetYear < 1 || targetYear > 9999) {
    throw new RangeError('Boundary outside supported calendar years');
  }
  const lastDay = daysInMonth(targetYear, targetMonth);
  return formatDate(targetYear, targetMonth, Math.min(day, lastDay));
}

export function periodContaining(
  anchor: CalendarDate,
  cadence: AllowanceCadence,
  onDate: CalendarDate,
): AllowancePeriod {
  const startDate = parseDate(anchor);
  const requestedDate = parseDate(onDate);
  if (onDate < anchor) throw new RangeError('Date precedes the segment anchor');

  const cadenceMonths = MONTHS_BY_CADENCE[cadence];
  if (!cadenceMonths) throw new RangeError('Invalid cadence');
  const monthDistance = (requestedDate.year - startDate.year) * 12
    + requestedDate.month - startDate.month;
  let index = Math.floor(monthDistance / cadenceMonths);
  while (index > 0 && allowanceBoundary(anchor, cadence, index) > onDate) index -= 1;
  while (allowanceBoundary(anchor, cadence, index + 1) <= onDate) index += 1;

  const start = allowanceBoundary(anchor, cadence, index);
  const endExclusive = allowanceBoundary(anchor, cadence, index + 1);
  return { start, endExclusive, nextStart: endExclusive };
}

function parseDate(value: CalendarDate): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError('Invalid calendar date');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError('Invalid calendar date');
  }
  return { year, month, day };
}

function daysInMonth(year: number, month: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
}

function formatDate(year: number, month: number, day: number): CalendarDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
