import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { LiquidGlassPanel } from '../../design/components/liquid-glass-panel';
import { authTokens } from '../../design/tokens';
import { Brand } from '../components/registration-journey';
import { REGISTRATION_REQUEST_STATUSES, REGISTRATION_REQUEST_TYPES, type RegistrationRequestSnapshot, type RegistrationRequestStatus, type RegistrationRequestType } from '../registration-request-api';
import type { AdminInboxFilters, AdminInboxView } from './admin-inbox-state';

const typeLabels: Record<RegistrationRequestType, string> = {
  PERSONAL_ADULT: 'Persona adulta', REPRESENTED_MINOR: 'Menor representado', FORMAL_ACADEMY: 'Academia formal', NATURAL_PERSON_ACADEMY: 'Academia persona natural',
  ADDITIONAL_ACADEMY_ACCOUNT: 'Cuenta adicional', ACADEMY_ADULT_PLAYER: 'Jugador adulto', ACADEMY_MINOR_PLAYER: 'Jugador menor',
};
const statusLabels: Record<RegistrationRequestStatus, string> = { DRAFT: 'Borrador', SUBMITTED: 'En revisión', REQUIRES_CORRECTION: 'Corrección', APPROVED: 'Aprobada', REJECTED: 'Rechazada' };
const evidenceLabel = (row: RegistrationRequestSnapshot) => row.status === 'APPROVED' || row.status === 'REJECTED'
  ? 'Evidencia eliminada'
  : row.evidenceComplete ? 'Evidencia completa' : 'Evidencia pendiente';

export function AdminInbox({ view, onFilters, onOpen, onLoadNext, onRetry, previewMode }: Readonly<{
  view: AdminInboxView;
  onFilters: (filters: AdminInboxFilters) => void;
  onOpen: (request: RegistrationRequestSnapshot) => void;
  onLoadNext: () => void;
  onRetry: () => void;
  previewMode?: 'desktop' | 'mobile';
}>) {
  const desktop = previewMode ? previewMode === 'desktop' : useWindowDimensions().width >= authTokens.breakpoints.desktop;
  return <ImageBackground source={require('../../../assets/authentication/liquid-emerald-abstract-v1.png')} style={styles.background} resizeMode="cover">
    <View style={styles.scrim} />
    <View style={[styles.shell, desktop && styles.desktopShell, previewMode === 'mobile' && styles.mobilePreview]}>
      {desktop ? <View style={styles.sidebar}><Brand /><Text style={styles.navActive}>Solicitudes</Text><Text style={styles.nav}>Resumen</Text><Text style={styles.nav}>Academias</Text></View> : null}
      <ScrollView contentContainerStyle={styles.content} accessibilityLabel="Bandeja de solicitudes de registro">
        {!desktop ? <Brand dense /> : null}
        <Text accessibilityRole="header" style={styles.title}>Solicitudes de registro</Text>
        <Text style={styles.subtitle}>Revisa las solicitudes enviadas y abre una para consultar únicamente la información autorizada.</Text>
        <LiquidGlassPanel style={styles.filters}>
          <Filter label="Todos los tipos" selected={!view.filters.type} onPress={() => onFilters({ ...view.filters, type: undefined })} />
          {REGISTRATION_REQUEST_TYPES.map((type) => <Filter key={type} label={typeLabels[type]} selected={view.filters.type === type} onPress={() => onFilters({ ...view.filters, type })} />)}
          <View style={styles.filterDivider} />
          <Filter label="Todos los estados" selected={!view.filters.status} onPress={() => onFilters({ ...view.filters, status: undefined })} />
          {REGISTRATION_REQUEST_STATUSES.map((status) => <Filter key={status} label={statusLabels[status]} selected={view.filters.status === status} onPress={() => onFilters({ ...view.filters, status })} />)}
        </LiquidGlassPanel>
        {view.state === 'loading' && view.rows.length === 0 ? <State copy="Cargando solicitudes…" /> : null}
        {view.state === 'empty' ? <State copy="No hay solicitudes para estos filtros." /> : null}
        {view.state === 'unavailable' || view.state === 'error' ? <State copy="No pudimos cargar la bandeja." action="Reintentar" onPress={onRetry} /> : null}
        {view.rows.length ? <LiquidGlassPanel style={styles.table}>{view.rows.map((row) => <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${row.safeApplicantLabel ?? typeLabels[row.type]}`} key={row.id} onPress={() => onOpen(row)} style={styles.row}>
          <View style={styles.rowMain}><Text style={styles.rowTitle}>{row.safeApplicantLabel ?? 'Solicitud de registro'}</Text><Text style={styles.rowMeta}>{typeLabels[row.type]}{row.academyLabel ? ` · ${row.academyLabel}` : ''}</Text></View>
          <Text style={styles.evidence}>{evidenceLabel(row)}</Text><Text style={styles.status}>{statusLabels[row.status]}</Text><Text style={styles.arrow}>›</Text>
        </Pressable>)}</LiquidGlassPanel> : null}
        {view.nextCursor ? <Pressable accessibilityRole="button" onPress={onLoadNext} style={styles.more}><Text style={styles.moreText}>Cargar más solicitudes</Text></Pressable> : null}
      </ScrollView>
    </View>
  </ImageBackground>;
}

function Filter({ label, selected, onPress }: Readonly<{ label: string; selected: boolean; onPress: () => void }>) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.filter, selected && styles.filterSelected]}><Text style={[styles.filterText, selected && styles.filterTextSelected]}>{label}</Text></Pressable>;
}
function State({ copy, action, onPress }: Readonly<{ copy: string; action?: string; onPress?: () => void }>) { return <LiquidGlassPanel style={styles.state}><Text style={styles.subtitle}>{copy}</Text>{action ? <Pressable accessibilityRole="button" onPress={onPress}><Text style={styles.link}>{action}</Text></Pressable> : null}</LiquidGlassPanel>; }

const styles = StyleSheet.create({
  background: { backgroundColor: '#03130d', flex: 1, minHeight: '100%' }, scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,12,8,.48)' }, shell: { flex: 1 }, desktopShell: { flexDirection: 'row' },
  sidebar: { borderRightColor: 'rgba(210,255,226,.2)', borderRightWidth: 1, gap: 16, minHeight: 900, padding: 28, width: 280 }, mobilePreview: { alignSelf: 'center', maxWidth: 430, width: '100%' }, nav: { color: '#aabbb1', fontSize: 16, padding: 12 }, navActive: { backgroundColor: 'rgba(196,255,46,.12)', borderRadius: 8, color: '#c7ff2e', fontSize: 16, fontWeight: '800', padding: 12 },
  content: { alignSelf: 'center', gap: 18, maxWidth: 1180, padding: 28, width: '100%' }, title: { color: '#f5f7ef', fontSize: 42, fontWeight: '900', letterSpacing: -1 }, subtitle: { color: '#c7d3cc', fontSize: 16, lineHeight: 24 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14 }, filter: { borderColor: 'rgba(210,255,226,.25)', borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }, filterSelected: { backgroundColor: '#c7ff2e', borderColor: '#c7ff2e' }, filterText: { color: '#dbe7df', fontSize: 12 }, filterTextSelected: { color: '#06150f', fontWeight: '900' }, filterDivider: { width: 6 },
  table: { padding: 0 }, row: { alignItems: 'center', borderBottomColor: 'rgba(210,255,226,.15)', borderBottomWidth: 1, flexDirection: 'row', gap: 14, minHeight: 82, padding: 16 }, rowMain: { flex: 1, minWidth: 180 }, rowTitle: { color: '#f5f7ef', fontSize: 17, fontWeight: '800' }, rowMeta: { color: '#9fb2a6', fontSize: 13, marginTop: 4 }, evidence: { color: '#b9cac0', fontSize: 12 }, status: { borderColor: '#75e7a7', borderRadius: 16, borderWidth: 1, color: '#75e7a7', fontSize: 12, paddingHorizontal: 10, paddingVertical: 6 }, arrow: { color: '#f5f7ef', fontSize: 28 },
  state: { alignItems: 'center', gap: 12, padding: 28 }, link: { color: '#c7ff2e', fontWeight: '900' }, more: { alignSelf: 'center', borderColor: '#c7ff2e', borderRadius: 8, borderWidth: 1, padding: 14 }, moreText: { color: '#c7ff2e', fontWeight: '800' },
});
