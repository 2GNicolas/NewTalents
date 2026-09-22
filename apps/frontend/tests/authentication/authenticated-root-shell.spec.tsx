import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  Slot: () => null,
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock('../../src/authentication/authentication-provider', () => ({
  useAuthentication: jest.fn(),
}));

jest.mock('../../src/authentication/components/restoration-gate', () => ({
  RestorationGate: ({ children }: { children: unknown }) => children,
}));

import { AuthenticatedRootShell } from '../../src/authentication/authenticated-root-shell';
import { useAuthentication } from '../../src/authentication/authentication-provider';
import { usePathname, useRouter } from 'expo-router';

const usePathnameMock = usePathname as jest.Mock;
const useRouterMock = useRouter as jest.Mock;
const useAuthenticationMock = useAuthentication as jest.Mock;

function setAuthentication(phase: string) {
  useAuthenticationMock.mockReturnValue({
    state: { phase },
    restore: jest.fn(),
  });
}

describe('Feature 005 authenticated root shell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not replace a requested nested passport route after successful restoration', async () => {
    const replace = jest.fn();
    usePathnameMock.mockReturnValue('/passports/13810119-eded-43b7-805c-8765abc1eec6/sections/resumen');
    useRouterMock.mockReturnValue({ replace });
    setAuthentication('authenticated');

    await render(<AuthenticatedRootShell />);

    expect(replace).not.toHaveBeenCalled();
  });

  it('does not redirect to login while restoration is still pending', async () => {
    const replace = jest.fn();
    usePathnameMock.mockReturnValue('/passports/13810119-eded-43b7-805c-8765abc1eec6/sections/resumen');
    useRouterMock.mockReturnValue({ replace });
    setAuthentication('restoring');

    await render(<AuthenticatedRootShell />);

    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects safely to login after restoration proves no reusable session exists', async () => {
    const replace = jest.fn();
    usePathnameMock.mockReturnValue('/passports/13810119-eded-43b7-805c-8765abc1eec6/sections/resumen');
    useRouterMock.mockReturnValue({ replace });
    setAuthentication('session-expired');

    await render(<AuthenticatedRootShell />);

    expect(replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('keeps a retryable backend failure on the current route instead of treating it as logout', async () => {
    const replace = jest.fn();
    usePathnameMock.mockReturnValue('/passports/13810119-eded-43b7-805c-8765abc1eec6/sections/resumen');
    useRouterMock.mockReturnValue({ replace });
    setAuthentication('backend-unavailable');

    await render(<AuthenticatedRootShell />);

    expect(replace).not.toHaveBeenCalled();
  });
});