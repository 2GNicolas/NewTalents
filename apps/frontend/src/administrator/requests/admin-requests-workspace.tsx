import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { LiquidGlassPanel } from '../../design/components/liquid-glass-panel';
import { authTokens } from '../../design/tokens';
import { REGISTRATION_REQUEST_TYPES, type RegistrationRequestSnapshot, type RegistrationRequestType } from '../../registration-requests/registration-request-api';
import type { OperationalGroup, OperationalRequest } from '../administrator-api';
import type { AdminRequestsView } from './admin-requests-state';

const groupCopy: Readonly<Record<OperationalGroup, Readonly<{ label: string; short: string; description: string; icon: string }>>> = {
  NEW: { label: 'Nuevas', short: 'Nuevas', description: 'Solicitudes registradas recientemente.', icon: '▤' },
  CONTINUE_REVIEW: { label: 'Continuar revisión', short: 'Continuar', description: 'Solicitudes en las que ya iniciaste revisión.', icon: '↻' },
  REQUIRES_CORRECTION: { label: 'Requieren corrección', short: 'Corrección', description: 'Esperan información corregida o seguimiento.', icon: '!' },
  READY_FOR_DECISION: { label: 'Listas para decisión', short: 'Para decisión', description: 'La revisión está completa.', icon: '✓' },
  WAITING_EVIDENCE_DELETION: { label: 'Esperando verificación de eliminación de evidencias', short: 'Eliminación', description: 'La eliminación segura aún debe verificarse.', icon: '⌫' },
};
const actionCopy: Readonly<Record<OperationalRequest['nextAction'], string>> = { REVIEW: 'Revisar solicitud', CONTINUE: 'Continuar revisión', VIEW_CORRECTION: 'Ver corrección', DECIDE: 'Tomar decisión', VIEW_DELETION: 'Ver eliminación' };
const statusCopy: Readonly<Record<OperationalGroup, string>> = { NEW: 'Evidencia lista', CONTINUE_REVIEW: 'Revisión iniciada', REQUIRES_CORRECTION: 'Corrección requerida', READY_FOR_DECISION: 'Revisión completa', WAITING_EVIDENCE_DELETION: 'Evidencia por eliminar' };
const typeCopy: Readonly<Record<RegistrationRequestType, string>> = {
  PERSONAL_ADULT: 'Persona adulta', REPRESENTED_MINOR: 'Menor representado', FORMAL_ACADEMY: 'Academia formal', NATURAL_PERSON_ACADEMY: 'Academia persona natural',
  ADDITIONAL_ACADEMY_ACCOUNT: 'Cuenta adicional', ACADEMY_ADULT_PLAYER: 'Jugador de academia', ACADEMY_MINOR_PLAYER: 'Menor de academia',
};

export function AdminRequestsWorkspace({ view, onOperationalGroup, onSearch, onRequestType, onOpen, onOpenAll, onRetry, onBackToGroups, onOpenComplete, onLoadNext, showCompleteList = false, previewMode }: Readonly<{
  view: AdminRequestsView;
  onOperationalGroup: (group: OperationalGroup) => void;
  onSearch: (query: string) => void;
  onRequestType: (type?: RegistrationRequestType) => void;
  onOpen: (request: OperationalRequest) => void;
  onOpenAll: () => void;
  onRetry: () => void;
  onBackToGroups?: () => void;
  onOpenComplete?: (request: RegistrationRequestSnapshot) => void;
  onLoadNext?: () => void;
  showCompleteList?: boolean;
  previewMode?: 'desktop' | 'mobile';
  reducedMotion?: boolean;
}>) {
  const dimensions = useWindowDimensions();
  const desktop = previewMode ? previewMode === 'desktop' : dimensions.width >= authTokens.breakpoints.desktop;
  const selectedGroup = view.groups.find(({ group }) => group === view.selectedGroup);
  const selected = selectedGroup?.items[0];
  return <ScrollView accessibilityLabel="Espacio administrativo de solicitudes" contentContainerStyle={[styles.page, !desktop && styles.pageMobile]} keyboardShouldPersistTaps="handled">
    <View style={styles.heading}><View><Text accessibilityRole="header" style={[styles.title, !desktop && styles.titleMobile]}>Solicitudes</Text><Text style={styles.subtitle}>Revisión y decisión de registros</Text></View>{desktop ? <Text style={styles.date}>30 SEP 2026</Text> : null}</View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metrics}>{view.groups.map(({ group, total }) => <Pressable key={group} accessibilityRole="button" accessibilityState={{ selected: group === view.selectedGroup }} accessibilityLabel={`${groupCopy[group].label}: ${total}`} onPress={() => onOperationalGroup(group)} style={[styles.metric, group === view.selectedGroup && styles.metricActive]}>
      <Text style={[styles.metricIcon, group === view.selectedGroup && styles.lime]}>{groupCopy[group].icon}</Text><Text style={styles.metricLabel}>{groupCopy[group].short}</Text><Text style={[styles.metricCount, group === view.selectedGroup && styles.lime]}>{total}</Text>
    </Pressable>)}</ScrollView>
    <View style={[styles.workspace, desktop && styles.workspaceDesktop]}>
      <LiquidGlassPanel style={styles.queuePanel}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Cola prioritaria</Text><Text style={styles.sectionCopy}>Solicitudes que requieren tu atención.</Text>
        <View style={styles.controls}><TextInput accessibilityLabel="Buscar solicitudes" defaultValue={view.filters.query} onChangeText={onSearch} placeholder="Buscar solicitud, persona o academia" placeholderTextColor="#9cb1a5" style={styles.search} />
          <View style={styles.filterRow}><Filter label="Todos" selected={!view.filters.requestType} onPress={() => onRequestType(undefined)} />{REGISTRATION_REQUEST_TYPES.map((type) => <Filter key={type} label={typeCopy[type]} selected={view.filters.requestType === type} onPress={() => onRequestType(type)} />)}</View>
        </View>
        {showCompleteList ? <CompleteList view={view} onBack={onBackToGroups} onOpen={onOpenComplete} onLoadNext={onLoadNext} /> : <>{view.state === 'loading' ? <StateMessage copy="Cargando solicitudes…" /> : null}
        {view.state === 'empty' ? <StateMessage copy={view.filters.query || view.filters.requestType ? 'No hay solicitudes con los filtros seleccionados.' : 'No hay solicitudes que requieran atención.'} /> : null}
        {view.state === 'restricted' ? <StateMessage copy="No tienes acceso a este espacio." /> : null}
        {view.state === 'unavailable' ? <StateMessage copy="El espacio de solicitudes no está disponible." retry={onRetry} /> : null}
        {view.state === 'error' ? <StateMessage copy="No pudimos cargar las solicitudes." retry={onRetry} /> : null}
        {view.state === 'ready' && selectedGroup ? <View style={styles.groupList}><View key={selectedGroup.group} style={styles.group}>
          <Text accessibilityRole="header" style={styles.groupTitle}>{groupCopy[selectedGroup.group].label} ({selectedGroup.total})</Text><Text style={styles.groupDescription}>{groupCopy[selectedGroup.group].description}</Text>
          {selectedGroup.items.length ? selectedGroup.items.map((item) => <RequestRow key={item.requestId} item={item} onOpen={onOpen} />) : <StateMessage copy="No hay solicitudes en este grupo con los filtros seleccionados." />}
        </View></View> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Ver todas las solicitudes" accessibilityHint="Conserva filtros y posición al volver" onPress={onOpenAll} style={styles.allButton}><Text style={styles.allButtonText}>▤  Ver todas las solicitudes</Text><Text style={styles.allButtonArrow}>→</Text></Pressable></>}
      </LiquidGlassPanel>
      {desktop && selected ? <LiquidGlassPanel style={styles.actionPanel}><Text accessibilityRole="header" style={styles.sectionTitle}>Siguiente acción</Text><Text style={styles.sectionCopy}>Revisa la solicitud seleccionada y continúa con el flujo vigente.</Text>
        <View style={styles.summary}><Text style={styles.reference}>{`SOL-${selected.requestId.toUpperCase()}`}</Text><Text style={styles.summaryName}>{selected.displayLabel}</Text><Text style={styles.groupDescription}>{typeCopy[selected.requestType]}</Text><Text style={styles.safeStatus}>✓ {statusCopy[selected.operationalGroup]}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Acción principal: ${actionCopy[selected.nextAction]}`} onPress={() => onOpen(selected)} style={styles.primaryAction}><Text style={styles.primaryActionText}>{actionCopy[selected.nextAction]}  →</Text></Pressable>
        </View>
      </LiquidGlassPanel> : null}
    </View>
  </ScrollView>;
}

function CompleteList({ view, onBack, onOpen, onLoadNext }: Readonly<{ view: AdminRequestsView; onBack?: () => void; onOpen?: (request: RegistrationRequestSnapshot) => void; onLoadNext?: () => void }>) {
  const needle = view.filters.query?.trim().toLocaleLowerCase('es-CO');
  const rows = view.completeList.rows.filter((row) => !needle || row.id.toLocaleLowerCase('es-CO').includes(needle) || row.safeApplicantLabel?.toLocaleLowerCase('es-CO').includes(needle) || row.academyLabel?.toLocaleLowerCase('es-CO').includes(needle));
  return <View style={styles.completeList}><View style={styles.completeHeading}><View><Text accessibilityRole="header" style={styles.groupTitle}>Todas las solicitudes</Text><Text style={styles.groupDescription}>Consulta paginada del flujo existente de registro.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Volver a grupos operativos" onPress={onBack} style={styles.backButton}><Text style={styles.retryText}>← Grupos</Text></Pressable></View>
    {view.completeList.state === 'loading' && !view.completeList.rows.length ? <StateMessage copy="Cargando la vista completa…" /> : null}
    {view.completeList.state === 'restricted' ? <StateMessage copy="No tienes acceso a la vista completa." /> : null}
    {view.completeList.state === 'unavailable' ? <StateMessage copy="La vista completa no está disponible." /> : null}
    {view.completeList.state === 'error' ? <StateMessage copy="No pudimos cargar la vista completa." /> : null}
    {view.completeList.state === 'empty' || (view.completeList.state === 'ready' && !rows.length) ? <StateMessage copy="No hay solicitudes para esta búsqueda." /> : null}
    {rows.map((row) => <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={`Abrir ${row.safeApplicantLabel ?? typeCopy[row.type]}`} onPress={() => onOpen?.(row)} style={styles.requestRow}><View style={styles.requestMain}><Text style={styles.requestName}>{row.safeApplicantLabel ?? row.academyLabel ?? 'Solicitud de registro'}</Text><Text style={styles.requestType}>{typeCopy[row.type]} · {row.status}</Text><Text style={styles.reference}>{`SOL-${row.id.toUpperCase()}`}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}
    {view.completeList.nextCursor ? <Pressable accessibilityRole="button" accessibilityLabel="Cargar más solicitudes" onPress={onLoadNext} style={styles.allButton}><Text style={styles.allButtonText}>Cargar más solicitudes</Text></Pressable> : null}
  </View>;
}

function Filter({ label, selected, onPress }: Readonly<{ label: string; selected: boolean; onPress: () => void }>) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Filtrar por ${label}`} accessibilityState={{ selected }} onPress={onPress} style={[styles.filter, selected && styles.filterSelected]}><Text style={[styles.filterText, selected && styles.filterTextSelected]}>{label}</Text></Pressable>;
}
function RequestRow({ item, onOpen }: Readonly<{ item: OperationalRequest; onOpen: (item: OperationalRequest) => void }>) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${actionCopy[item.nextAction]}: ${item.displayLabel}`} accessibilityHint={`${statusCopy[item.operationalGroup]}. Abre el flujo existente de la solicitud.`} onPress={() => onOpen(item)} style={styles.requestRow}>
    <View style={styles.avatar}><Text style={styles.avatarText}>{item.displayLabel.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</Text></View>
    <View style={styles.requestMain}><Text style={styles.requestName}>{item.displayLabel}</Text><Text style={styles.requestType}>{typeCopy[item.requestType]}</Text><Text style={styles.reference}>{`SOL-${item.requestId.toUpperCase()}`}</Text></View>
    <Text style={styles.requestDate}>{new Date(item.relevantAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</Text><Text style={styles.requestStatus}>{statusCopy[item.operationalGroup]}</Text><Text style={styles.chevron}>›</Text>
  </Pressable>;
}
function StateMessage({ copy, retry }: Readonly<{ copy: string; retry?: () => void }>) { return <View accessibilityRole="alert" style={styles.state}><Text style={styles.sectionCopy}>{copy}</Text>{retry ? <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}><Text style={styles.retryText}>Reintentar</Text></Pressable> : null}</View>; }

const styles = StyleSheet.create({
  page: { alignSelf: 'center', gap: 14, maxWidth: 1220, padding: 28, paddingBottom: 36, width: '100%' }, pageMobile: { alignSelf: 'stretch', gap: 10, padding: 14, paddingTop: 12, width: 'auto' },
  heading: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' }, title: { color: '#f7f8f2', fontSize: 50, fontWeight: '900', letterSpacing: -2 }, titleMobile: { fontSize: 31, letterSpacing: -1 }, subtitle: { color: '#d5cfea', fontSize: 23 }, date: { borderLeftColor: '#9bffc0', borderLeftWidth: 2, color: '#f4f6ef', fontSize: 14, marginTop: 10, paddingLeft: 22 },
  metrics: { backgroundColor: 'rgba(2,39,27,.78)', borderColor: '#6cff9b', borderRadius: 12, borderWidth: 1, minWidth: '100%' }, metric: { alignItems: 'center', borderRightColor: 'rgba(210,255,226,.28)', borderRightWidth: 1, flexDirection: 'row', gap: 8, minHeight: 72, minWidth: 182, paddingHorizontal: 16 }, metricActive: { backgroundColor: 'rgba(116,255,105,.08)', borderColor: '#d6ff19', borderRadius: 11, borderWidth: 1 }, metricIcon: { color: '#67efaa', fontSize: 25 }, metricLabel: { color: '#f5f7ef', flex: 1, fontSize: 13, fontWeight: '700' }, metricCount: { color: '#68e8a7', fontSize: 27, fontWeight: '900' }, lime: { color: '#d6ff19' },
  workspace: { gap: 12 }, workspaceDesktop: { alignItems: 'flex-start', flexDirection: 'row' }, queuePanel: { flex: 1, minWidth: 0, padding: 20 }, actionPanel: { padding: 20, width: 360 }, sectionTitle: { color: '#f7f8f2', fontSize: 27, fontWeight: '900', letterSpacing: -.6 }, sectionCopy: { color: '#c7d5cd', fontSize: 14, lineHeight: 20 },
  controls: { gap: 10, marginTop: 12 }, search: { backgroundColor: 'rgba(0,17,12,.72)', borderColor: '#64eea4', borderRadius: 9, borderWidth: 1, color: '#f5f7ef', minHeight: 48, paddingHorizontal: 14 }, filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingBottom: 3 }, filter: { borderColor: 'rgba(210,255,226,.32)', borderRadius: 16, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 }, filterSelected: { backgroundColor: '#d6ff19', borderColor: '#d6ff19' }, filterText: { color: '#d7e2db', fontSize: 11 }, filterTextSelected: { color: '#06130d', fontWeight: '900' },
  groupList: { gap: 12, marginTop: 12 }, group: { borderTopColor: 'rgba(210,255,226,.25)', borderTopWidth: 1, paddingTop: 10 }, groupTitle: { color: '#f6f8ef', fontSize: 18, fontWeight: '900' }, groupDescription: { color: '#a9b9af', fontSize: 12, marginBottom: 5 }, requestRow: { alignItems: 'center', borderBottomColor: 'rgba(210,255,226,.18)', borderBottomWidth: 1, flexDirection: 'row', gap: 10, minHeight: 66, paddingVertical: 8 }, avatar: { alignItems: 'center', borderColor: '#8beec8', borderRadius: 22, borderWidth: 1.5, height: 42, justifyContent: 'center', width: 42 }, avatarText: { color: '#f5f7ef', fontSize: 13, fontWeight: '800' }, requestMain: { flex: 1, minWidth: 105 }, requestName: { color: '#f7f8f2', fontSize: 14, fontWeight: '800' }, requestType: { color: '#cad6cf', fontSize: 11 }, reference: { color: '#d7e2db', fontSize: 11, fontWeight: '700' }, requestDate: { color: '#dce6df', fontSize: 11 }, requestStatus: { color: '#9cff86', fontSize: 11, maxWidth: 95 }, chevron: { color: '#f5f7ef', fontSize: 27 },
  allButton: { alignItems: 'center', borderColor: '#d6ff19', borderRadius: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, minHeight: 48, paddingHorizontal: 16 }, allButtonText: { color: '#f5f7ef', fontSize: 13, fontWeight: '700' }, allButtonArrow: { color: '#d6ff19', fontSize: 21 },
  summary: { borderColor: 'rgba(117,255,162,.35)', borderRadius: 11, borderWidth: 1, gap: 5, marginTop: 14, padding: 15 }, summaryName: { color: '#f7f8f2', fontSize: 17, fontWeight: '900' }, safeStatus: { borderTopColor: 'rgba(210,255,226,.22)', borderTopWidth: 1, color: '#baff54', fontSize: 13, fontWeight: '800', marginTop: 10, paddingTop: 12 }, primaryAction: { alignItems: 'center', backgroundColor: '#caff24', borderRadius: 8, justifyContent: 'center', marginTop: 10, minHeight: 48 }, primaryActionText: { color: '#07110d', fontWeight: '900' },
  state: { alignItems: 'center', gap: 10, minHeight: 110, justifyContent: 'center' }, retry: { borderColor: '#d6ff19', borderRadius: 8, borderWidth: 1, minHeight: 44, paddingHorizontal: 18, justifyContent: 'center' }, retryText: { color: '#d6ff19', fontWeight: '800' },
  completeList: { gap: 8, marginTop: 14 }, completeHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, backButton: { borderColor: '#d6ff19', borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
});
