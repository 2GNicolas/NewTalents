import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { PassportPresentationShell } from '../../src/passport/presentation/passport-presentation-shell';
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

describe('Feature 005 responsive passport navigation', () => {
  it('keeps the player identity visible and renders horizontal tabs below it on mobile', async () => {
    const onSelect = jest.fn();
    const screen = await render(
      <PassportPresentationShell
        activeKey="resumen"
        onSelect={onSelect}
        player={player}
        viewportWidth={400}
      >
        <Text>Contenido</Text>
      </PassportPresentationShell>,
    );

    expect(screen.getByTestId('passport-presentation-mobile')).toBeTruthy();
    expect(screen.getByTestId('passport-player-identity')).toBeTruthy();
    expect(screen.getByTestId('passport-nav-mobile')).toBeTruthy();
    expect(screen.getByTestId('passport-nav-horizontal')).toBeTruthy();
    expect(screen.queryByTestId('passport-nav-vertical')).toBeNull();
    expect(screen.getByRole('button', { name: 'Resumen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Estadísticas' })).toBeTruthy();
  });

  it('renders vertical navigation in the desktop left column and never hides the identity area', async () => {
    const onSelect = jest.fn();
    const screen = await render(
      <PassportPresentationShell
        activeKey="estadisticas"
        onSelect={onSelect}
        player={player}
        viewportWidth={1024}
      >
        <Text>Contenido</Text>
      </PassportPresentationShell>,
    );

    expect(screen.getByTestId('passport-presentation-desktop')).toBeTruthy();
    expect(screen.getByTestId('passport-player-identity')).toBeTruthy();
    expect(screen.getByTestId('passport-nav-desktop')).toBeTruthy();
    expect(screen.getByTestId('passport-nav-vertical')).toBeTruthy();
    expect(screen.queryByTestId('passport-nav-horizontal')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Videos' }));
    expect(onSelect).toHaveBeenCalledWith('videos');
  });
});
