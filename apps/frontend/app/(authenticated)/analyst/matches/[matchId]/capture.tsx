import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from 'react-native';

import { useAuthentication } from '../../../../../src/authentication/authentication-provider';
import { createAnalystWorkspaceApi } from '../../../../../src/analyst-workspace/analyst-workspace-api';
import { matchDetailState } from '../../../../../src/analyst-workspace/analyst-match-state';
import { AnalystWorkspaceShell } from '../../../../../src/analyst-workspace/analyst-workspace-shell';
import { createAnalystMatchUploadApi } from '../../../../../src/analyst-match-upload/analyst-match-upload-api';
import { AnalystMatchCaptureState } from '../../../../../src/analyst-match-upload/analyst-match-upload-state';
import { AnalystMatchCaptureView } from '../../../../../src/analyst-match-upload/analyst-match-capture';
import { AnalystMatchReviewView } from '../../../../../src/analyst-match-upload/analyst-match-review';
import { AnalystMatchFinalStep } from '../../../../../src/analyst-match-upload/analyst-match-final-step';
import { AnalystMatchConfirmedView } from '../../../../../src/analyst-match-upload/analyst-match-confirmed';

export default function AnalystMatchCaptureRoute() {
  const authentication = useAuthentication();
  const router = useRouter();
  const params = useLocalSearchParams<{ matchId: string }>();
  const matchId = typeof params.matchId === 'string' ? params.matchId : '';
  const uploadApi = useMemo(() => createAnalystMatchUploadApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const matchApi = useMemo(() => createAnalystWorkspaceApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const machine = useMemo(() => new AnalystMatchCaptureState(uploadApi, matchId), [uploadApi, matchId]);
  const matchMachine = useMemo(() => matchDetailState(matchApi, matchId), [matchApi, matchId]);
  const state = useSyncExternalStore(machine.subscribe, () => machine.state, () => machine.state);
  const detail = useSyncExternalStore(matchMachine.subscribe, () => matchMachine.state, () => matchMachine.state);
  const allowed = authentication.state.phase === 'authenticated' && authentication.sessionAccess?.classification === 'product'
    && authentication.sessionAccess.capabilities.includes('passport.review');
  useEffect(() => { if (!allowed) { machine.clear(); matchMachine.clear(); } }, [allowed, machine, matchMachine]);
  useEffect(() => { if (detail.kind === 'restricted') machine.clear(); }, [detail.kind, machine]);
  useFocusEffect(useCallback(() => {
    if (allowed && matchId && !machine.state.confirmation) { void machine.load(); void matchMachine.load(); }
    else { machine.clear(); matchMachine.clear(); }
  }, [allowed, matchId, machine, matchMachine]));
  useEffect(() => () => { machine.dispose(); matchMachine.dispose(); }, [machine, matchMachine]);
  const onBack = () => router.replace(`/(authenticated)/analyst/matches/${matchId}` as never);
  const onNavigate = (destination: 'Inicio' | 'Pasaportes' | 'Partidos') => {
    if (destination === 'Inicio') router.push('/(authenticated)/analyst' as never);
    if (destination === 'Pasaportes') router.push('/(authenticated)/analyst/passports' as never);
    if (destination === 'Partidos') router.push('/(authenticated)/analyst/matches' as never);
  };
  if (!allowed || state.kind === 'restricted' || detail.kind === 'restricted') return <AnalystWorkspaceShell current="Partidos"><Text accessibilityRole="alert">Acceso restringido.</Text></AnalystWorkspaceShell>;
  if (state.kind === 'loading' || detail.kind === 'loading' || state.kind === 'idle' || detail.kind === 'idle') return <AnalystWorkspaceShell current="Partidos"><Text accessibilityRole="alert">Cargando captura…</Text></AnalystWorkspaceShell>;
  if (state.kind !== 'ready' || detail.kind !== 'ready') return <AnalystWorkspaceShell current="Partidos"><Text accessibilityRole="alert">El servicio no está disponible.</Text></AnalystWorkspaceShell>;
  if (state.confirmation && detail.value) return <AnalystMatchFinalStep match={detail.value} state={state} machine={machine} onBack={onBack} onNavigate={onNavigate} />;
  if (state.context?.availability === 'CONFIRMED' && state.context.upload && detail.value?.state === 'LOADED'
    && state.context.matchId === detail.value.id && state.context.passportId === detail.value.passportId) {
    return <AnalystMatchConfirmedView match={detail.value} upload={state.context.upload} onBack={onBack} onNavigate={onNavigate} />;
  }
  if (!state.context || !detail.value || state.context.availability !== 'AVAILABLE' || detail.value.state !== 'WAITING'
    || state.context.matchId !== detail.value.id || state.context.passportId !== detail.value.passportId) {
    return <AnalystWorkspaceShell current="Partidos"><Text accessibilityRole="alert">La captura no está disponible para este partido.</Text></AnalystWorkspaceShell>;
  }
  const props = { match: detail.value, state, machine, onBack, onNavigate };
  if (state.step === 'review') return <AnalystMatchReviewView {...props} />;
  if (state.step === 'final') return <AnalystMatchFinalStep {...props} />;
  return <AnalystMatchCaptureView {...props} />;
}
