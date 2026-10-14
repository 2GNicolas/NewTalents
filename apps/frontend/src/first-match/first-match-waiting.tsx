import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { FirstMatchFlow, FirstMatchSummary } from './first-match-api';
import { FIRST_MATCH_NOTICES, type FirstMatchNotice } from './first-match-state';
import { FirstMatchHero, FirstMatchSurface, FirstMatchTitle, firstMatchColors } from './first-match-surface';

function displayDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

export function FirstMatchWaiting({ match, allowedActions, onReschedule, onCancel, confirmingCancel = false,
  onKeep, onConfirmCancel, notice, submitting = false, viewportWidth }: {
  match: FirstMatchSummary; allowedActions: FirstMatchFlow['allowedActions'];
  onReschedule: () => void; onCancel: () => void; confirmingCancel?: boolean;
  onKeep?: () => void; onConfirmCancel?: () => void; notice?: FirstMatchNotice;
  submitting?: boolean; viewportWidth?: number;
}) {
  const { width } = useWindowDimensions();
  const desktop = (viewportWidth ?? width) >= 1024;
  const canCorrect = match.state === 'WAITING';
  return <FirstMatchSurface screen="waiting" viewportWidth={viewportWidth}>
    <FirstMatchHero screen="waiting" viewportWidth={viewportWidth} />
    <FirstMatchTitle prefix="Primer partido " accent="agendado" />
    <Text style={styles.subtitle}>Tu primer partido ha sido agendado correctamente.</Text>
    <View style={[styles.details, desktop ? styles.detailsDesktop : styles.detailsMobile]} testID="first-match-waiting-details">
      <View style={[styles.detailsGrid, desktop ? styles.gridDesktop : styles.gridMobile]}>
        <View style={styles.detail}><Text style={styles.detailLabel}>Fecha y hora</Text>
          <Text style={styles.detailValue}>{displayDate(match.matchDate)} · {match.matchTime}</Text></View>
        <View style={styles.detail}><Text style={styles.detailLabel}>Rival</Text><Text style={styles.detailValue}>{match.opponent}</Text></View>
        <View style={styles.detail}><Text style={styles.detailLabel}>Competición</Text><Text style={styles.detailValue}>{match.competition}</Text></View>
        <View style={styles.detail}><Text style={styles.detailLabel}>Lugar</Text><Text style={styles.detailValue}>{match.venue}</Text></View>
      </View>
      <View style={styles.statusBadge} accessibilityLiveRegion="polite">
        <Text style={styles.statusText}>Agendado · Análisis pendiente</Text>
      </View>
    </View>
    {canCorrect && (allowedActions.includes('RESCHEDULE') || allowedActions.includes('CANCEL')) ?
      <View style={[styles.actions, !desktop && styles.actionsMobile]} testID="first-match-waiting-actions">
        {allowedActions.includes('RESCHEDULE') ? <Pressable accessibilityRole="button" accessibilityLabel="Reagendar"
          accessibilityState={{ disabled: submitting }} disabled={submitting} onPress={onReschedule} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Reagendar</Text></Pressable> : null}
        {allowedActions.includes('CANCEL') ? <Pressable accessibilityRole="button" accessibilityLabel="Cancelar partido"
          accessibilityState={{ disabled: submitting }} disabled={submitting} onPress={onCancel} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Cancelar partido</Text></Pressable> : null}
      </View> : null}
    {confirmingCancel && canCorrect ? <View style={styles.confirmation} testID="first-match-cancel-confirmation">
      <Text accessibilityRole="header" style={styles.confirmTitle}>¿Cancelar este partido?</Text>
      <Text style={styles.confirmCopy}>Esta acción liberará su cupo. Si aún no se cargaron datos, podrás agendar de nuevo.</Text>
      <View style={[styles.actions, !desktop && styles.actionsMobile]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Conservar partido" onPress={onKeep}
          disabled={submitting} style={styles.secondaryButton}><Text style={styles.secondaryText}>Conservar partido</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Confirmar cancelación del partido"
          accessibilityState={{ disabled: submitting, busy: submitting }} disabled={submitting}
          onPress={onConfirmCancel} style={styles.confirmButton}><Text style={styles.confirmButtonText}>
            {submitting ? 'Cancelando…' : 'Confirmar cancelación del partido'}</Text></Pressable>
      </View>
    </View> : null}
    {notice ? <Text accessibilityRole="alert" style={styles.notice}>{FIRST_MATCH_NOTICES[notice]}</Text> : null}
    <Text style={styles.footer}>El partido sigue pendiente de la carga de datos. La asignación de Analista se gestiona por separado.</Text>
  </FirstMatchSurface>;
}

const styles = StyleSheet.create({
  subtitle: { color: firstMatchColors.muted, fontSize: 19, lineHeight: 27, textAlign: 'center' },
  details: { borderColor: firstMatchColors.border, borderRadius: 16, borderWidth: 1,
    gap: 14, maxWidth: 900, padding: 20, width: '100%' },
  detailsDesktop: { marginTop: 6 }, detailsMobile: { marginTop: 12 },
  detailsGrid: { gap: 0 }, gridDesktop: { flexDirection: 'row' }, gridMobile: { flexDirection: 'column' },
  detail: { flex: 1, gap: 5, minWidth: 0, padding: 10 },
  detailLabel: { color: firstMatchColors.muted, fontSize: 13 },
  detailValue: { color: firstMatchColors.white, fontSize: 17, fontWeight: '700' },
  statusBadge: { alignSelf: 'flex-start', borderColor: '#DDAE18', borderRadius: 100, borderWidth: 1,
    paddingHorizontal: 15, paddingVertical: 9 },
  statusText: { color: '#FFC21A', fontSize: 15, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12, justifyContent: 'center', maxWidth: 900, width: '100%' },
  actionsMobile: { flexDirection: 'column' },
  secondaryButton: { alignItems: 'center', borderColor: firstMatchColors.border, borderRadius: 10,
    borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 20 },
  secondaryText: { color: firstMatchColors.white, fontSize: 15, fontWeight: '700' },
  confirmation: { borderColor: '#DDAE18', borderRadius: 12, borderWidth: 1, gap: 14,
    maxWidth: 900, padding: 18, width: '100%' },
  confirmTitle: { color: firstMatchColors.white, fontSize: 19, fontWeight: '800' },
  confirmCopy: { color: firstMatchColors.muted, fontSize: 15 },
  confirmButton: { alignItems: 'center', backgroundColor: '#DDAE18', borderRadius: 10,
    justifyContent: 'center', minHeight: 48, paddingHorizontal: 18 },
  confirmButtonText: { color: '#06160F', fontSize: 15, fontWeight: '800' },
  notice: { color: '#FFB0A1', fontSize: 15, maxWidth: 900, textAlign: 'center' },
  footer: { color: firstMatchColors.muted, fontSize: 16, lineHeight: 24, maxWidth: 900, textAlign: 'center' },
});
