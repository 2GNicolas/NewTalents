import { Slot, useGlobalSearchParams, usePathname, useRouter } from 'expo-router';

import { useAuthentication } from './authentication-provider';
import { useAuthenticatedRouteSync } from './authenticated-route-policy';
import { RestorationGate } from './components/restoration-gate';

export function AuthenticatedRootShell() {
  const router = useRouter();
  const pathname = usePathname();
  const { preview } = useGlobalSearchParams<{ preview?: string }>();
  const authentication = useAuthentication();
  const visualPreview = preview === 'desktop' || preview === 'mobile';

  useAuthenticatedRouteSync(authentication.state, pathname, (href) => {
    router.replace(href as never);
  }, authentication.sessionAccess, visualPreview);

  if (visualPreview) return <Slot />;

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
