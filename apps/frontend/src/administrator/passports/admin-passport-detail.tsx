import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LiquidGlassPanel } from '../../design/components/liquid-glass-panel';
import type { AdminPassportDetail, AllowanceCadence, CustodyPassportDetail, MatchAllowanceRevision } from '../administrator-api';
import { PassportCustodyDetail } from '../custody/passport-custody-detail';
import { AllowanceSection } from './allowance-section';

export type AdminPassportDetailState = 'loading' | 'ready' | 'restricted' | 'missing' | 'unavailable' | 'error';
export function AdminPassportDetailView({ state, detail, custody, history, hasMoreHistory, message, onBack, onRetry, onOpenRequest, onOpenDossier, onOpenCustody, onPropose, onDiscard, onConfirm, onRetryConfirmation, onMoreHistory, submitting, recoverable, previewMode }: Readonly<{
  state: AdminPassportDetailState; detail?: AdminPassportDetail; custody?: CustodyPassportDetail; history?: readonly MatchAllowanceRevision[]; message?: string | null;
  hasMoreHistory?: boolean; onMoreHistory?: () => void;
  onBack: () => void; onRetry: () => void; onOpenRequest: (id: string) => void; onOpenDossier: (id: string) => void; onOpenCustody: (id: string) => void;
  onPropose: (cadence: AllowanceCadence, matchLimit: number) => boolean | void; onDiscard: () => void; onConfirm: () => void; onRetryConfirmation?: () => void; submitting?: boolean; recoverable?: boolean; previewMode?: 'desktop' | 'mobile';
}>) {
  if (state !== 'ready' || !detail) return <View style={styles.state}><Text accessibilityRole="alert" style={styles.copy}>{state === 'loading' ? 'Cargando pasaporte…' : state === 'restricted' ? 'No tienes acceso a este pasaporte.' : state === 'missing' ? 'No encontramos este pasaporte.' : state === 'unavailable' ? 'El pasaporte no está disponible en este momento.' : 'No pudimos cargar el pasaporte.'}</Text>{state === 'unavailable' || state === 'error' ? <Pressable accessibilityRole="button" accessibilityLabel="Reintentar" onPress={onRetry}><Text style={styles.link}>Reintentar</Text></Pressable> : null}<Pressable accessibilityRole="button" accessibilityLabel="Volver a pasaportes" onPress={onBack}><Text style={styles.link}>Volver a pasaportes</Text></Pressable></View>;
  const allowance = <AllowanceSection playerLabel={detail.passport.playerLabel} maskedReference={detail.passport.maskedReference} canConfigure={detail.passport.canConfigure} allowance={detail.allowance} history={history} hasMoreHistory={hasMoreHistory} onMoreHistory={onMoreHistory} onRefresh={onRetry} message={message} onPropose={onPropose} onDiscard={onDiscard} onConfirm={onConfirm} onRetryConfirmation={onRetryConfirmation} submitting={submitting} recoverable={recoverable} />;
  if (custody) return <PassportCustodyDetail state="ready" detail={custody} onRetry={onRetry} onBack={onBack} backLabel="Volver a pasaportes" onOpenRequest={onOpenRequest} onOpenDossier={onOpenDossier} onAssign={() => onOpenCustody(custody.passportId)} onChange={() => onOpenCustody(custody.passportId)} onRemove={() => onOpenCustody(custody.passportId)} previewMode={previewMode}>{allowance}</PassportCustodyDetail>;
  return <ScrollView accessibilityLabel="Detalle administrativo del pasaporte" contentContainerStyle={styles.page}>
    <Pressable accessibilityRole="button" accessibilityLabel="Volver a pasaportes" onPress={onBack}><Text style={styles.link}>Volver a pasaportes</Text></Pressable>
    <LiquidGlassPanel style={styles.profile}><Text accessibilityRole="header" style={styles.heading}>Detalle del pasaporte</Text><Text style={styles.name}>{detail.passport.playerLabel}</Text><Text style={styles.copy}>Pasaporte: {detail.passport.maskedReference}</Text><Text style={styles.copy}>Estado: {detail.passport.state}</Text></LiquidGlassPanel>
    {allowance}
    {detail.existingSections?.length ? <LiquidGlassPanel style={styles.profile}><Text accessibilityRole="header" style={styles.heading}>Registros vinculados</Text>{detail.existingSections.map((section) => <Pressable key={section.href} accessibilityRole="button" accessibilityLabel={`Abrir ${section.label}`} onPress={() => { if (section.kind === 'CUSTODY') onOpenCustody(detail.passport.id); else if (section.kind === 'REQUEST') onOpenRequest(section.href.split('/').at(-1) ?? ''); else if (section.kind === 'DOSSIER') onOpenDossier(section.href.split('/').at(-1) ?? ''); }}><Text style={styles.link}>{section.label}</Text></Pressable>)}</LiquidGlassPanel> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Abrir detalle de custodia" onPress={() => onOpenCustody(detail.passport.id)}><Text style={styles.link}>Consultar custodia e historial</Text></Pressable>
  </ScrollView>;
}
const styles = StyleSheet.create({ page: { alignSelf: 'center', gap: 14, maxWidth: 1160, padding: 24, paddingBottom: 50, width: '100%' }, state: { alignItems: 'center', gap: 15, justifyContent: 'center', minHeight: 450, padding: 25 }, profile: { gap: 9, padding: 22 }, heading: { color: '#f7f8f2', fontSize: 28, fontWeight: '900' }, name: { color: '#f7f8f2', fontSize: 23, fontWeight: '800' }, copy: { color: '#d7e3db' }, link: { color: '#d6ff19', fontWeight: '800', minHeight: 44, paddingTop: 10 } });
