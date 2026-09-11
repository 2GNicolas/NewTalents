import { render } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import RuntimeEntry from '../app/index';

describe('neutral runtime entry', () => {
  const original = process.env.EXPO_PUBLIC_API_BASE_URL;
  afterEach(() => { process.env.EXPO_PUBLIC_API_BASE_URL = original; });

  it('renders only a neutral ready state for valid configuration', async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    const view = await render(<RuntimeEntry />);
    expect(view.getByRole('header', { name: 'New Talents' })).toBeTruthy();
    expect(view.getByText('Runtime frontend listo')).toBeTruthy();
    expect(view.queryByText(/iniciar sesión|pasaporte|estadísticas|academia/i)).toBeNull();
  });

  it('renders a safe non-ready state for invalid configuration', async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = '__REQUIRED__';
    const view = await render(<RuntimeEntry />);
    expect(view.getByText('Configuración frontend inválida')).toBeTruthy();
    expect(view.queryByText('Runtime frontend listo')).toBeNull();
    expect(view.queryByText('__REQUIRED__')).toBeNull();
  });

  it.each([390, 1024])('renders the neutral state at %ipx width', async (width) => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    const view = await render(<RuntimeEntry />);
    expect(view.getByText('Runtime frontend listo')).toBeTruthy();
    jest.restoreAllMocks();
  });
});
