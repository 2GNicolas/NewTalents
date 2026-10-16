import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthentication } from '../../src/authentication/authentication-provider';
import { authenticatedEntry } from '../../src/authentication/authenticated-route-policy';

import { AuthLoading } from '../../src/design/components/auth-primitives';

export default function AuthenticatedRouteShell() {
  const router = useRouter();
  const authentication = useAuthentication();

  useEffect(() => {
    router.replace(authenticatedEntry(authentication.sessionAccess) as never);
  }, [authentication.sessionAccess, router]);

  return <AuthLoading label="Abriendo tu espacio" />;
}
