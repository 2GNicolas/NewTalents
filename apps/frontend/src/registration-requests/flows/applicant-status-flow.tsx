import { useEffect, useMemo, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { LiquidGlassPanel } from '../../design/components/liquid-glass-panel';
import { authTokens } from '../../design/tokens';
import type { EvidenceCategory, RegistrationEvidenceUploadQueue } from '../evidence/upload-queue';
import type { RegistrationRequestSnapshot, RegistrationRequestState, RegistrationRequestStateMachine } from '../registration-request-state';
import { Brand, Notice } from '../components/registration-journey';

type CorrectionMachine = Pick<RegistrationRequestStateMachine, 'state' | 'can' | 'restore' | 'resubmit' | 'retry' | 'setClientValidationIssues'>;

const EVIDENCE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  IDENTITY_FRONT: 'Documento de identidad — frente',
  IDENTITY_BACK: 'Documento de identidad — reverso',
  MINOR_CIVIL_IDENTITY: 'Identidad del menor o registro civil',
  REPRESENTATION_AUTHORITY: 'Evidencia de representación legal',
  RUT: 'RUT',
  EXISTENCE_CERTIFICATE: 'Certificado de existencia o equivalente',
  RESPONSIBLE_AUTHORITY: 'Autoridad de la persona responsable',
  OPERATION_PROOF: 'Prueba de operación',
  ADULT_AUTHORIZATION: 'Autorización de la persona adulta',
  ACADEMY_ACCOUNT_AUTHORIZATION: 'Autorización de cuenta de academia',
});

export class ApplicantCorrectionCoordinator {
  private inFlight: Promise<boolean> | null = null;
  private retryingResubmit = false;

  constructor(
    private readonly machine: CorrectionMachine,
    private readonly queue: RegistrationEvidenceUploadQueue,
    private readonly getAccessToken: () => string | null = () => null,
  ) {}

  resubmit(): Promise<boolean> {
    if (!this.inFlight) this.inFlight = this.execute().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  safeFailureMessage(): string {
    const failedUpload = this.queue.items.find((item) => item.correctionReplacement && item.status === 'failed');
    if (failedUpload) return 'No se pudo cargar el documento solicitado. Verifica que sea PDF, JPEG o PNG y no supere 10 MiB. Tu archivo seleccionado se conserva para reintentar.';
    const issue = this.machine.state.validationIssues[0];
    if (issue?.code === 'replacement_required') return 'Selecciona todos los documentos solicitados antes de reenviar.';
    if (this.machine.state.notice === 'version-conflict') return 'La solicitud cambió mientras la corregías. Actualizamos su estado; revisa los documentos y vuelve a intentar.';
    if (this.machine.state.notice === 'session-expired' || this.machine.state.notice === 'denied-or-not-found') return 'Tu sesión ya no autoriza esta corrección. Inicia sesión nuevamente; tus archivos seleccionados se conservan.';
    if (this.machine.state.notice === 'validation-error') return issue?.message ?? 'La corrección no cumple los requisitos indicados. Revisa los documentos solicitados.';
    return 'No pudimos enviar la corrección por un problema temporal. Tus archivos seleccionados se conservan para reintentar.';
  }

  private async execute(): Promise<boolean> {
    const snapshot = this.machine.state.snapshot;
    if (!snapshot || snapshot.status !== 'REQUIRES_CORRECTION' || !this.machine.can('registration.request.own.upload-evidence') || !this.machine.can('registration.request.own.resubmit')) return false;
    if (this.retryingResubmit && (this.machine.state.notice === 'connectivity-failure' || this.machine.state.notice === 'unavailable-backend')) {
      const retried = await this.machine.retry();
      if (retried) this.retryingResubmit = false;
      return retried;
    }
    const categories = snapshot.evidence.filter((item) => item.correctionRequired).map((item) => item.category as EvidenceCategory);
    if (!categories.length) {
      this.machine.setClientValidationIssues([{ field: 'correction', code: 'no_permitted_target', message: 'No hay una corrección disponible.' }]);
      return false;
    }
    const selected = categories.every((category) => this.queue.items.some((item) => item.category === category && item.correctionReplacement));
    if (!selected) {
      this.machine.setClientValidationIssues([{ field: 'evidence', code: 'replacement_required', message: 'Selecciona el documento solicitado.' }]);
      return false;
    }
    const accessToken = this.getAccessToken();
    if (!accessToken) return false;
    if (!await this.queue.uploadRequired(categories, { requestId: snapshot.id, expectedVersion: snapshot.version, accessToken })) return false;
    if (!await this.machine.restore(snapshot.id)) return false;
    this.retryingResubmit = true;
    const submitted = await this.machine.resubmit();
    if (submitted || (this.machine.state.notice !== 'connectivity-failure' && this.machine.state.notice !== 'unavailable-backend')) this.retryingResubmit = false;
    return submitted;
  }
}

type Props = Readonly<{
  state: RegistrationRequestState;
  uploadQueue: RegistrationEvidenceUploadQueue;
  authenticationNotice?: string;
  readOnly?: boolean;
  onRetryRestore: () => void;
  onResubmit: () => Promise<boolean> | boolean;
  onRefreshCapabilities: () => Promise<void> | void;
  onLogout?: () => Promise<void> | void;
  onReturnToEntry?: () => Promise<void> | void;
  correctionFailureMessage?: () => string;
}>;

function formatDate(value?: string): string {
  if (!value) return 'Actualización pendiente';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Actualización pendiente';
  return `Actualizada ${new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bogota' }).format(date).replaceAll('.', '').toUpperCase()}`;
}

function requestCode(id: string): string { return `NT-••••-${id.replaceAll('-', '').slice(-4).toUpperCase()}`; }

function StateMessage({ state, onRetry }: Readonly<{ state: RegistrationRequestState; onRetry: () => void }>) {
  const [focused, setFocused] = useState(false);
  const denied = state.notice === 'denied-or-not-found';
  const loading = state.phase === 'loading' || state.phase === 'idle';
  const title = loading ? 'Cargando estado de la solicitud…' : denied ? 'No pudimos mostrar esta solicitud.' : 'No pudimos actualizar el estado.';
  return <View style={styles.centerState}><Text accessibilityLiveRegion="polite" style={styles.centerTitle}>{title}</Text>{!loading && !denied ? <Pressable accessibilityRole="button" onBlur={() => setFocused(false)} onFocus={() => setFocused(true)} onPress={onRetry} style={[styles.outlineButton, focused && styles.focused]}><Text style={styles.outlineButtonText}>Reintentar</Text></Pressable> : null}</View>;
}

function StatusChrome({ snapshot, children, onLogout }: Readonly<{ snapshot: RegistrationRequestSnapshot; children: React.ReactNode; onLogout: () => Promise<void> | void }>) {
  const { height, width } = useWindowDimensions();
  const desktop = width >= authTokens.breakpoints.desktop;
  const viewport = Platform.OS === 'web' ? ({ minHeight: '100dvh', overflowX: 'clip' } as unknown as ViewStyle) : { minHeight: height };
  return <ImageBackground imageStyle={styles.backgroundImage} source={require('../../../assets/authentication/liquid-emerald-abstract-v1.png')} resizeMode="cover" style={[styles.background, viewport]} testID="applicant-status-background">
    <View style={styles.scrim} />
    <ScrollView contentContainerStyle={[styles.page, desktop ? [styles.pageDesktop, getApplicantStatusPageStyle(Platform.OS, height)] : styles.pageMobile]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} testID="applicant-status-scroll">
      {desktop ? <View style={styles.sidebar}>
        <View><Brand compact /><View style={styles.sideRule} /><Text style={styles.sideMuted}>Solicitud personal</Text><Text style={styles.sideMuted}>Solicitud</Text><Text style={styles.sideCode}>{requestCode(snapshot.id)}</Text><View style={styles.sideRule} /><Text style={styles.sideMuted}>Estado de tu solicitud</Text><View style={styles.sideStatus}><Text style={styles.sideStatusMark}>!</Text><Text style={styles.sideStatusText}>{snapshot.status === 'REQUIRES_CORRECTION' ? 'Requiere corrección' : snapshot.status === 'SUBMITTED' ? 'En revisión' : snapshot.status === 'APPROVED' ? 'Aprobada' : 'Finalizada'}</Text></View><Text style={styles.sideMuted}>{formatDate(snapshot.submittedAt ?? snapshot.createdAt)}</Text></View>
        <View style={styles.sidebarFooter}><LiquidGlassPanel style={styles.motto}><Text style={styles.mottoTitle}>Tu talento merece ser visto.</Text><Text style={styles.mottoCopy}>Accede a la plataforma donde tu evidencia construye oportunidades.</Text></LiquidGlassPanel><Pressable accessibilityLabel="Cerrar sesión" accessibilityRole="button" onPress={onLogout}><Text style={styles.sessionLink}>Cerrar sesión</Text></Pressable></View>
      </View> : null}
      <View style={[styles.main, desktop ? styles.mainDesktop : styles.mainMobile]}>{!desktop ? <View style={styles.mobileHeader}><Brand compact dense /><Pressable accessibilityLabel="Cerrar sesión" accessibilityRole="button" onPress={onLogout}><Text style={styles.sessionLink}>Cerrar sesión</Text></Pressable></View> : null}{children}</View>
    </ScrollView>
  </ImageBackground>;
}

export function getApplicantStatusPageStyle(platform: typeof Platform.OS, height: number): ViewStyle {
  return platform === 'web' ? ({ minHeight: 'calc(100dvh - 60px)' } as unknown as ViewStyle) : { minHeight: Math.max(0, height - 60) };
}

function CorrectionContent({ snapshot, queue, onResubmit, failureMessage, readOnly = false }: Readonly<{ snapshot: RegistrationRequestSnapshot; queue: RegistrationEvidenceUploadQueue; onResubmit: () => Promise<boolean> | boolean; failureMessage?: () => string; readOnly?: boolean }>) {
  const { width } = useWindowDimensions();
  const mobile = width < authTokens.breakpoints.desktop;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [focusedControl, setFocusedControl] = useState<string>();
  const [, rerender] = useState(0);
  useEffect(() => queue.subscribe(() => rerender((value) => value + 1)), [queue]);
  const corrected = snapshot.evidence.filter((item) => item.correctionRequired);
  const pick = async (item: RegistrationRequestSnapshot['evidence'][number]) => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: false, multiple: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const source = Platform.OS === 'web' && asset.file
      ? { kind: 'web' as const, file: asset.file }
      : { kind: 'native' as const, uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream', size: asset.size ?? 0 };
    queue.addReplacement({ category: item.category as EvidenceCategory, label: EVIDENCE_LABELS[item.category] ?? 'Documento solicitado', source }, snapshot.status);
  };
  const send = async () => {
    setBusy(true); setMessage(undefined);
    try { setMessage(await onResubmit() ? 'Corrección enviada. La solicitud volvió a revisión.' : failureMessage?.() ?? 'No pudimos enviar la corrección. Tus archivos seleccionados se conservan para reintentar.'); }
    finally { setBusy(false); }
  };

  return <>
    <Text accessibilityRole="header" style={[styles.title, mobile && styles.titleMobile]}>Solicitud de registro</Text><Text style={[styles.subtitle, mobile && styles.subtitleMobile]}>Estado de tu solicitud</Text>
    <View style={[styles.warningHero, mobile && styles.warningHeroMobile]}><View style={[styles.warningIcon, mobile && styles.warningIconMobile]}><Text style={[styles.warningIconText, mobile && styles.warningIconTextMobile]}>!</Text></View><View style={styles.heroCopy}><Text accessibilityLiveRegion="assertive" style={[styles.warningTitle, mobile && styles.warningTitleMobile]}>Requiere corrección</Text><Text style={[styles.heroDescription, mobile && styles.heroDescriptionMobile]}>Necesitamos que ajustes un elemento antes de continuar la revisión.</Text></View></View>
    <View style={styles.mobileMeta}><Text style={styles.mobileCode}>{requestCode(snapshot.id)}</Text><Text style={styles.mobileDate}>{formatDate(snapshot.submittedAt ?? snapshot.createdAt)}</Text></View>
    <LiquidGlassPanel style={[styles.correctionCard, mobile && styles.correctionCardMobile]}>
      <View style={[styles.reasonColumn, mobile && styles.reasonColumnMobile]}><Text style={[styles.cardHeading, mobile && styles.cardHeadingMobile]}>Motivo de la corrección</Text><Text style={[styles.reason, mobile && styles.reasonMobile]}>{snapshot.safeReason ?? 'Revisa el elemento señalado antes de reenviar.'}</Text>{!mobile ? <Notice>El archivo sigue siendo privado y temporal. No envíes información adicional distinta de la solicitada.</Notice> : null}</View>
      <View style={[styles.targetColumn, mobile && styles.targetColumnMobile]}><Text style={[styles.cardHeading, mobile && styles.cardHeadingMobile]}>Sección por corregir</Text>{corrected.map((item) => {
        const queued = [...queue.items].reverse().find((candidate) => candidate.category === item.category && candidate.correctionReplacement);
        return <Pressable accessibilityLabel={`Seleccionar ${EVIDENCE_LABELS[item.category] ?? 'documento solicitado'}`} accessibilityRole="button" disabled={!editing || busy} key={item.id} onBlur={() => setFocusedControl(undefined)} onFocus={() => setFocusedControl(item.category)} onPress={() => { void pick(item); }} style={({ pressed }) => [styles.targetRow, mobile && styles.targetRowMobile, editing && styles.targetRowEditable, focusedControl === item.category && styles.focused, pressed && styles.targetPressed]}>
          <View style={[styles.documentIcon, mobile && styles.documentIconMobile]}><Text style={[styles.documentIconText, mobile && styles.documentIconTextMobile]}>▤</Text></View><View style={styles.targetCopy}><Text style={styles.targetTitle}>Documentos</Text><Text style={styles.targetLabel}>{EVIDENCE_LABELS[item.category] ?? 'Documento solicitado'}</Text>{editing ? <Text accessibilityLiveRegion="polite" style={styles.uploadState}>{queued ? queued.status === 'uploading' ? `Cargando ${queued.progress}%` : queued.status === 'clean' ? 'Documento listo' : queued.status === 'failed' ? 'No se pudo cargar. Selecciónalo de nuevo.' : 'Listo para cargar' : 'Selecciona el reemplazo'}</Text> : null}</View>
        </Pressable>;
      })}{mobile ? <Notice>El archivo sigue siendo privado y temporal.</Notice> : null}</View>
    </LiquidGlassPanel>
    {message ? <Text accessibilityLiveRegion="assertive" style={styles.resultMessage}>{message}</Text> : null}
    <View style={[styles.actions, mobile && styles.actionsMobile]}>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || readOnly }} disabled={busy || readOnly} onBlur={() => setFocusedControl(undefined)} onFocus={() => setFocusedControl('primary')} onPress={editing ? () => { void send(); } : () => setEditing(true)} style={({ pressed }) => [styles.primaryButton, mobile && styles.actionButtonMobile, focusedControl === 'primary' && styles.focused, pressed && styles.primaryPressed]}><Text style={styles.primaryText}>{busy ? 'Enviando…' : editing ? 'Reenviar solicitud' : 'Corregir solicitud'}</Text><Text accessibilityElementsHidden style={styles.arrow}>→</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: readOnly }} disabled={readOnly} onBlur={() => setFocusedControl(undefined)} onFocus={() => setFocusedControl('secondary')} onPress={() => setEditing(false)} style={[styles.outlineButton, mobile && styles.actionButtonMobile, focusedControl === 'secondary' && styles.focused]}><Text style={styles.outlineButtonText}>{editing ? 'Cancelar corrección' : 'Ver resumen enviado'}</Text></Pressable>
    </View>
    <Text style={styles.footerNote}>Solo actualiza el elemento señalado. El resto de tu información se conserva.</Text>
  </>;
}

export function ApplicantStatusFlow({ state, uploadQueue, authenticationNotice, readOnly = false, onRetryRestore, onResubmit, onRefreshCapabilities, onLogout = () => undefined, correctionFailureMessage }: Props) {
  const { width } = useWindowDimensions();
  const mobile = width < authTokens.breakpoints.desktop;
  const [refreshFocused, setRefreshFocused] = useState(false);
  const snapshot = state.snapshot;
  if (!snapshot) return <ImageBackground source={require('../../../assets/authentication/liquid-emerald-abstract-v1.png')} style={styles.background}><StateMessage onRetry={onRetryRestore} state={state} /></ImageBackground>;
  if (snapshot.status === 'REQUIRES_CORRECTION') return <StatusChrome snapshot={snapshot} onLogout={onLogout}><CorrectionContent failureMessage={correctionFailureMessage} onResubmit={onResubmit} queue={uploadQueue} readOnly={readOnly} snapshot={snapshot} /></StatusChrome>;

  const approved = snapshot.status === 'APPROVED';
  const rejected = snapshot.status === 'REJECTED';
  const title = approved ? 'Solicitud aprobada' : rejected ? 'Solicitud no aprobada' : 'Solicitud enviada';
  const copy = approved ? 'Estamos actualizando tu acceso con los permisos confirmados por el servidor.' : rejected ? snapshot.safeReason ?? 'La revisión terminó sin crear acceso al producto.' : 'Hemos recibido tu solicitud, en breve el equipo de New Talents la revisará.';
  return <StatusChrome snapshot={snapshot} onLogout={onLogout}>
    <Text accessibilityRole="header" style={[styles.title, mobile && styles.titleMobile]}>Solicitud de registro</Text><Text style={[styles.subtitle, mobile && styles.subtitleMobile]}>Estado de tu solicitud</Text>
    <LiquidGlassPanel style={[styles.statePanel, rejected && styles.rejectedPanel]}><Text accessibilityLiveRegion="assertive" style={[styles.stateTitle, rejected && styles.warningText]}>{title}</Text><Text style={styles.heroDescription}>{copy}</Text></LiquidGlassPanel>
    {approved && authenticationNotice ? <View style={styles.refreshNotice}><Text style={styles.reason}>No pudimos actualizar tu acceso todavía.</Text><Pressable accessibilityRole="button" onBlur={() => setRefreshFocused(false)} onFocus={() => setRefreshFocused(true)} onPress={onRefreshCapabilities} style={[styles.outlineButton, refreshFocused && styles.focused]}><Text style={styles.outlineButtonText}>Actualizar acceso</Text></Pressable></View> : null}
    {rejected && snapshot.deletion ? <Text accessibilityLiveRegion="polite" style={styles.footerNote}>Eliminación segura de evidencias: {snapshot.deletion.status === 'COMPLETED' ? 'completada' : 'en proceso'}.</Text> : null}
  </StatusChrome>;
}

const styles = StyleSheet.create({
  background: { backgroundColor: authTokens.colors.canvasDeep, flex: 1, width: '100%' },
  backgroundImage: { height: '100%', width: '100%' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 12, 8, 0.38)', pointerEvents: 'none' },
  page: { flexGrow: 1 },
  pageDesktop: { borderColor: 'rgba(190,239,210,.55)', borderRadius: 18, borderWidth: 1, flexDirection: 'row', margin: 30, overflow: 'hidden' },
  pageMobile: { boxSizing: 'border-box', maxWidth: '100%', minHeight: '100%', overflow: 'hidden', paddingBottom: 32, paddingHorizontal: 22, paddingTop: 22, width: '100%' },
  sidebar: { borderRightColor: 'rgba(210,255,226,.24)', borderRightWidth: 1, justifyContent: 'space-between', padding: 30, width: 240 },
  sideRule: { backgroundColor: 'rgba(210,255,226,.24)', height: 1, marginBottom: 26, marginTop: 8 },
  sideMuted: { color: authTokens.colors.textSecondary, fontSize: 14, lineHeight: 21 },
  sideCode: { color: authTokens.colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  sideStatus: { alignItems: 'center', borderColor: authTokens.colors.warning, borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 12, marginBottom: 18, marginTop: 8, minHeight: 56, padding: 10 },
  sideStatusMark: { color: authTokens.colors.warning, fontSize: 24, fontWeight: '900' },
  sideStatusText: { color: authTokens.colors.warning, flex: 1, fontSize: 13, fontWeight: '800' },
  motto: { gap: 8, padding: 18 },
  mottoTitle: { color: authTokens.colors.textPrimary, fontSize: 17, fontWeight: '800', lineHeight: 22 },
  mottoCopy: { color: authTokens.colors.textSecondary, fontSize: 12, lineHeight: 18 },
  sidebarFooter: { gap: 12 },
  sessionLink: { color: authTokens.colors.textPrimary, fontSize: 14, fontWeight: '800', paddingVertical: 6 },
  mobileHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  mobileReturn: { color: authTokens.colors.primary, fontSize: 15, fontWeight: '800', marginTop: 24, textAlign: 'center' },
  main: { flex: 1, marginHorizontal: 'auto', maxWidth: 1060, minWidth: 0, width: '100%' },
  mainDesktop: { paddingBottom: 44, paddingHorizontal: 50, paddingTop: 52 },
  mainMobile: { alignSelf: 'stretch', marginHorizontal: 0, maxWidth: '100%', width: 'auto' },
  title: { color: authTokens.colors.textPrimary, fontSize: 50, fontWeight: '900', letterSpacing: -1.2, lineHeight: 57 },
  titleMobile: { fontSize: 34, lineHeight: 40, marginTop: 0 },
  subtitle: { color: authTokens.colors.textSecondary, fontSize: 25, lineHeight: 32, marginBottom: 22, marginTop: 4 },
  subtitleMobile: { fontSize: 18, marginBottom: 8 },
  warningHero: { alignItems: 'center', flexDirection: 'row', gap: 22, marginBottom: 20 },
  warningHeroMobile: { backgroundColor: 'rgba(25,28,6,.48)', borderColor: authTokens.colors.warning, borderRadius: 12, borderWidth: 1, gap: 14, marginBottom: 12, padding: 16 },
  warningIcon: { alignItems: 'center', borderColor: authTokens.colors.warning, borderRadius: 42, borderWidth: 3, height: 64, justifyContent: 'center', width: 64 },
  warningIconMobile: { borderRadius: 28, height: 52, width: 52 },
  warningIconText: { color: authTokens.colors.warning, fontSize: 40, fontWeight: '900' },
  warningIconTextMobile: { fontSize: 32 },
  heroCopy: { flex: 1, minWidth: 0 },
  warningTitle: { color: authTokens.colors.warning, flexShrink: 1, fontSize: 54, fontWeight: '900', letterSpacing: -.9, lineHeight: 61 },
  warningTitleMobile: { fontSize: 28, lineHeight: 34 },
  heroDescription: { color: authTokens.colors.textSecondary, flexShrink: 1, fontSize: 20, lineHeight: 29 },
  heroDescriptionMobile: { fontSize: 16, lineHeight: 23 },
  mobileMeta: { marginBottom: 12 },
  mobileCode: { color: authTokens.colors.textPrimary, fontSize: 22, fontWeight: '900' },
  mobileDate: { color: authTokens.colors.textSecondary, fontSize: 15, marginTop: 4 },
  warningText: { color: authTokens.colors.warning },
  limeText: { color: authTokens.colors.primary },
  correctionCard: { flexDirection: 'row', gap: 34, minHeight: 278, padding: 34 },
  correctionCardMobile: { flexDirection: 'column', gap: 16, minHeight: 0, padding: 18 },
  reasonColumn: { flex: 1.25 },
  reasonColumnMobile: { flexBasis: 'auto', flexGrow: 0, flexShrink: 0 },
  targetColumn: { borderLeftColor: 'rgba(210,255,226,.25)', borderLeftWidth: 1, flex: 1, paddingLeft: 34 },
  targetColumnMobile: { borderLeftWidth: 0, borderTopColor: 'rgba(210,255,226,.25)', borderTopWidth: 1, flexBasis: 'auto', flexGrow: 0, flexShrink: 0, paddingLeft: 0, paddingTop: 18 },
  cardHeading: { color: authTokens.colors.textPrimary, fontSize: 19, fontWeight: '900', marginBottom: 8 },
  cardHeadingMobile: { fontSize: 17, lineHeight: 21 },
  reason: { color: authTokens.colors.textSecondary, fontSize: 16, lineHeight: 24 },
  reasonMobile: { fontSize: 14, lineHeight: 20 },
  targetRow: { alignItems: 'center', borderColor: 'rgba(190,239,210,.50)', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 16, minHeight: 94, padding: 16 },
  targetRowMobile: { gap: 12, minHeight: 58, padding: 10 },
  targetRowEditable: { borderColor: authTokens.colors.primary },
  targetPressed: { backgroundColor: 'rgba(199,255,46,.08)' },
  documentIcon: { alignItems: 'center', borderColor: 'rgba(190,239,210,.6)', borderRadius: 34, borderWidth: 1, height: 58, justifyContent: 'center', width: 58 },
  documentIconMobile: { borderRadius: 24, height: 46, width: 46 },
  documentIconText: { color: authTokens.colors.textPrimary, fontSize: 28 },
  documentIconTextMobile: { fontSize: 22 },
  targetCopy: { flex: 1, minWidth: 0 },
  targetTitle: { color: authTokens.colors.textPrimary, fontSize: 17, fontWeight: '900' },
  targetLabel: { color: authTokens.colors.textSecondary, fontSize: 15, lineHeight: 22 },
  uploadState: { color: authTokens.colors.primary, fontSize: 13, marginTop: 5 },
  actions: { flexDirection: 'row', gap: 22, marginTop: 34 },
  actionsMobile: { flexDirection: 'column', gap: 12 },
  primaryButton: { alignItems: 'center', backgroundColor: authTokens.colors.primary, borderRadius: 10, flex: 1.25, flexDirection: 'row', justifyContent: 'center', minHeight: 66, paddingHorizontal: 20 },
  primaryPressed: { backgroundColor: authTokens.colors.primaryPressed },
  actionButtonMobile: { minHeight: 50 },
  primaryText: { color: authTokens.colors.canvasDeep, flex: 1, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  arrow: { color: authTokens.colors.canvasDeep, fontSize: 32 },
  outlineButton: { alignItems: 'center', borderColor: 'rgba(228,255,236,.76)', borderRadius: 10, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 58, paddingHorizontal: 18 },
  outlineButtonText: { color: authTokens.colors.textPrimary, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  focused: { borderColor: authTokens.colors.focusRing, borderWidth: 3 },
  footerNote: { color: authTokens.colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 20, textAlign: 'center' },
  resultMessage: { color: authTokens.colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  statePanel: { gap: 10, marginTop: 18, padding: 28 },
  rejectedPanel: { borderColor: authTokens.colors.warning },
  stateTitle: { color: authTokens.colors.primary, fontSize: 34, fontWeight: '900' },
  refreshNotice: { gap: 16, marginTop: 24 },
  centerState: { alignItems: 'center', flex: 1, gap: 20, justifyContent: 'center', minHeight: 500, padding: 30 },
  centerTitle: { color: authTokens.colors.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' },
});
