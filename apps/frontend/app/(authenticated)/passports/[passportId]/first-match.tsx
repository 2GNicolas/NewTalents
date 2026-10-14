import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useAuthentication } from '../../../../src/authentication/authentication-provider';
import { createFirstMatchApi } from '../../../../src/first-match/first-match-api';
import { FirstMatchForm } from '../../../../src/first-match/first-match-form';
import { FirstMatchInvitation } from '../../../../src/first-match/first-match-invitation';
import { FirstMatchWaiting } from '../../../../src/first-match/first-match-waiting';
import { FirstMatchStateMachine, FIRST_MATCH_NOTICES, type FirstMatchState } from '../../../../src/first-match/first-match-state';
import { FirstMatchSurface, FirstMatchTitle, firstMatchColors } from '../../../../src/first-match/first-match-surface';

function colombiaToday(): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
const emptyState: FirstMatchState = { phase: 'idle', flow: null, availability: null };

export default function FirstMatchRoute() {
  const { passportId } = useLocalSearchParams<{ passportId?: string }>();
  const router = useRouter();
  const authentication = useAuthentication();
  const api = useMemo(() => createFirstMatchApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const machine = useMemo(() => passportId ? new FirstMatchStateMachine(api, passportId) : null, [api, passportId]);
  const [editing, setEditing] = useState<'schedule' | 'reschedule' | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const state = useSyncExternalStore(machine?.subscribe ?? (() => () => undefined), () => machine?.state ?? emptyState);

  useEffect(() => {
    if (!machine) return;
    void machine.load();
    return () => machine.pause();
  }, [machine]);
  useEffect(() => {
    if (state.flow?.state === 'INVITATION' && !editing && machine) void machine.preview(colombiaToday());
  }, [editing, machine, state.flow?.state]);
  useEffect(() => {
    if (state.flow?.state === 'LOADED' && passportId) router.replace(`/passports/${passportId}/sections/resumen` as never);
  }, [passportId, router, state.flow?.state]);
  useEffect(() => {
    if (state.flow?.state === 'WAITING' && editing === 'schedule') setEditing(null);
    if (state.flow?.state !== 'WAITING' && editing === 'reschedule') setEditing(null);
    if (state.flow?.state !== 'WAITING') setConfirmingCancel(false);
  }, [editing, state.flow?.state]);

  if (!machine || !passportId) return null;
  if (state.phase === 'idle' || state.phase === 'loading') return <FirstMatchSurface screen="status"><Text accessibilityLiveRegion="polite" style={styles.status}>Cargando primer partido…</Text></FirstMatchSurface>;
  if (state.notice === 'restricted' || state.flow?.state === 'RESTRICTED')
    return <FirstMatchSurface screen="status"><FirstMatchTitle prefix="Acceso " accent="restringido" /><Text style={styles.status}>{FIRST_MATCH_NOTICES.restricted}</Text></FirstMatchSurface>;
  if (!state.flow || state.flow.state === 'UNAVAILABLE') return <FirstMatchSurface screen="status">
    <FirstMatchTitle prefix="Servicio " accent="no disponible" />
    <Text style={styles.status}>No pudimos cargar el primer partido. Vuelve a intentar.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Volver a intentar" onPress={() => void machine.load()} style={styles.retry}><Text style={styles.retryText}>Volver a intentar</Text></Pressable>
  </FirstMatchSurface>;
  if (state.flow.state === 'LOADED') return <FirstMatchSurface screen="status"><Text style={styles.status}>Abriendo pasaporte…</Text></FirstMatchSurface>;
  if (state.flow.state === 'WAITING' && state.flow.match) {
    const match = state.flow.match;
    if (editing === 'reschedule') return <FirstMatchForm key={match.id} passportId={passportId}
      mode="reschedule" initialFields={match} currentMatchDate={match.matchDate}
      availability={state.availability} notice={state.notice} submitting={state.phase === 'submitting'}
      onDateChange={(date) => void machine.preview(date)}
      onSubmit={(fields) => void machine.reschedule(match, fields).then(() => {
        if (!machine.state.notice || machine.state.notice === 'conflict') setEditing(null);
      })} onDiscard={() => setEditing(null)} />;
    return <FirstMatchWaiting match={match} allowedActions={state.flow.allowedActions}
      notice={state.notice} submitting={state.phase === 'submitting'}
      confirmingCancel={confirmingCancel}
      onReschedule={() => { setEditing('reschedule'); void machine.preview(match.matchDate); }}
      onCancel={() => setConfirmingCancel(true)} onKeep={() => setConfirmingCancel(false)}
      onConfirmCancel={() => void machine.cancel(match).then(() => setConfirmingCancel(false))} />;
  }
  if (editing === 'schedule') return <FirstMatchForm passportId={passportId} availability={state.availability}
    notice={state.notice} submitting={state.phase === 'submitting'}
    onDateChange={(date) => void machine.preview(date)} onSubmit={(fields) => void machine.schedule(fields)}
    onDiscard={() => setEditing(null)} />;
  return <FirstMatchInvitation availability={state.availability} onStart={() => setEditing('schedule')} />;
}

const styles = StyleSheet.create({
  status: { color: firstMatchColors.muted, fontSize: 18, lineHeight: 26, textAlign: 'center' },
  retry: { backgroundColor: firstMatchColors.lime, borderRadius: 10, minHeight: 48, padding: 14 },
  retryText: { color: '#06160F', fontWeight: '800' },
});
