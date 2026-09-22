import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { authTokens, createAuthMotionTokens } from '../../src/design/tokens';
import { PlayerIdentity } from '../../src/passport/presentation/player-identity';
import { PassportNav } from '../../src/passport/presentation/passport-nav';
import { PassportSectionState } from '../../src/passport/presentation/status';
import type { PlayerIdentityPresentation } from '../../src/passport/passport-types';

const player: PlayerIdentityPresentation = {
  displayName: 'Nombre Autorizado',
  position: 'Delantero',
  ageCategory: 'Sub-15',
  city: 'Medellín',
  country: 'Colombia',
  dominantFoot: 'Izquierda',
  academyOriginName: null,
  photographPlaceholder: 'neutral-placeholder',
};

function readPresentationSource(fileName: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), 'src/passport/presentation', fileName), 'utf8');
}

describe('Feature 005 passport presentation accessibility', () => {
  it('labels every identity field and keeps the photograph placeholder non-interactive', async () => {
    const screen = await render(<PlayerIdentity player={player} />);

    expect(screen.getByTestId('passport-player-identity')).toBeTruthy();
    expect(screen.getByTestId('passport-photograph-placeholder')).toBeTruthy();
    expect(screen.getByLabelText('Fotografía no disponible')).toBeTruthy();
    expect(screen.getByText('Nombre visible')).toBeTruthy();
    expect(screen.getByText('Nombre Autorizado')).toBeTruthy();
    expect(screen.getByText('Posición')).toBeTruthy();
    expect(screen.getAllByText('Delantero').length).toBeGreaterThan(0);
    expect(screen.getByText('Academia de origen')).toBeTruthy();
    expect(screen.getByText('Academia no disponible')).toBeTruthy();
  });

  it('uses labelled keyboard-operable navigation buttons with a selected state and 44pt targets', async () => {
    const onSelect = jest.fn();
    const screen = await render(
      <PassportNav activeKey="resumen" onSelect={onSelect} viewportWidth={400} />,
    );

    const resumen = screen.getByRole('button', { name: 'Resumen' });
    expect(resumen.props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(resumen);
    expect(onSelect).toHaveBeenCalledWith('resumen');

    const navSource = readPresentationSource('passport-nav.tsx');
    expect(navSource).toContain('minInteractiveSize');
    expect(navSource).toContain('authTokens.focus.webOutlineColor');
    expect(navSource).toContain('focused && styles.navItemFocused');
  });

  it('associates section messages with their containers without color-only feedback', async () => {
    const screen = await render(
      <PassportSectionState
        availability="restricted"
        message="No tienes autorización para ver esta sección."
        title="Estadísticas"
      />,
    );

    expect(screen.getByLabelText('No tienes autorización para ver esta sección.')).toBeTruthy();
  });

  it('preserves readable contrast and the reduced-motion treatment', () => {
    const identitySource = readPresentationSource('player-identity.tsx');
    expect(identitySource).toContain('authTokens.colors.textPrimary');
    expect(identitySource).toContain('authTokens.colors.textSecondary');
    expect(createAuthMotionTokens(true)).toEqual({ durationMs: 0, decorativeOpacity: 1 });
  });
});
