import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';

import { useAuthentication } from '../../../src/authentication/authentication-provider';
import { createAnalystWorkspaceApi } from '../../../src/analyst-workspace/analyst-workspace-api';
import { AnalystOverviewView } from '../../../src/analyst-workspace/analyst-overview';
import { AnalystWorkspaceStateMachine } from '../../../src/analyst-workspace/analyst-workspace-state';

export default function AnalystEntryRoute() {
  const authentication = useAuthentication();
  const router = useRouter();
  const [navigationNotice, setNavigationNotice] = useState<string | null>(null);
  const api = useMemo(() => createAnalystWorkspaceApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const machine = useMemo(() => new AnalystWorkspaceStateMachine(api), [api]);
  const state = useSyncExternalStore(machine.subscribe, () => machine.state, () => machine.state);
  const allowed = authentication.state.phase === 'authenticated'
    && authentication.sessionAccess?.classification === 'product'
    && authentication.sessionAccess.capabilities.includes('passport.review');

  useEffect(() => { if (!allowed) machine.clear(); }, [allowed, machine]);

  useFocusEffect(useCallback(() => {
    setNavigationNotice(null);
    if (allowed) void machine.load();
    else machine.clear();
  }, [allowed, machine]));
  useEffect(() => () => machine.dispose(), [machine]);

  const navigate = (destination: 'Inicio' | 'Pasaportes' | 'Partidos') => {
    if (destination === 'Pasaportes') { router.push('/(authenticated)/analyst/passports' as never); return; }
    if (destination === 'Partidos') router.push('/(authenticated)/analyst/matches' as never);
  };
  return <AnalystOverviewView overview={allowed ? state.overview : null} kind={allowed ? state.kind : 'restricted'}
    onRetry={() => { void machine.load(); }} onCalendar={() => navigate('Partidos')}
    onLogout={() => { machine.clear(); void authentication.logout('current').then(() => router.replace('/(auth)/login' as never)); }}
    onOpenMatch={(id) => router.push(`/(authenticated)/analyst/matches/${id}` as never)} onNavigate={navigate} navigationNotice={navigationNotice} />;
}
