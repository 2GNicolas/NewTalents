import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { AUTHENTICATED_PRODUCT_ENTRY } from '../../src/authentication/authenticated-destination';
import { AuthLoading } from '../../src/design/components/auth-primitives';

export default function AuthenticatedRouteShell() {
  const router = useRouter();

  useEffect(() => {
    router.replace(AUTHENTICATED_PRODUCT_ENTRY as never);
  }, [router]);

  return <AuthLoading label="Abriendo pasaportes" />;
}