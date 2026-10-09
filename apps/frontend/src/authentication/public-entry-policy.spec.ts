import { PUBLIC_REGISTRATION_CTA, isPublicRegistrationRoute, resolvePublicEntryDestination } from './public-entry-policy';
import { fireEvent, render } from '@testing-library/react-native';
import { createElement } from 'react';

import RuntimeEntry from '../../app/index';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));

describe('public registration entry policy', () => {
  it('uses the approved customer CTA and exposes no temporary activation entry', () => {
    expect(PUBLIC_REGISTRATION_CTA).toBe('Crear solicitud de registro');
    expect(isPublicRegistrationRoute('/registration')).toBe(true);
    expect(isPublicRegistrationRoute('/activate-initial-access')).toBe(false);
    expect(isPublicRegistrationRoute('/registration/22222222-2222-4222-8222-222222222222')).toBe(false);
  });

  it('renders an accessible public CTA and navigates to the public registration group', async () => {
    const screen = await render(createElement(RuntimeEntry));
    const cta = screen.getByRole('button', { name: PUBLIC_REGISTRATION_CTA });
    fireEvent.press(cta);
    expect(mockPush).toHaveBeenCalledWith('/(public)/registration');
    expect(screen.queryByText('Activar acceso inicial')).toBeNull();
  });

  it('keeps public visitors on registration and restores pending applicants to only their own request', () => {
    expect(resolvePublicEntryDestination(null)).toBe('/(public)/registration');
    expect(resolvePublicEntryDestination({ classification: 'pending-onboarding', requestId: '22222222-2222-4222-8222-222222222222', capabilities: ['registration.request.own.view'] }))
      .toBe('/(pending)/registration/22222222-2222-4222-8222-222222222222');
  });

  it('fails closed for incomplete pending projections and preserves existing product entry', () => {
    expect(resolvePublicEntryDestination({ classification: 'pending-onboarding', capabilities: [] })).toBe('/(auth)/login');
    expect(resolvePublicEntryDestination({ classification: 'product', capabilities: ['passport.particular.manage'] })).toBe('/(authenticated)/passports');
  });
});
