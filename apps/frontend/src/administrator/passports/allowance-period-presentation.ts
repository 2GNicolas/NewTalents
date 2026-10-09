const months = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sept.', 'oct.', 'nov.', 'dic.'] as const;

function dateParts(value: string): Readonly<{ year: number; month: number; day: number }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid date-only value');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  if (date.toISOString().slice(0, 10) !== value) throw new Error('Invalid date-only value');
  return { year: year!, month: month!, day: day! };
}
export function formatColombiaDate(value: string): string {
  const { year, month, day } = dateParts(value);
  return `${day} ${months[month - 1]} ${year}`;
}
function dayBefore(value: string): string {
  const { year, month, day } = dateParts(value);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}
export function allowancePeriodLabel(period: Readonly<{ start: string; endExclusive: string }>) {
  if (period.start >= period.endExclusive) throw new Error('Invalid allowance period');
  return { start: formatColombiaDate(period.start), lastIncluded: formatColombiaDate(dayBefore(period.endExclusive)), nextStart: formatColombiaDate(period.endExclusive) };
}
