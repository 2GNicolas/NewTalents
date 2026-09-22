import { render } from '@testing-library/react-native';

import { PassportSectionContent } from '../../src/passport/presentation/section-content';
import { presentationText } from '../../src/passport/presentation/player-identity';
import type { PassportSectionKey } from '../../src/passport/passport-types';

describe('Feature 005 designed presentation states', () => {
  it.each<PassportSectionKey>(['resumen', 'estadisticas', 'partidos', 'videos'])('preserves %s without invented values or future controls', async sectionKey => {
    const screen = await render(<PassportSectionContent sectionKey={sectionKey} scale={1} desktop={false} availability="unavailable" />);
    expect(screen.getAllByText('No disponible').length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByText('Mateo González')).toBeNull();
    expect(screen.queryByText('Ver en YouTube')).toBeNull();
  });

  it.each<[PassportSectionKey, string]>([
    ['resumen', 'Aún no hay información en el resumen.'],
    ['estadisticas', 'Sin estadísticas publicadas'],
    ['partidos', 'Aún no hay partidos publicados'],
    ['videos', 'Sin videos publicados'],
  ])('distinguishes empty %s from unavailable content', async (sectionKey, message) => {
    const screen = await render(<PassportSectionContent sectionKey={sectionKey} scale={1} desktop availability="empty" />);
    expect(screen.getByText(message)).toBeTruthy();
  });

  it('does not expose section regions in a restricted response', async () => {
    const screen = await render(<PassportSectionContent sectionKey="videos" scale={1} desktop availability="restricted" />);
    expect(screen.getByText('Acceso restringido')).toBeTruthy();
    expect(screen.queryByText('Mejores momentos')).toBeNull();
  });

  it.each(['Medell\uFFFDn', 'MedellÃ­n', 'Nombre Local bf72', 'bf72abcd-1234', 'a'.repeat(64), 'fixture'])('hides corrupted or technical text %s', value => {
    expect(presentationText(value)).toBe('No disponible');
  });

  it('preserves authorized Unicode data without deriving or inventing a correction', () => {
    expect(presentationText(' Medellín ')).toBe('Medellín');
    expect(presentationText('Ramírez')).toBe('Ramírez');
    expect(presentationText(null)).toBe('No disponible');
  });
});
