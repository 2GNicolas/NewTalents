import { render } from '@testing-library/react-native';

import { AuthenticationBrand } from './authentication-brand';

describe('AuthenticationBrand', () => {
  it('renders the approved visual lockup without the legacy circular subtitle', async () => {
    const screen = await render(<AuthenticationBrand variant="visual" />);
    expect(screen.getByLabelText('New Talents')).toBeTruthy();
    expect(screen.getByText('NT')).toBeTruthy();
    expect(screen.getByText('NEW TALENTS')).toBeTruthy();
    expect(screen.queryByText(/FÚTBOL · FUTURO · EVIDENCIA/i)).toBeNull();
  });

  it('renders the compact form mark separately', async () => {
    const screen = await render(<AuthenticationBrand variant="form" />);
    expect(screen.getByLabelText('New Talents')).toBeTruthy();
    expect(screen.getByText('NT')).toBeTruthy();
    expect(screen.queryByText('NEW TALENTS')).toBeNull();
  });
});
