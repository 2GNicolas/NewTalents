import type { ContextKey } from './analyst-match-upload-state';

// Descriptive observations from the approved manual's section 3. These are
// capture facts, never FEM weights or values inferred from the video minute.
export const contextChoices: Record<ContextKey, readonly string[]> = {
  spatial: ['Área propia', 'Primer tercio', 'Zona media', 'Último tercio', 'Área rival'],
  temporal: ['Primer 20 %', '20 % a menos de 40 %', '40 % a menos de 60 %',
    '60 % a menos de 80 %', 'Desde el 80 %'],
  competitive: ['Ganando', 'Empatando', 'Perdiendo'],
  pressure: ['Sin presión', 'Baja', 'Media', 'Alta'],
  positional: ['Arquero', 'Central', 'Lateral', 'Volante', 'Extremo', 'Delantero'],
};

export const temporalHelp = 'Elige el tramo según la duración reglamentaria real del partido. '
  + 'No se deduce del minuto del video; si no puedes determinarlo, elige No observable.';
export const temporalShortLabel: Record<string, string> = {
  'Primer 20 %': 'Primer 20 %',
  '20 % a menos de 40 %': '20–40 %',
  '40 % a menos de 60 %': '40–60 %',
  '60 % a menos de 80 %': '60–80 %',
  'Desde el 80 %': 'Desde 80 %',
};
