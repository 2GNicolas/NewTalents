import { render } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import RuntimeEntry, { fixedViewportBackground, publicEntryViewportStyle } from '../app/index';

describe('public registration runtime entry', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders the approved registration entry and existing login link', async () => {
    const view = await render(<RuntimeEntry />);
    expect(view.getByRole('header', { name: 'Tu talento merece ser visto.' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Crear solicitud de registro' })).toBeTruthy();
    expect(view.getByRole('link')).toBeTruthy();
    expect(view.queryByText('Activar acceso inicial')).toBeNull();
  });

  it.each([390, 1024])('renders the approved entry at %ipx width', async (width) => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
    const view = await render(<RuntimeEntry />);
    expect(view.getByRole('button', { name: 'Crear solicitud de registro' })).toBeTruthy();
  });

  it('uses a fixed full-viewport cover layer instead of sizing the image to its asset width', async () => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1916, height: 940, scale: 1, fontScale: 1 });
    const view = await render(<RuntimeEntry />);
    expect(publicEntryViewportStyle(1916, 940)).toEqual({ minHeight: 940, minWidth: 1916 });
    expect(fixedViewportBackground('web')).toMatchObject({ bottom: 0, left: 0, position: 'fixed', right: 0, top: 0 });
    const backgroundImage = view.getByTestId('public-entry-background-image');
    expect(backgroundImage.props.resizeMode).toBe('cover');
    expect(ReactNative.StyleSheet.flatten(backgroundImage.props.style)).toMatchObject({ height: '100%', width: '100%' });
  });
});
