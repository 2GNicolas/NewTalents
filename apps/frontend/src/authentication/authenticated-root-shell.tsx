import { Slot, usePathname, useRouter } from 'expo-router';

import { useAuthentication } from './authentication-provider';
import { useAuthenticatedRouteSync } from './authenticated-route-policy';
import { RestorationGate } from './components/restoration-gate';

export function AuthenticatedRootShell() {
  const router = useRouter();
  const pathname = usePathname();
  const authentication = useAuthentication();

  useAuthenticatedRouteSync(authentication.state, pathname, (href) => {
    router.replace(href as never);
  });

  return (
    <RestorationGate
      phase={authentication.state.phase}
      onRetry={() => {
        void authentication.restore();
      }}
    >
      <Slot />
    </RestorationGate>
  );
}