import type { PassportSectionKey } from '../passport-types';

export type PassportSectionDescriptor = Readonly<{
  key: PassportSectionKey;
  title: string;
}>;

export const PASSPORT_SECTION_KEYS: readonly PassportSectionKey[] = Object.freeze([
  'resumen',
  'estadisticas',
  'partidos',
  'videos',
]);

export const PASSPORT_SECTIONS: readonly PassportSectionDescriptor[] = Object.freeze([
  { key: 'resumen', title: 'Resumen' },
  { key: 'estadisticas', title: 'Estadísticas' },
  { key: 'partidos', title: 'Partidos' },
  { key: 'videos', title: 'Videos' },
]);

const SECTION_BY_KEY: ReadonlyMap<PassportSectionKey, PassportSectionDescriptor> = new Map(
  PASSPORT_SECTIONS.map((section) => [section.key, section]),
);

export function getPassportSection(key: PassportSectionKey): PassportSectionDescriptor {
  return SECTION_BY_KEY.get(key) ?? PASSPORT_SECTIONS[0]!;
}
