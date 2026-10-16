import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuthentication } from '../../../../src/authentication/authentication-provider';
import { createAnalystWorkspaceApi } from '../../../../src/analyst-workspace/analyst-workspace-api';
import { AnalystMatchDetailView } from '../../../../src/analyst-workspace/analyst-matches';
import { matchDetailState } from '../../../../src/analyst-workspace/analyst-match-state';

export default function AnalystMatchDetailRoute() {
  const authentication = useAuthentication();
  const router = useRouter();
  const params = useLocalSearchParams<{ matchId: string }>();
  const matchId = typeof params.matchId === 'string' ? params.matchId : '';
  const api = useMemo(() => createAnalystWorkspaceApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const machine = useMemo(() => matchDetailState(api, matchId), [api, matchId]);
  const state = useSyncExternalStore(machine.subscribe, () => machine.state, () => machine.state);
  const allowed = authentication.state.phase === 'authenticated' && authentication.sessionAccess?.classification === 'product'
    && authentication.sessionAccess.capabilities.includes('passport.review');
  useEffect(() => { if (!allowed) machine.clear(); }, [allowed, machine]);
  useFocusEffect(useCallback(() => { if (allowed && matchId) void machine.load(); else machine.clear(); }, [allowed, matchId, machine]));
  useEffect(() => () => machine.dispose(), [machine]);
  return <AnalystMatchDetailView kind={allowed ? state.kind : 'restricted'} detail={allowed && state.kind === 'ready' ? state.value : null}
    onBack={() => router.replace('/(authenticated)/analyst/matches' as never)} onRetry={() => { void machine.load(); }}
    onLogout={() => { machine.clear(); void authentication.logout('current').then(() => router.replace('/(auth)/login' as never)); }}
    onNavigate={(destination) => { if (destination === 'Inicio') router.push('/(authenticated)/analyst' as never);
      if (destination === 'Pasaportes') router.push('/(authenticated)/analyst/passports' as never);
      if (destination === 'Partidos') router.push('/(authenticated)/analyst/matches' as never); }} />;
}
