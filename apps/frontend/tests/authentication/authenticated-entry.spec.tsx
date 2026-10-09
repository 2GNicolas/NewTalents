import { render, waitFor } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ replace: jest.fn(), push: jest.fn() })),
}));

import AuthenticatedRouteShell from '../../app/(authenticated)/index';
import { AUTHENTICATED_PRODUCT_ENTRY } from '../../src/authentication/authenticated-destination';
import { useRouter } from 'expo-router';

describe('authenticated product entry', () => {
  it('redirects the obsolete neutral boundary to the passport product entry', async () => {
    const replace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace });
    const screen = await render(<AuthenticatedRouteShell />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(AUTHENTICATED_PRODUCT_ENTRY));
    expect(screen.queryByText(/Acceso activo/)).toBeNull();
    expect(screen.queryByText(/próximos módulos/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Cerrar sesión/ })).toBeNull();
  });

  it('keeps a single non-role-specific product destination for the authenticated root', () => {
    const layoutSource = readFileSync(resolve(process.cwd(), 'app/_layout.tsx'), 'utf8');
    const routePolicySource = readFileSync(resolve(process.cwd(), 'src/authentication/authenticated-route-policy.ts'), 'utf8');
    expect(layoutSource).toContain('AuthenticatedRootShell');
    expect(layoutSource).not.toContain("router.replace('/(authenticated)'");
    expect(routePolicySource).toContain('AUTHENTICATED_PRODUCT_ENTRY');
    expect(routePolicySource).not.toContain('useSegments');
    expect(AUTHENTICATED_PRODUCT_ENTRY).toBe('/(authenticated)/passports');
  });
});
