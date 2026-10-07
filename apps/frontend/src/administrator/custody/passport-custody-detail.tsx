import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { LiquidGlassPanel } from '../../design/components/liquid-glass-panel';
import { authTokens } from '../../design/tokens';
import type { CustodyHistoryEntry, CustodyPassportDetail as CustodyPassportDetailModel, CustodySafeLink } from '../administrator-api';

export type CustodyDetailState = 'loading' | 'ready' | 'restricted' | 'missing' | 'unavailable' | 'error';

export function PassportCustodyDetail({ state, detail, onRetry, onBack, backLabel = 'Volver a Custodia', onOpenRequest, onOpenDossier, onAssign, onChange, onRemove, previewMode }: Readonly<{
  state: CustodyDetailState; detail?: CustodyPassportDetailModel; onRetry: () => void; onBack: () => void;
  backLabel?: string;
  onOpenRequest: (id: string) => void; onOpenDossier: (id: string) => void;
  onAssign: (detail: CustodyPassportDetailModel) => void; onChange: (detail: CustodyPassportDetailModel) => void; onRemove: (detail: CustodyPassportDetailModel) => void;
  previewMode?: 'desktop' | 'mobile';
}>) {
  const dimensions = useWindowDimensions();
  const desktop = previewMode ? previewMode === 'desktop' : dimensions.width >= authTokens.breakpoints.desktop;
  const heading = useRef<Text>(null);
  useEffect(() => { if (state === 'ready') (heading.current as unknown as { focus?: () => void } | null)?.focus?.(); }, [state]);
  if (state !== 'ready') return <StateView state={state} onRetry={onRetry} onBack={onBack} backLabel={backLabel} />;
  if (!detail) return <StateView state="error" onRetry={onRetry} onBack={onBack} backLabel={backLabel} />;
  const assigned = detail.custody.state === 'ASSIGNED';
  return <ScrollView accessibilityLabel="Detalle administrativo del pasaporte" contentContainerStyle={[styles.page, !desktop && styles.pageMobile]}>
    <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} style={styles.back}><Text style={styles.backText}>‹ {backLabel}</Text></Pressable>
    <LiquidGlassPanel style={[styles.hero, !desktop && styles.heroMobile]}>
      <View style={styles.avatar}><Text style={styles.avatarText}>◯</Text></View><View style={styles.heroCopy}>
        <Text ref={heading} {...({ tabIndex: -1 } as object)} accessibilityRole="header" style={[styles.title, !desktop && styles.titleMobile]}>Pasaporte</Text>
        <Text style={styles.personLabel}>Jugador: {detail.displayLabel}</Text>
        <Text style={styles.status}>✓ Activo básico</Text><Text style={styles.enrichment}>En espera de enriquecimiento del Analista</Text>
      </View>{detail.academyLabel ? <Text style={[styles.academy, !desktop && styles.academyMobile]}>{detail.academyLabel}</Text> : null}
    </LiquidGlassPanel>

    <View style={[styles.grid, !desktop && styles.stack]}>
      <View style={[styles.column, !desktop && styles.mobileSection]}>
        <LiquidGlassPanel style={styles.panel}><Text accessibilityRole="header" style={styles.panelTitle}>Custodia actual</Text><Text style={styles.custodian}>{assigned ? detail.custody.analyst.displayLabel : 'Sin Analista'}</Text><Text style={styles.muted}>{assigned ? `${detail.custody.analyst.activeCustodyCount} custodias activas` : 'Disponible para asignación'}</Text></LiquidGlassPanel>
        <View style={[styles.actions, !desktop && styles.actionsMobile]}>
          {!assigned && detail.capabilities.includes('ASSIGN') ? <Action label="Asignar Analista" primary onPress={() => onAssign(detail)} /> : null}
          {assigned && detail.capabilities.includes('CHANGE') ? <Action label="Cambiar Analista" primary onPress={() => onChange(detail)} /> : null}
          {assigned && detail.capabilities.includes('REMOVE') ? <Action label="Retirar custodia" destructive onPress={() => onRemove(detail)} /> : null}
        </View>
        <LiquidGlassPanel style={styles.panel}><Text accessibilityRole="header" style={styles.panelTitle}>Registros vinculados</Text><SafeLinkCard label="Solicitud de origen" link={detail.originRequest} onOpen={onOpenRequest} /><SafeLinkCard label="Expediente confirmado" link={detail.linkedDossier} onOpen={onOpenDossier} /></LiquidGlassPanel>
      </View>
      <LiquidGlassPanel style={[styles.panel, styles.history, !desktop && styles.mobileSection]}><Text accessibilityRole="header" style={styles.panelTitle}>Historial de custodia</Text><TimelineDot title="Pasaporte creado · Sin asignar" copy="Hito de presentación derivado; no es un evento persistido." />{detail.history.map((entry) => <TimelineEntry key={entry.eventId} entry={entry} />)}</LiquidGlassPanel>
    </View>
  </ScrollView>;
}

function Action({ label, onPress, primary, destructive }: Readonly<{ label: string; onPress: () => void; primary?: boolean; destructive?: boolean }>) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.action, primary && styles.primary, destructive && styles.destructive]}><Text style={[styles.actionText, primary && styles.primaryText, destructive && styles.destructiveText]}>{label}</Text></Pressable>;
}

function SafeLinkCard({ label, link, onOpen }: Readonly<{ label: string; link: CustodySafeLink; onOpen: (id: string) => void }>) {
  const copy = <View style={styles.linkCopy}><Text style={styles.linkLabel}>{label}</Text><Text style={styles.linkStatus}>{link.status}</Text>{!link.available ? <Text style={styles.unavailableLink}>Enlace no disponible</Text> : null}</View>;
  return link.available ? <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${label.toLocaleLowerCase('es-CO')}`} onPress={() => onOpen(link.id)} style={styles.link}>{copy}<Text style={styles.chevron}>›</Text></Pressable> : <View style={styles.link}>{copy}</View>;
}

function TimelineEntry({ entry }: Readonly<{ entry: CustodyHistoryEntry }>) {
  const title = entry.action === 'ASSIGNED' ? `Asignado a ${entry.nextAnalystLabel ?? 'Analista'}` : entry.action === 'CHANGED' ? `Cambio de ${entry.previousAnalystLabel ?? 'Analista'} a ${entry.nextAnalystLabel ?? 'Analista'}` : `Custodia retirada de ${entry.previousAnalystLabel ?? 'Analista'}`;
  return <TimelineDot title={title} copy={[entry.actorLabel, entry.reason].filter(Boolean).join(' · ')} date={new Date(entry.at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })} />;
}

function TimelineDot({ title, copy, date }: Readonly<{ title: string; copy: string; date?: string }>) {
  return <View style={styles.timelineRow}><View style={styles.timelineRail}><View style={styles.dot} /><View style={styles.line} /></View><View style={styles.timelineCopy}><Text style={styles.timelineTitle}>{title}</Text>{date ? <Text style={styles.timelineDate}>{date}</Text> : null}<Text style={styles.timelineBody}>{copy}</Text></View></View>;
}

function StateView({ state, onRetry, onBack, backLabel }: Readonly<{ state: Exclude<CustodyDetailState, 'ready'>; onRetry: () => void; onBack: () => void; backLabel: string }>) {
  const copy = state === 'loading' ? 'Cargando pasaporte…' : state === 'restricted' ? 'No tienes acceso a este pasaporte.' : state === 'missing' ? 'No encontramos este pasaporte.' : state === 'unavailable' ? 'El pasaporte no está disponible en este momento.' : 'No pudimos cargar el pasaporte.';
  return <View style={styles.statePage}><LiquidGlassPanel style={styles.statePanel}><Text accessibilityRole="alert" style={styles.stateText}>{copy}</Text><View style={styles.actions}>{state === 'unavailable' || state === 'error' ? <Action label="Reintentar" primary onPress={onRetry} /> : null}<Action label={backLabel} onPress={onBack} /></View></LiquidGlassPanel></View>;
}

const styles = StyleSheet.create({
  linkName: { color: '#b9c9bf', fontSize: 11, marginTop: 3, flexShrink: 1 },
  personLabel: { color: '#dce8df', marginTop: 4 },
  page: { alignSelf: 'center', gap: 16, maxWidth: 1120, padding: 28, paddingBottom: 56, width: '100%' }, pageMobile: { padding: 14, paddingBottom: 36 },
  back: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }, backText: { color: '#d6ff19', fontWeight: '800' },
  hero: { alignItems: 'center', flexDirection: 'row', gap: 18, padding: 22 }, heroMobile: { alignItems: 'flex-start', flexWrap: 'wrap', padding: 16 }, avatar: { alignItems: 'center', borderColor: '#91f3bd', borderRadius: 30, borderWidth: 1, height: 60, justifyContent: 'center', width: 60 }, avatarText: { color: '#f5f7ef', fontSize: 30 }, heroCopy: { flex: 1 }, title: { color: '#f8f8f2', fontSize: 36, fontWeight: '900' }, titleMobile: { fontSize: 25 }, reference: { color: '#dce8df', marginTop: 2 }, status: { color: '#9cff67', fontWeight: '800', marginTop: 7 }, enrichment: { color: '#b9c9bf', fontSize: 12, marginTop: 3 }, academy: { color: '#eef4ef', fontWeight: '700' }, academyMobile: { marginLeft: 78, width: '100%' },
  grid: { flexDirection: 'row', gap: 16 }, stack: { flexDirection: 'column' }, column: { flex: .8, gap: 16 }, mobileSection: { flexBasis: 'auto', flexGrow: 0, flexShrink: 0, width: '100%' }, panel: { gap: 12, padding: 20 }, panelTitle: { color: '#f7f8f2', fontSize: 19, fontWeight: '900' }, custodian: { color: '#d6ff19', fontSize: 25, fontWeight: '900' }, muted: { color: '#b7c8be' }, actions: { flexDirection: 'row', gap: 10 }, actionsMobile: { flexWrap: 'wrap' }, action: { alignItems: 'center', borderColor: '#bfd8c8', borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 48, minWidth: 130, paddingHorizontal: 15 }, primary: { backgroundColor: '#d6ff19', borderColor: '#d6ff19' }, destructive: { borderColor: '#ff9ca4' }, actionText: { color: '#f5f7ef', fontWeight: '800' }, primaryText: { color: '#06120c' }, destructiveText: { color: '#ffd0d4' },
  link: { alignItems: 'center', backgroundColor: 'rgba(0,22,15,.46)', borderColor: 'rgba(125,255,170,.25)', borderRadius: 10, borderWidth: 1, flexDirection: 'row', minHeight: 76, padding: 12 }, linkCopy: { flex: 1 }, linkLabel: { color: '#aebfb5', fontSize: 11 }, linkReference: { color: '#f7f8f2', fontWeight: '900', marginTop: 3 }, linkStatus: { color: '#9cff67', fontSize: 11, marginTop: 3 }, unavailableLink: { color: '#d6c68d', fontSize: 11 }, chevron: { color: '#d6ff19', fontSize: 28 },
  history: { flex: 1.2 }, timelineRow: { flexDirection: 'row', minHeight: 92 }, timelineRail: { alignItems: 'center', width: 24 }, dot: { backgroundColor: '#d6ff19', borderColor: '#efffc2', borderRadius: 7, borderWidth: 2, height: 14, marginTop: 4, width: 14 }, line: { backgroundColor: 'rgba(141,239,179,.38)', flex: 1, width: 2 }, timelineCopy: { flex: 1, paddingBottom: 18, paddingLeft: 9 }, timelineTitle: { color: '#f7f8f2', fontSize: 15, fontWeight: '900' }, timelineDate: { color: '#aebfb5', fontSize: 11, marginTop: 3 }, timelineBody: { color: '#cad7cf', fontSize: 12, lineHeight: 18, marginTop: 5 },
  statePage: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 500, padding: 20 }, statePanel: { alignItems: 'center', gap: 18, maxWidth: 520, padding: 30, width: '100%' }, stateText: { color: '#eef4ef', fontSize: 17, textAlign: 'center' },
});
