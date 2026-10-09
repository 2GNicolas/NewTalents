import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LiquidGlassPanel } from '../../design/components/liquid-glass-panel';
import type { AdminRegistrationReview } from '../../registration-requests/registration-request-api';

const protectedKey = /(document|email|phone|contact|credential|password|evidence|token|secret|address|\.id$|^id$)/i;

export function AdminTerminalRequestDetail({ review, onBack, backLabel = 'Volver a solicitudes' }: Readonly<{ review: AdminRegistrationReview; onBack: () => void; backLabel?: string }>) {
  const approved = review.status === 'APPROVED';
  const people = [
    ...review.structuredData.applicants.map((person) => ({ role: 'solicitante', person })),
    ...review.structuredData.players.map((person) => ({ role: 'jugador', person })),
    ...review.structuredData.representatives.map((person) => ({ role: 'representante', person })),
  ];
  const submitted = [...people.flatMap(({ role, person }) => safeEntries(person).map(([key, value]): [string, string] => [key === 'legalName' ? `${role}.legalName` : key, value])), ...safeEntries(review.structuredData.detail)];
  return <ScrollView accessibilityLabel="Información de solicitud terminal" contentContainerStyle={styles.page}>
    <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} style={styles.back}><Text style={styles.backText}>← {backLabel}</Text></Pressable>
    <Text accessibilityRole="header" style={styles.title}>{approved ? 'Solicitud aprobada' : 'Solicitud rechazada'}</Text>
    <Text style={styles.subtitle}>{requestLabel(review.type)} · versión {review.version}</Text>
    <LiquidGlassPanel style={styles.panel}>
      <Text accessibilityRole="header" style={styles.panelTitle}>Información presentada</Text>
      {submitted.length ? submitted.map(([key, value], index) => <View key={`${key}-${index}`} style={styles.data}><Text style={styles.dataLabel}>{label(key)}</Text><Text style={styles.dataValue}>{value}</Text></View>) : <Text style={styles.body}>No hay información adicional disponible en esta proyección.</Text>}
    </LiquidGlassPanel>
    <LiquidGlassPanel style={styles.panel}>
      <Text accessibilityRole="header" style={styles.panelTitle}>Resultado</Text>
      <Text style={approved ? styles.approved : styles.rejected}>{approved ? 'Aprobación aplicada' : 'Rechazo aplicado'}</Text>
      {review.safeReason ? <Text style={styles.body}>{review.safeReason}</Text> : null}
      <Text style={styles.body}>Esta solicitud es terminal y se presenta únicamente para consulta.</Text>
    </LiquidGlassPanel>
    <LiquidGlassPanel style={styles.panel}>
      <Text accessibilityRole="header" style={styles.panelTitle}>Historial seguro</Text>
      {review.history.map((entry, index) => <View key={`${entry.at}-${entry.action}-${index}`} style={styles.historyRow}><Text style={styles.historyTitle}>{historyLabel(entry.action)}</Text><Text style={styles.body}>{new Date(entry.at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })} · {entry.result}</Text></View>)}
    </LiquidGlassPanel>
  </ScrollView>;
}

function safeEntries(value: Record<string, unknown>, prefix = ''): [string, string][] {
  return Object.entries(value).flatMap<[string, string]>(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (protectedKey.test(path)) return [];
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') return [[path, item === true ? 'Sí' : item === false ? 'No' : String(item)]];
    if (item && typeof item === 'object' && !Array.isArray(item)) return safeEntries(item as Record<string, unknown>, path);
    return [];
  });
}

const labels: Record<string, string> = { legalName: 'Nombre', birthDate: 'Fecha de nacimiento', actingForSelf: 'Actúa por cuenta propia' };
const label = (value: string) => value.endsWith('.legalName') ? `Nombre del ${value.split('.')[0]}` : labels[value] ?? value.split('.').at(-1)!.replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
const requestLabel = (value: string) => value === 'PERSONAL_ADULT' ? 'Registro personal · adulto' : label(value);
const historyLabel = (value: string) => value === 'APPROVE' ? 'Aprobación' : value === 'REJECT' ? 'Rechazo' : value === 'SUBMIT' ? 'Envío de solicitud' : label(value);

const styles = StyleSheet.create({
  page: { alignSelf: 'center', gap: 16, maxWidth: 980, padding: 28, paddingBottom: 64, width: '100%' },
  back: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }, backText: { color: '#d6ff19', fontWeight: '800' },
  title: { color: '#f7f8f2', fontSize: 38, fontWeight: '900' }, subtitle: { color: '#bfcec5', marginTop: -10 },
  panel: { gap: 13, padding: 20 }, panelTitle: { color: '#f7f8f2', fontSize: 20, fontWeight: '900' },
  data: { borderBottomColor: 'rgba(210,255,226,.14)', borderBottomWidth: 1, flexDirection: 'row', gap: 14, justifyContent: 'space-between', paddingBottom: 10 },
  dataLabel: { color: '#a8baaf', flex: 1 }, dataValue: { color: '#f7f8f2', flex: 1.5, fontWeight: '700', textAlign: 'right' },
  approved: { color: '#d6ff19', fontSize: 22, fontWeight: '900' }, rejected: { color: '#ffadb4', fontSize: 22, fontWeight: '900' },
  body: { color: '#c3d0c8', lineHeight: 20 }, historyRow: { borderLeftColor: '#8aff9c', borderLeftWidth: 2, gap: 4, paddingLeft: 12 }, historyTitle: { color: '#f7f8f2', fontWeight: '800' },
});
