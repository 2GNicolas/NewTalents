import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { LiquidGlassPanel } from '../../design/components/liquid-glass-panel';
import type { AllowanceCadence, MatchAllowanceEnvelope, MatchAllowanceRevision } from '../administrator-api';
import { allowancePeriodLabel, formatColombiaDate } from './allowance-period-presentation';

const cadenceLabels: Record<AllowanceCadence, string> = { MONTHLY: 'Mensual', QUARTERLY: 'Trimestral', SEMIANNUAL: 'Semestral', ANNUAL: 'Anual' };
export const formatAllowanceDate = formatColombiaDate;

export function AllowanceSection({ playerLabel, maskedReference, canConfigure, allowance, history = [], hasMoreHistory = false, onMoreHistory, onRefresh, onPropose, onDiscard, onConfirm, onRetryConfirmation, submitting = false, recoverable = false, message }: Readonly<{
  playerLabel: string; maskedReference?: string; canConfigure: boolean; allowance: MatchAllowanceEnvelope; history?: readonly MatchAllowanceRevision[];
  hasMoreHistory?: boolean; onMoreHistory?: () => void; onRefresh?: () => void;
  onPropose: (cadence: AllowanceCadence, matchLimit: number) => boolean | void; onDiscard: () => void; onConfirm: () => void; onRetryConfirmation?: () => void; submitting?: boolean; recoverable?: boolean; message?: string | null;
}>) {
  const configuration = allowance.configuration;
  const [cadence, setCadence] = useState<AllowanceCadence>(configuration?.pendingRule?.cadence ?? configuration?.currentRule.cadence ?? 'MONTHLY');
  const [limit, setLimit] = useState(configuration?.pendingRule?.matchLimit.toString() ?? configuration?.currentRule.matchLimit.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  useEffect(() => { setCadence(configuration?.pendingRule?.cadence ?? configuration?.currentRule.cadence ?? 'MONTHLY'); setLimit(configuration?.pendingRule?.matchLimit.toString() ?? configuration?.currentRule.matchLimit.toString() ?? ''); setReview(false); setError(null); }, [configuration?.version, allowance.colombiaToday]);
  const save = () => {
    const number = Number(limit);
    if (!/^\d+$/.test(limit) || !Number.isSafeInteger(number) || number <= 0) { setError('Ingresa un número entero positivo de partidos.'); return; }
    setError(null); if (onPropose(cadence, number) !== false) setReview(true);
  };
  const discard = () => { setReview(false); setError(null); setCadence(configuration?.pendingRule?.cadence ?? configuration?.currentRule.cadence ?? 'MONTHLY'); setLimit(configuration?.pendingRule?.matchLimit.toString() ?? configuration?.currentRule.matchLimit.toString() ?? ''); onDiscard(); };
  return <LiquidGlassPanel style={styles.panel}>
    <Text accessibilityRole="header" style={styles.heading}>Configuración de partidos</Text>
    {maskedReference ? <Text style={styles.note}>Pasaporte: {maskedReference}</Text> : null}
    <Text style={styles.description}>Define el límite de partidos permitido para este jugador en cada período.</Text>
    <View style={styles.grid}>
      <View style={styles.form}><Text style={styles.label}>Período de configuración</Text>
        {canConfigure ? <View style={styles.periods}>{(Object.keys(cadenceLabels) as AllowanceCadence[]).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={cadenceLabels[value]} accessibilityState={{ selected: cadence === value, disabled: submitting || recoverable }} disabled={submitting || recoverable} onPress={() => { setCadence(value); setReview(false); }} style={[styles.period, cadence === value && styles.selected]}><Text style={[styles.periodText, cadence === value && styles.selectedText]}>{cadenceLabels[value]}</Text></Pressable>)}</View> : null}
        {canConfigure ? <><Text style={styles.label}>Partidos permitidos</Text><TextInput accessibilityLabel="Partidos permitidos" keyboardType="number-pad" editable={!submitting && !recoverable} value={limit} onChangeText={(value) => { setLimit(value); setReview(false); setError(null); }} style={styles.input} /><Text style={styles.note}>Ingresado manualmente por el Administrador</Text></> : <Text style={styles.note}>Solo consulta</Text>}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </View>
      <View style={styles.current}><Text style={styles.label}>Configuración actual</Text>
        {configuration ? <><Text style={styles.value}>{configuration.currentRule.matchLimit} partidos por {cadenceLabels[configuration.currentRule.cadence].toLowerCase()}</Text><Text style={styles.note}>Período actual: {allowancePeriodLabel(configuration.currentPeriod).start} – {allowancePeriodLabel(configuration.currentPeriod).lastIncluded}</Text><Text style={styles.note}>Siguiente período: {allowancePeriodLabel(configuration.currentPeriod).nextStart}</Text><Text style={styles.note}>Fecha de activación: {formatAllowanceDate(configuration.activatedOn)}</Text><Text style={styles.note}>Versión {configuration.version}</Text>{configuration.pendingRule ? <Text style={styles.pending}>Cambio confirmado para {formatAllowanceDate(configuration.pendingRule.effectiveOn)}: {configuration.pendingRule.matchLimit} partidos · {cadenceLabels[configuration.pendingRule.cadence]}</Text> : null}</> : <><Text style={styles.empty}>Sin configuración</Text><Text style={styles.note}>Fecha de activación: {formatAllowanceDate(allowance.colombiaToday)}</Text></>}
      </View>
    </View>
    {canConfigure ? <View style={styles.actions}><Action label="Guardar configuración" primary disabled={submitting || recoverable} onPress={save} /><Action label="Descartar cambios" disabled={submitting} onPress={discard} />{recoverable && onRetryConfirmation ? <Action label="Reintentar confirmación" onPress={onRetryConfirmation} /> : null}</View> : null}
    {review ? <View style={styles.review}><Text accessibilityRole="header" style={styles.label}>Revisar configuración</Text><Text style={styles.note}>Pasaporte de {playerLabel}</Text><Text style={styles.note}>Anterior confirmado: {configuration ? `${(configuration.pendingRule ?? configuration.currentRule).matchLimit} · ${cadenceLabels[(configuration.pendingRule ?? configuration.currentRule).cadence]}` : 'Sin configuración'}</Text><Text style={styles.note}>Nuevo: {limit} · {cadenceLabels[cadence]}</Text><Text style={styles.note}>Fecha inicial fija: {formatAllowanceDate(configuration?.activatedOn ?? allowance.colombiaToday)}</Text>{configuration ? <Text style={styles.note}>Rige desde {formatAllowanceDate(configuration.currentPeriod.endExclusive)}</Text> : null}<View style={styles.actions}><Action label="Confirmar configuración" primary disabled={submitting} onPress={() => { setReview(false); onConfirm(); }} /><Action label="Cancelar confirmación" onPress={() => { setReview(false); onDiscard(); }} /></View></View> : null}
    {message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
    {message && onRefresh && !recoverable ? <Action label="Actualizar configuración" onPress={onRefresh} /> : null}
    {configuration ? <Text style={styles.note}>Última modificación: {new Date(configuration.lastModifiedAt).toLocaleString('es-CO')}</Text> : null}
    {history.length ? <View style={styles.history}><Text accessibilityRole="header" style={styles.label}>Historial de configuración</Text>{history.map((entry) => <Text key={entry.sequence} style={styles.note}>{new Date(entry.confirmedAt).toLocaleString('es-CO')} · {entry.actorLabel}: {entry.previousRule ? `${entry.previousRule.matchLimit} · ${cadenceLabels[entry.previousRule.cadence]}` : 'Sin configuración'} → {entry.newRule.matchLimit} · {cadenceLabels[entry.newRule.cadence]}. Vigente desde {formatAllowanceDate(entry.effectiveOn)}</Text>)}{hasMoreHistory && onMoreHistory ? <Action label="Ver más cambios" onPress={onMoreHistory} /> : null}</View> : null}
  </LiquidGlassPanel>;
}

function Action({ label, onPress, primary = false, disabled = false }: Readonly<{ label: string; onPress: () => void; primary?: boolean; disabled?: boolean }>) { return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.action, primary && styles.primary]}><Text style={[styles.actionText, primary && styles.primaryText]}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({
  panel: { gap: 14, padding: 20 }, heading: { color: '#f7f8f2', fontSize: 28, fontWeight: '900' }, description: { color: '#d3e0d5', fontSize: 15 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 }, form: { flexBasis: 310, flexGrow: 1, gap: 8 }, current: { borderColor: 'rgba(160,225,180,.3)', borderLeftWidth: 1, flexBasis: 280, flexGrow: 1, gap: 8, paddingLeft: 16 }, label: { color: '#f7f8f2', fontSize: 17, fontWeight: '800' }, periods: { flexDirection: 'row', gap: 6 }, period: { alignItems: 'center', borderColor: '#95c2a3', borderRadius: 8, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48, minWidth: 0, paddingHorizontal: 2 }, selected: { borderColor: '#d6ff19', borderWidth: 2 }, periodText: { color: '#f7f8f2', fontSize: 12, textAlign: 'center' }, selectedText: { color: '#d6ff19', fontWeight: '800' }, input: { borderColor: '#8dbb9b', borderRadius: 8, borderWidth: 1, color: '#f7f8f2', fontSize: 20, minHeight: 50, paddingHorizontal: 12 }, note: { color: '#d5dfd7', fontSize: 13 }, value: { color: '#d6ff19', fontSize: 22, fontWeight: '900' }, empty: { color: '#d6ff19', fontSize: 20, fontWeight: '800' }, pending: { color: '#d6ff19', fontSize: 14 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, action: { alignItems: 'center', borderColor: '#b7d9c2', borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 48, minWidth: 160, paddingHorizontal: 14 }, primary: { backgroundColor: '#caff24', borderColor: '#caff24' }, actionText: { color: '#f7f8f2', fontWeight: '900' }, primaryText: { color: '#04110a' }, review: { borderColor: '#caff24', borderRadius: 9, borderWidth: 1, gap: 8, padding: 14 }, error: { color: '#ffd0d4' }, history: { borderTopColor: 'rgba(160,225,180,.3)', borderTopWidth: 1, gap: 6, paddingTop: 12 },
});
