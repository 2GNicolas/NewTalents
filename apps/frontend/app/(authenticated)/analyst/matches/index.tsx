import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';

import { useAuthentication } from '../../../../src/authentication/authentication-provider';
import { createAnalystWorkspaceApi, type AnalystMatchDetail } from '../../../../src/analyst-workspace/analyst-workspace-api';
import { AnalystMatchListView } from '../../../../src/analyst-workspace/analyst-matches';
import { matchListState } from '../../../../src/analyst-workspace/analyst-match-state';

export default function AnalystMatchesRoute() {
  const authentication = useAuthentication();
  const router = useRouter();
  const [extra, setExtra] = useState<AnalystMatchDetail[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>();
  const api = useMemo(() => createAnalystWorkspaceApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const machine = useMemo(() => matchListState(api), [api]);
  const state = useSyncExternalStore(machine.subscribe, () => machine.state, () => machine.state);
  const allowed = authentication.state.phase === 'authenticated' && authentication.sessionAccess?.classification === 'product'
    && authentication.sessionAccess.capabilities.includes('passport.review');
  useEffect(() => { if (!allowed) { machine.clear(); setExtra([]); setCursor(undefined); } }, [allowed, machine]);
  useFocusEffect(useCallback(() => {
    setExtra([]); setCursor(undefined);
    if (allowed) void machine.load(); else machine.clear();
  }, [allowed, machine]));
  useEffect(() => () => machine.dispose(), [machine]);
  useEffect(() => { if (state.kind !== 'ready') { setExtra([]); setCursor(undefined); } }, [state.kind]);
  const page = allowed && state.kind === 'ready' ? state.value : null;
  const more = async () => {
    const next = cursor === undefined ? page?.pagination.nextCursor : cursor ?? undefined;
    if (!next) return;
    const result = await api.matches(next);
    if (result.kind === 'restricted') { machine.clear(); return; }
    if (result.kind === 'success') { setExtra((prior) => [...prior, ...result.value.data]); setCursor(result.value.pagination.nextCursor ?? null); }
  };
  return <AnalystMatchListView kind={allowed ? state.kind : 'restricted'} data={page ? [...page.data, ...extra] : []}
    hasMore={Boolean(page && (cursor === undefined ? page.pagination.nextCursor : cursor))} onMore={() => { void more(); }}
    onOpen={(id) => router.push(`/(authenticated)/analyst/matches/${id}` as never)} onRetry={() => { void machine.load(); }}
    onLogout={() => { machine.clear(); setExtra([]); setCursor(undefined);
      void authentication.logout('current').then(() => router.replace('/(auth)/login' as never)); }}
    onNavigate={(destination) => { if (destination === 'Inicio') router.push('/(authenticated)/analyst' as never);
      if (destination === 'Pasaportes') router.push('/(authenticated)/analyst/passports' as never); }} />;
}
