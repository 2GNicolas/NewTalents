import { Text, View } from 'react-native';

import { GlassCard, journeyStyles, Notice } from '../components/registration-journey';

export type AcademyContext = Readonly<{ id: string; name: string; location: string; approved: true }>;

export function AcademyBanner({ academy }: Readonly<{ academy: AcademyContext }>) {
  return <GlassCard><Text style={journeyStyles.muted}>Academia activa</Text><Text style={journeyStyles.sectionTitle}>{academy.name}</Text><Text style={journeyStyles.summaryText}>✓ Aprobada　|　{academy.location}</Text><Notice>Esta academia no se puede modificar desde esta solicitud.</Notice></GlassCard>;
}

export function SummaryRows({ rows }: Readonly<{ rows: readonly Readonly<{ label: string; value: string | undefined }>[] }>) {
  return <View>{rows.map((row) => <View key={row.label} style={{ borderBottomColor: 'rgba(210,255,226,.2)', borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingVertical: 7 }}><Text style={[journeyStyles.summaryText, { flex: 1 }]}>{row.label}</Text><Text style={[journeyStyles.summaryText, { flex: 1, fontWeight: '700' }]}>{row.value}</Text></View>)}</View>;
}
