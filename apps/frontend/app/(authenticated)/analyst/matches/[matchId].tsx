import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuthentication } from '../../../../src/authentication/authentication-provider';
import { createAnalystWorkspaceApi } from '../../../../src/analyst-workspace/analyst-workspace-api';
import { AnalystMatchDetailView } from '../../../../src/analyst-workspace/analyst-matches';
import { matchDetailState } from '../../../../src/analyst-workspace/analyst-match-state';
import { createAnalystMatchUploadApi, type CaptureContext } from '../../../../src/analyst-match-upload/analyst-match-upload-api';

export default function AnalystMatchDetailRoute() {
  const authentication = useAuthentication();
  const router = useRouter();
  const params = useLocalSearchParams<{ matchId: string }>();
  const matchId = typeof params.matchId === 'string' ? params.matchId : '';
  const api = useMemo(() => createAnalystWorkspaceApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const machine = useMemo(() => matchDetailState(api, matchId), [api, matchId]);
  const captureApi = useMemo(() => createAnalystMatchUploadApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const [captureContext, setCaptureContext] = useState<CaptureContext | null>(null);
  const state = useSyncExternalStore(machine.subscribe, () => machine.state, () => machine.state);
  const allowed = authentication.state.phase === 'authenticated' && authentication.sessionAccess?.classification === 'product'
    && authentication.sessionAccess.capabilities.includes('passport.review');
  useEffect(() => { if (!allowed) { machine.clear(); setCaptureContext(null); } }, [allowed, machine]);
  useFocusEffect(useCallback(() => {
    let active = true;
    setCaptureContext(null);
    if (allowed && matchId) {
      void machine.load();
      void captureApi.capture(matchId).then((result) => { if (active) setCaptureContext(result.kind === 'success' ? result.value : null); });
    } else machine.clear();
    return () => { active = false; setCaptureContext(null); };
  }, [allowed, matchId, machine, captureApi]));
  useEffect(() => () => machine.dispose(), [machine]);
  return <AnalystMatchDetailView kind={allowed ? state.kind : 'restricted'} detail={allowed && state.kind === 'ready' ? state.value : null}
    captureAvailability={captureContext?.matchId === matchId ? captureContext.availability : undefined}
    onCapture={() => router.push(`/(authenticated)/analyst/matches/${matchId}/capture` as never)}
    onBack={() => router.replace('/(authenticated)/analyst/matches' as never)} onRetry={() => { void machine.load(); }}
    onLogout={() => { machine.clear(); void authentication.logout('current').then(() => router.replace('/(auth)/login' as never)); }}
    onNavigate={(destination) => { if (destination === 'Inicio') router.push('/(authenticated)/analyst' as never);
      if (destination === 'Pasaportes') router.push('/(authenticated)/analyst/passports' as never);
      if (destination === 'Partidos') router.push('/(authenticated)/analyst/matches' as never); }} />;
}
