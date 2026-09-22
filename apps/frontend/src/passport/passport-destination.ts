import type { PassportSummaryResponse } from './passport-types';
export type PassportDestination = Readonly<{ href: string; label: string }>;
export function getPassportDestination(passport: PassportSummaryResponse): PassportDestination {
  return { href: `/passports/${encodeURIComponent(passport.passportId)}/sections/resumen`, label: 'Ver pasaporte' };
}
