import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import './global.css';

import { AuthenticationProvider, useAuthentication } from '../src/authentication/authentication-provider';
import { RestorationGate } from '../src/authentication/components/restoration-gate';

function RoutedApplication() {
  const router = useRouter();
  const segments = useSegments() as unknown as string[];
  const authentication = useAuthentication();
  const inAuthenticationGroup = segments.includes('(auth)');
  const inAuthenticatedGroup = segments.includes('(authenticated)');

  useEffect(() => {
    if (authentication.state.phase === 'authenticated' && !inAuthenticatedGroup) router.replace('/(authenticated)' as never);
    if (authentication.state.phase === 'activation-success' && !inAuthenticationGroup) router.replace('/(auth)/activate-initial-access' as never);
    if (['unauthenticated', 'session-expired', 'connectivity-failure', 'backend-unavailable'].includes(authentication.state.phase) && !inAuthenticationGroup) router.replace('/(auth)/login' as never);
  }, [authentication.state.phase, inAuthenticatedGroup, inAuthenticationGroup, router]);

  return <RestorationGate phase={authentication.state.phase} onRetry={() => { void authentication.restore(); }}><Slot /></RestorationGate>;
}

export default function RootLayout() {
  return <AuthenticationProvider><RoutedApplication /></AuthenticationProvider>;
}
