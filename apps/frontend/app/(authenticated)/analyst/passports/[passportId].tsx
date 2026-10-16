import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuthentication } from '../../../../src/authentication/authentication-provider';
import { AnalystPassportDetailView } from '../../../../src/analyst-workspace/analyst-passports';
import { passportDetailState } from '../../../../src/analyst-workspace/analyst-passport-state';
import { createAnalystWorkspaceApi } from '../../../../src/analyst-workspace/analyst-workspace-api';

export default function AnalystPassportDetailRoute() {
  const authentication = useAuthentication();
  const router = useRouter();
  const params = useLocalSearchParams<{ passportId: string }>();
  const passportId = typeof params.passportId === 'string' ? params.passportId : '';
  const api = useMemo(() => createAnalystWorkspaceApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const machine = useMemo(() => passportDetailState(api, passportId), [api, passportId]);
  const state = useSyncExternalStore(machine.subscribe, () => machine.state, () => machine.state);
  const allowed = authentication.state.phase === 'authenticated' && authentication.sessionAccess?.classification === 'product'
    && authentication.sessionAccess.capabilities.includes('passport.review');
  useEffect(() => { if (!allowed) machine.clear(); }, [allowed, machine]);
  useFocusEffect(useCallback(() => { if (allowed && passportId) void machine.load(); else machine.clear(); }, [allowed, passportId, machine]));
  useEffect(() => () => machine.dispose(), [machine]);
  return <AnalystPassportDetailView kind={allowed ? state.kind : 'restricted'} detail={allowed && state.kind === 'ready' ? state.value : null}
    onBack={() => router.replace('/(authenticated)/analyst/passports' as never)} onRetry={() => { void machine.load(); }}
    onLogout={() => { machine.clear(); void authentication.logout('current').then(() => router.replace('/(auth)/login' as never)); }}
    onNavigate={(destination) => { if (destination === 'Inicio') router.push('/(authenticated)/analyst' as never);
      if (destination === 'Pasaportes') router.push('/(authenticated)/analyst/passports' as never);
      if (destination === 'Partidos') router.push('/(authenticated)/analyst/matches' as never); }} />;
}
