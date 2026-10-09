import type { PassportSummaryResponse } from './passport-types';
export type PassportDestination = Readonly<{ href: string; label: string }>;
export function getPassportDestination(passport: PassportSummaryResponse): PassportDestination {
  return { href: `/passports/${encodeURIComponent(passport.passportId)}/sections/resumen`, label: 'Ver pasaporte' };
}

export function getAuthorizedPassportDestination(passports: readonly PassportSummaryResponse[]): PassportDestination | null {
  if (passports.length === 0) return null;
  if (passports.length === 1) return getPassportDestination(passports[0]!);
  return { href: '/passports', label: 'Seleccionar pasaporte' };
}
