import { fireEvent, render } from '@testing-library/react-native';
import { createElement } from 'react';

import RuntimeEntry from '../../app/index';
import { resolveRootRouteAction } from '../authentication/authenticated-route-policy';
import { PUBLIC_REGISTRATION_CTA, isPublicRegistrationRoute } from '../authentication/public-entry-policy';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));

describe('Feature 004 and public-entry compatibility regression', () => {
  beforeEach(() => mockPush.mockClear());

  it('preserves passport restoration, accessibility, and retryable restoration states', () => {
    const pathname = '/passports/13810119-eded-43b7-805c-8765abc1eec6/sections/resumen';
    for (const phase of ['restoring', 'refreshing', 'connectivity-failure', 'backend-unavailable'] as const) {
      expect(resolveRootRouteAction(phase, pathname)).toEqual({ type: 'none' });
    }
    expect(resolveRootRouteAction('authenticated', pathname, { classification: 'product', capabilities: ['passport.particular.manage'] })).toEqual({ type: 'none' });
    expect(resolveRootRouteAction('session-expired', pathname)).toEqual({ type: 'replace', href: '/(auth)/login' });
  });

  it('keeps the replacement public entry accessible and removes public initial activation', async () => {
    expect(PUBLIC_REGISTRATION_CTA).toBe('Crear solicitud de registro');
    expect(isPublicRegistrationRoute('/registration')).toBe(true);
    expect(isPublicRegistrationRoute('/activate-initial-access')).toBe(false);

    const screen = await render(createElement(RuntimeEntry));
    const registration = screen.getByRole('button', { name: PUBLIC_REGISTRATION_CTA });
    expect(registration.props.accessibilityRole).toBe('button');
    fireEvent.press(registration);
    expect(mockPush).toHaveBeenCalledWith('/(public)/registration');
    expect(screen.queryByText('Activar acceso inicial')).toBeNull();
  });
});
