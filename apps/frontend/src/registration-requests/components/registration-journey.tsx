import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import * as DocumentPicker from 'expo-document-picker';
import { AccessibilityInfo, ActivityIndicator, findNodeHandle, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type TextInputProps, type ViewStyle } from 'react-native';

import { LiquidGlassPanel } from '../../design/components/liquid-glass-panel';
import { authTokens } from '../../design/tokens';
import type { EvidenceCategory, RegistrationEvidenceUploadQueue } from '../evidence/upload-queue';
import { COLOMBIA_MUNICIPALITIES } from '../validation/colombia-municipalities';
import { COLOMBIA_COUNTRY_CODE, COLOMBIA_DOCUMENT_TYPES, documentTypesForSubject, municipalityLabel, type RegistrationPersonSubject } from '../validation/registration-person-validation';

const webBorderBox = Platform.OS === 'web' ? ({ boxSizing: 'border-box' } as unknown as ViewStyle) : {};

export function getJourneyViewportStyles(platform: typeof Platform.OS, height: number): Readonly<{ shell: ViewStyle; content: ViewStyle; action: ViewStyle }> {
  if (platform === 'web') {
    return {
      shell: { backgroundColor: authTokens.colors.canvasDeep, minHeight: '100dvh', overflowX: 'clip' } as unknown as ViewStyle,
      content: { minHeight: '100dvh' } as unknown as ViewStyle,
      action: { paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' } as unknown as ViewStyle,
    };
  }
  return {
    shell: { backgroundColor: authTokens.colors.canvasDeep, minHeight: '100%' },
    content: { minHeight: height },
    action: { paddingBottom: 18 },
  };
}

export function getJourneyFixedBackgroundStyle(platform: typeof Platform.OS): ViewStyle {
  const fill: ViewStyle = { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 };
  return platform === 'web'
    ? ({ ...fill, position: 'fixed' } as unknown as ViewStyle)
    : fill;
}

export type JourneyStep = Readonly<{ label: string; state?: 'complete' | 'current' | 'pending' }>;

export function JourneyShell({ children, steps, title, subtitle, sidebarTitle = 'Tu talento merece ser visto.' }: Readonly<{ children: ReactNode; steps: readonly JourneyStep[]; title: string; subtitle: string; sidebarTitle?: string }>) {
  const { height, width } = useWindowDimensions();
  const desktop = width >= authTokens.breakpoints.desktop;
  const viewportStyles = getJourneyViewportStyles(Platform.OS, height);
  return (
    <View style={[styles.background, viewportStyles.shell]}>
      <View pointerEvents="none" style={getJourneyFixedBackgroundStyle(Platform.OS)} testID="registration-fixed-background">
        <View style={[StyleSheet.absoluteFill, styles.backgroundGradient, webBackgroundGradient]} testID="registration-fixed-background-gradient" />
        <Image source={require('../../../assets/authentication/liquid-emerald-abstract-v1.png')} resizeMode="cover" style={[StyleSheet.absoluteFill, styles.backgroundImageFill]} testID="registration-fixed-background-image" />
        <View style={styles.scrim} />
      </View>
      <ScrollView contentContainerStyle={[styles.page, desktop ? styles.pageDesktop : [viewportStyles.content, styles.pageMobile]]} keyboardShouldPersistTaps="handled" style={styles.scroll} testID="registration-journey-scroll">
        {desktop ? <View style={styles.sidebar}>
          <Brand />
          <VerticalSteps steps={steps} />
          <LiquidGlassPanel style={styles.motto}><Text style={styles.mottoTitle}>{sidebarTitle}</Text><Text style={styles.mottoCopy}>Accede a la plataforma donde tu evidencia construye oportunidades.</Text></LiquidGlassPanel>
        </View> : null}
        <View style={[styles.main, webBorderBox, desktop ? styles.mainDesktop : { alignSelf: 'center', flexBasis: Math.max(0, width - 48), flexGrow: 1, flexShrink: 0, maxWidth: Math.max(0, width - 48), paddingHorizontal: 0, width: Math.max(0, width - 48) }]}>
          {!desktop ? <Brand /> : null}
          {!desktop ? <HorizontalSteps steps={steps} /> : null}
          <Text accessibilityRole="header" style={[styles.title, desktop && styles.titleDesktop]}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

export function Brand({ compact = false, dense = false }: Readonly<{ compact?: boolean; dense?: boolean }>) {
  return <Text accessibilityLabel="New Talents" accessibilityRole="image" numberOfLines={1} style={[styles.brand, compact && styles.brandCompact, dense && styles.brandDense]}><Text style={styles.brandAccent}>NEW</Text> TALENTS</Text>;
}

function VerticalSteps({ steps }: Readonly<{ steps: readonly JourneyStep[] }>) {
  return <View accessibilityLabel="Progreso de la solicitud" style={styles.verticalSteps}>{steps.map((step, index) => <View key={step.label} style={styles.verticalStep}><View style={[styles.stepDot, step.state !== 'pending' && styles.stepDotActive]}><Text style={[styles.stepNumber, step.state !== 'pending' && styles.stepNumberActive]}>{step.state === 'complete' ? '✓' : index + 1}</Text></View><Text style={[styles.verticalLabel, step.state === 'current' && styles.currentLabel]}>{step.label}</Text></View>)}</View>;
}

function HorizontalSteps({ steps }: Readonly<{ steps: readonly JourneyStep[] }>) {
  const current = Math.max(0, steps.findIndex((step) => step.state === 'current'));
  return <View accessibilityLabel="Progreso de la solicitud" style={styles.progressWrap}><Text style={styles.stepCaption}>Paso {current + 1} de {steps.length}</Text><View style={styles.horizontalSteps}>{steps.map((step, index) => <View key={step.label} style={styles.horizontalStep}>{index ? <View style={[styles.stepLine, step.state !== 'pending' && styles.stepLineActive]} /> : null}<View style={[styles.smallDot, step.state !== 'pending' && styles.smallDotActive]}><Text style={styles.smallDotText}>{step.state === 'complete' ? '✓' : ''}</Text></View><Text numberOfLines={1} style={[styles.horizontalLabel, styles.horizontalLabelMobile, step.state !== 'pending' && styles.activeLabel]}>{step.label}</Text></View>)}</View></View>;
}

export function GlassCard({ children, style }: Readonly<{ children: ReactNode; style?: object }>) { return <LiquidGlassPanel style={[styles.card, styles.menuOverflow, style]}>{children}</LiquidGlassPanel>; }

function FieldLabel({ children }: Readonly<{ children: string }>) {
  return <View style={styles.fieldLabelSlot} testID="registration-field-label-slot"><Text style={styles.fieldLabel}>{children}</Text></View>;
}

type FloatingMenuLayout = Readonly<{ left: number; maxHeight: number; top: number; width: number }>;

function useWebFloatingMenu(anchor: RefObject<View | TextInput | null>, open: boolean): FloatingMenuLayout | undefined {
  const [layout, setLayout] = useState<FloatingMenuLayout>();
  useEffect(() => {
    if (Platform.OS !== 'web' || !open) { setLayout(undefined); return; }
    const update = () => {
      const element = anchor.current as unknown as HTMLElement | null;
      if (!element?.getBoundingClientRect) return;
      const rect = element.getBoundingClientRect();
      setLayout({ left: rect.left, maxHeight: Math.max(120, Math.min(320, window.innerHeight - rect.bottom - 12)), top: rect.bottom + 4, width: rect.width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchor, open]);
  return layout;
}

function ForegroundMenu({ children, layout }: Readonly<{ children: ReactNode; layout?: FloatingMenuLayout }>) {
  if (Platform.OS !== 'web' || !layout) return children;
  return createPortal(children, document.body);
}

export function Field({ label, error, focusRequest, ...props }: TextInputProps & Readonly<{ label: string; error?: string; focusRequest?: number }>) {
  const input = useRef<TextInput>(null);
  useEffect(() => { if (focusRequest !== undefined) input.current?.focus(); }, [focusRequest]);
  return <View style={styles.fieldWrap}><FieldLabel>{label}</FieldLabel><TextInput accessibilityHint={error} accessibilityLabel={label} placeholderTextColor={authTokens.colors.textMuted} ref={input} style={[styles.field, error && styles.fieldError]} {...props} />{error ? <Text accessibilityLiveRegion="assertive" style={journeyStyles.error}>{error}</Text> : null}</View>;
}

export function DocumentTypeSelect({ label = 'Tipo de documento', value, onChange, subject, error, focusRequest }: Readonly<{ label?: string; value: string; onChange: (value: string) => void; subject: RegistrationPersonSubject; error?: string; focusRequest?: number }>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const control = useRef<View>(null);
  const floatingLayout = useWebFloatingMenu(control, open);
  useEffect(() => { if (focusRequest !== undefined && control.current) (control.current as unknown as { focus?: () => void }).focus?.(); }, [focusRequest]);
  const allowed = documentTypesForSubject(subject);
  const options = COLOMBIA_DOCUMENT_TYPES.filter((item) => (allowed as readonly string[]).includes(item.value));
  const selected = options.find((item) => item.value === value);
  const choose = (next: string) => { onChange(next); setOpen(false); setActiveIndex(0); };
  const keyboardProps = Platform.OS === 'web' ? ({ onKeyDown: (event: Readonly<{ key: string; preventDefault(): void }>) => { const key = event.key; if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(key)) return; event.preventDefault(); if (key === 'ArrowDown') { setOpen(true); setActiveIndex((current) => Math.min(options.length - 1, current + 1)); } else if (key === 'ArrowUp') { setOpen(true); setActiveIndex((current) => Math.max(0, current - 1)); } else if (key === 'Enter' && open) choose(options[activeIndex]!.value); else if (key === 'Escape') setOpen(false); } } as unknown as object) : {};
  const menu = open ? <View accessibilityLabel={`Opciones de ${label}`} style={[styles.optionList, styles.floatingMenu, floatingLayout ? ({ left: floatingLayout.left, maxHeight: floatingLayout.maxHeight, position: 'fixed', top: floatingLayout.top, width: floatingLayout.width } as unknown as ViewStyle) : styles.inlineFloatingMenu]}>{options.map((item, index) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: value === item.value }} key={item.value} onPress={() => choose(item.value)} style={[styles.option, (value === item.value || index === activeIndex) && styles.optionSelected]}><Text style={styles.optionText}>{item.label}</Text></Pressable>)}</View> : null;
  return <View style={[styles.fieldWrap, open && styles.menuFieldOpen]}><FieldLabel>{label}</FieldLabel><View style={styles.menuAnchor}><Pressable {...keyboardProps} accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ expanded: open }} focusable onPress={() => setOpen((current) => !current)} ref={control} style={[styles.field, styles.selectButton, error && styles.fieldError]}><Text style={selected ? styles.selectValue : styles.selectPlaceholder}>{selected?.label ?? 'Selecciona una opción'}</Text></Pressable>{menu ? <ForegroundMenu layout={floatingLayout}>{menu}</ForegroundMenu> : null}</View>{error ? <Text accessibilityLiveRegion="assertive" style={journeyStyles.error}>{error}</Text> : null}</View>;
}

export function formatRegistrationDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

export function DateField({ label = 'Fecha de nacimiento', value, onChange, error, focusRequest }: Readonly<{ label?: string; value: string; onChange: (value: string) => void; error?: string; focusRequest?: number }>) {
  const webDate = Platform.OS === 'web' ? ({ type: 'date', max: new Date().toISOString().slice(0, 10) } as unknown as TextInputProps) : {};
  return <Field {...webDate} error={error} focusRequest={focusRequest} keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'} label={label} maxLength={10} onChangeText={(next) => onChange(formatRegistrationDateInput(next))} placeholder="AAAA-MM-DD" value={value} />;
}

export function CountryField({ label = 'País' }: Readonly<{ label?: string }>) {
  return <View style={styles.fieldWrap}><FieldLabel>{label}</FieldLabel><View accessibilityLabel={`${label}: Colombia`} accessibilityRole="text" style={[styles.field, styles.readOnlyField]}><Text style={styles.selectValue}>Colombia</Text></View><Text style={styles.helpText}>Disponible para este MVP · código {COLOMBIA_COUNTRY_CODE}</Text></View>;
}

export function MunicipalitySelect({ label = 'Municipio', value, onChange, error, focusRequest }: Readonly<{ label?: string; value: string; onChange: (value: string) => void; error?: string; focusRequest?: number }>) {
  const input = useRef<TextInput>(null);
  const [query, setQuery] = useState(value ? municipalityLabel(value) : '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const floatingLayout = useWebFloatingMenu(input, open && query.length >= 2);
  useEffect(() => { if (focusRequest !== undefined) input.current?.focus(); }, [focusRequest]);
  const normalized = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  const options = normalized.length < 2 ? [] : COLOMBIA_MUNICIPALITIES.filter((item) => `${item.name} ${item.department} ${item.code}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().includes(normalized)).slice(0, 12);
  const choose = (code: string) => { onChange(code); setQuery(municipalityLabel(code)); setOpen(false); setActiveIndex(0); };
  const menu = open && query.length >= 2 ? <ScrollView accessibilityLabel="Resultados de municipios" keyboardShouldPersistTaps="handled" nestedScrollEnabled style={[styles.optionList, styles.floatingMenu, floatingLayout ? ({ left: floatingLayout.left, maxHeight: floatingLayout.maxHeight, position: 'fixed', top: floatingLayout.top, width: floatingLayout.width } as unknown as ViewStyle) : styles.inlineFloatingMenu]}>{options.length ? options.map((item, index) => <Pressable accessibilityRole="button" key={item.code} onPress={() => choose(item.code)} style={[styles.option, index === activeIndex && styles.optionSelected]}><Text style={styles.optionText}>{municipalityLabel(item.code)}</Text><Text style={styles.optionCode}>{item.code}</Text></Pressable>) : <Text accessibilityLiveRegion="polite" style={styles.helpText}>No hay municipios coincidentes.</Text>}</ScrollView> : null;
  return <View style={[styles.fieldWrap, open && query.length >= 2 && styles.menuFieldOpen]} testID="municipality-field-wrap"><FieldLabel>{label}</FieldLabel><View style={styles.menuAnchor}><TextInput accessibilityHint={error ?? 'Escribe al menos dos letras y selecciona una opción del catálogo DANE.'} accessibilityLabel={label} onChangeText={(next) => { setQuery(next); onChange(''); setOpen(true); setActiveIndex(0); }} onFocus={() => setOpen(true)} onKeyPress={(event) => { if (!options.length) return; if (event.nativeEvent.key === 'ArrowDown') setActiveIndex((current) => Math.min(options.length - 1, current + 1)); else if (event.nativeEvent.key === 'ArrowUp') setActiveIndex((current) => Math.max(0, current - 1)); else if (event.nativeEvent.key === 'Enter') choose(options[activeIndex]!.code); else if (event.nativeEvent.key === 'Escape') setOpen(false); }} placeholder="Buscar municipio o código DIVIPOLA" placeholderTextColor={authTokens.colors.textMuted} ref={input} style={[styles.field, error && styles.fieldError]} value={query} />{menu ? <ForegroundMenu layout={floatingLayout}>{menu}</ForegroundMenu> : null}</View>{value ? <Text style={styles.helpText}>Código DIVIPOLA: {value}</Text> : null}{error ? <Text accessibilityLiveRegion="assertive" style={journeyStyles.error}>{error}</Text> : null}</View>;
}

export function Choice({ label, selected, onPress, role = 'checkbox', supportingText, error, focusRequest }: Readonly<{ label: string; selected: boolean; onPress: () => void; role?: 'checkbox' | 'radio'; supportingText?: string; error?: string; focusRequest?: number }>) {
  const control = useRef<View>(null);
  useEffect(() => {
    if (focusRequest === undefined || !control.current) return;
    if (Platform.OS === 'web') (control.current as unknown as HTMLElement).focus();
    else { const node = findNodeHandle(control.current); if (node !== null) AccessibilityInfo.setAccessibilityFocus(node); }
  }, [focusRequest]);
  return <View><Pressable accessibilityLabel={label} accessibilityRole={role} accessibilityState={role === 'radio' ? { selected } : { checked: selected }} focusable onPress={onPress} ref={control} style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.choicePressed]}><View style={[styles.choiceMark, selected && styles.choiceMarkSelected]}><Text style={styles.choiceTick}>{selected ? '✓' : ''}</Text></View><View style={styles.choiceCopy}><Text style={styles.choiceLabel}>{label}</Text>{supportingText ? <Text style={styles.choiceSupporting}>{supportingText}</Text> : null}</View></Pressable>{error ? <Text accessibilityLiveRegion="assertive" style={journeyStyles.error}>{error}</Text> : null}</View>;
}

export function Notice({ children }: Readonly<{ children: ReactNode }>) { return <View accessibilityRole="text" style={styles.notice}><Text style={styles.noticeIcon}>ⓘ</Text><Text style={styles.noticeText}>{children}</Text></View>; }

export function Actions({ primaryLabel, onPrimary, onBack, busy = false, secondaryLabel = 'Volver' }: Readonly<{ primaryLabel: string; onPrimary: () => void; onBack?: () => void; busy?: boolean; secondaryLabel?: string }>) {
  const { height, width } = useWindowDimensions();
  const mobile = width < authTokens.breakpoints.desktop;
  const viewportStyles = getJourneyViewportStyles(Platform.OS, height);
  return <View style={[styles.actions, mobile && styles.mobileActions, mobile && viewportStyles.action]} testID="registration-journey-actions">{onBack ? <Pressable accessibilityLabel={secondaryLabel} accessibilityRole="button" onPress={onBack} style={styles.secondaryButton}><Text style={styles.secondaryText}>{secondaryLabel}</Text></Pressable> : null}<Pressable accessibilityLabel={primaryLabel} accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onPrimary} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}><Text style={styles.primaryText}>{busy ? primaryLabel === 'Enviar solicitud' ? 'Enviando…' : 'Guardando…' : primaryLabel}</Text><Text accessibilityElementsHidden style={styles.arrow}>→</Text></Pressable></View>;
}

type EvidenceRequirement = string | Readonly<{ category: EvidenceCategory; label: string }>;

export function EvidenceRequirements({ items, title = 'Documentos de identidad', queue, readOnly = false, focusRequest, errorCategory, error }: Readonly<{ items: readonly EvidenceRequirement[]; title?: string; queue?: RegistrationEvidenceUploadQueue; readOnly?: boolean; focusRequest?: Readonly<{ category: EvidenceCategory; nonce: number }>; errorCategory?: EvidenceCategory; error?: string }>) {
  const [, redraw] = useState(0);
  const [pickerError, setPickerError] = useState<string>();
  const controls = useRef<Partial<Record<EvidenceCategory, View | null>>>({});
  useEffect(() => queue?.subscribe(() => redraw((value) => value + 1)), [queue]);
  useEffect(() => {
    if (!focusRequest) return;
    const control = controls.current[focusRequest.category];
    if (!control) return;
    if (Platform.OS === 'web') (control as unknown as HTMLElement).focus();
    else { const node = findNodeHandle(control); if (node !== null) AccessibilityInfo.setAccessibilityFocus(node); }
  }, [focusRequest]);
  const select = async (item: Exclude<EvidenceRequirement, string>) => {
    if (!queue || readOnly) return;
    setPickerError(undefined);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: false, multiple: false });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (Platform.OS === 'web' && !asset.file) { setPickerError('No pudimos leer el archivo seleccionado. Vuelve a elegir un PDF, JPEG o PNG.'); return; }
      const source = Platform.OS === 'web'
        ? { kind: 'web' as const, file: asset.file! }
        : { kind: 'native' as const, uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream', size: asset.size ?? 0 };
      queue.add({ category: item.category, label: item.label, source });
    } catch { setPickerError('No pudimos abrir el selector de documentos. Intenta seleccionar el archivo de nuevo.'); }
  };
  return <GlassCard><Text style={styles.cardTitle}>{title}</Text>{items.map((requirement) => {
    const item = typeof requirement === 'string' ? { label: requirement } : requirement;
    const queued = 'category' in item && queue ? [...queue.items].reverse().find((candidate) => candidate.category === item.category) : undefined;
    const status = queued?.status;
    const statusText = status === 'clean' ? 'CLEAN · documento listo' : status === 'failed' ? 'Error de carga · reemplaza o reintenta' : status === 'scanning' ? 'Escaneando de forma segura' : status === 'uploading' ? queued?.progress === undefined ? 'Cargando archivo' : `Cargando ${queued.progress}%` : status === 'selected' ? 'Seleccionado para enviar' : 'Falta seleccionar';
    const busy = status === 'uploading' || status === 'scanning';
    const glyph = status === 'clean' ? '✓' : status === 'selected' ? '↑' : status === 'failed' ? '!' : '—';
    const row = <><View style={[styles.documentIcon, status === 'clean' && styles.documentIconClean, status === 'failed' && styles.documentIconError]}>{busy ? <ActivityIndicator accessibilityLabel={statusText} color={authTokens.colors.primary} size="small" /> : <Text style={[styles.documentGlyph, status === 'clean' && styles.documentGlyphClean, status === 'failed' && styles.evidenceError]}>{glyph}</Text>}</View><Text style={styles.evidenceLabel}>{item.label}</Text><Text accessibilityLiveRegion="polite" style={[styles.ready, !status && styles.evidenceMissing, status === 'failed' && styles.evidenceError]}>{statusText}</Text></>;
    return 'category' in item && queue && !readOnly
      ? <View key={item.label}><View style={styles.evidenceRow}><Pressable accessibilityLabel={`${queued ? 'Reemplazar' : 'Seleccionar'} ${item.label}`} accessibilityRole="button" focusable onPress={() => { void select(item); }} ref={(control) => { controls.current[item.category] = control; }} style={styles.evidenceSelect}>{row}</Pressable>{queued && ['selected', 'failed', 'cancelled'].includes(queued.status) ? <Pressable accessibilityLabel={`Quitar ${item.label}`} accessibilityRole="button" onPress={() => queue.remove(queued.id)} style={styles.removeEvidence}><Text accessibilityElementsHidden style={styles.removeEvidenceGlyph}>🗑</Text></Pressable> : null}</View>{errorCategory === item.category && error ? <Text accessibilityLiveRegion="assertive" style={journeyStyles.error}>{error}</Text> : null}</View>
      : <View key={item.label} style={styles.evidenceRow}>{row}</View>;
  })}{pickerError ? <Text accessibilityLiveRegion="assertive" style={journeyStyles.error}>{pickerError}</Text> : null}<Notice>Archivos privados y temporales. Solo el equipo autorizado podrá consultarlos durante la revisión.</Notice></GlassCard>;
}

export const journeyStyles = StyleSheet.create({
  section: { gap: 16, marginTop: 22 },
  sectionTitle: { color: authTokens.colors.textPrimary, fontSize: 22, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  half: { flexBasis: 300, flexGrow: 1 },
  error: { color: authTokens.colors.danger, fontSize: 14, fontWeight: '700', marginTop: 12 },
  muted: { color: authTokens.colors.textSecondary, fontSize: 15, lineHeight: 22 },
  summaryTitle: { color: authTokens.colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  summaryText: { color: authTokens.colors.textSecondary, fontSize: 15, lineHeight: 23 },
});

const webBackgroundGradient = Platform.OS === 'web'
  ? ({ backgroundImage: 'linear-gradient(145deg, #03110c 0%, #071f16 45%, #020806 100%)' } as unknown as ViewStyle)
  : {};

const styles = StyleSheet.create({
  background: { flex: 1, maxWidth: '100%', width: '100%' },
  backgroundGradient: { backgroundColor: authTokens.colors.canvasDeep },
  backgroundImageFill: { height: '100%', width: '100%' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 12, 8, 0.42)', pointerEvents: 'none' },
  scroll: { maxWidth: '100%' },
  page: { flexGrow: 1, paddingBottom: 120, paddingHorizontal: 0, paddingTop: 38 },
  pageMobile: { paddingBottom: 0, paddingTop: 0 },
  pageDesktop: { flexDirection: 'row', padding: 0 },
  sidebar: { borderRightColor: 'rgba(210,255,226,.25)', borderRightWidth: 1, justifyContent: 'space-between', minHeight: 900, padding: 38, width: 272 },
  main: { marginHorizontal: 'auto', maxWidth: 1120, minWidth: 0, paddingBottom: 44, paddingHorizontal: 24, paddingTop: 42 },
  mainDesktop: { alignSelf: 'stretch', flex: 1, paddingHorizontal: 32 },
  brand: { color: authTokens.colors.textPrimary, fontSize: 28, fontStyle: 'italic', fontWeight: '900', letterSpacing: -1.2, marginBottom: 34 },
  brandCompact: { fontSize: 24, letterSpacing: -1, marginBottom: 30 },
  brandDense: { marginBottom: 14 },
  brandAccent: { color: authTokens.colors.primary },
  motto: { gap: 10, padding: 22 },
  mottoTitle: { color: authTokens.colors.textPrimary, fontSize: 20, fontWeight: '800', lineHeight: 26 },
  mottoCopy: { color: authTokens.colors.textSecondary, fontSize: 13, lineHeight: 19 },
  verticalSteps: { gap: 18 },
  verticalStep: { alignItems: 'center', flexDirection: 'row', gap: 16 },
  stepDot: { alignItems: 'center', borderColor: authTokens.colors.textMuted, borderRadius: 24, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  stepDotActive: { borderColor: authTokens.colors.primary, borderWidth: 2 },
  stepNumber: { color: authTokens.colors.textSecondary, fontSize: 16 },
  stepNumberActive: { color: authTokens.colors.primary, fontWeight: '900' },
  verticalLabel: { color: authTokens.colors.textSecondary, fontSize: 16 },
  currentLabel: { color: authTokens.colors.textPrimary, fontWeight: '800' },
  progressWrap: { marginBottom: 30 },
  stepCaption: { color: authTokens.colors.textPrimary, fontSize: 15, marginBottom: 10 },
  horizontalSteps: { flexDirection: 'row' },
  horizontalStep: { alignItems: 'center', flex: 1, position: 'relative' },
  stepLine: { backgroundColor: authTokens.colors.textMuted, height: 2, position: 'absolute', right: '50%', top: 7, width: '100%' },
  stepLineActive: { backgroundColor: authTokens.colors.primary },
  smallDot: { backgroundColor: authTokens.colors.textSecondary, borderRadius: 9, height: 16, width: 16, zIndex: 1 },
  smallDotActive: { backgroundColor: authTokens.colors.primary },
  smallDotText: { color: authTokens.colors.canvasDeep, fontSize: 11, fontWeight: '900', textAlign: 'center' },
  horizontalLabel: { color: authTokens.colors.textSecondary, fontSize: 11, marginTop: 8 },
  horizontalLabelMobile: { fontSize: 9 },
  activeLabel: { color: authTokens.colors.primary },
  title: { color: authTokens.colors.textPrimary, fontSize: 42, fontWeight: '900', letterSpacing: -1.2, lineHeight: 48 },
  titleDesktop: { fontSize: 58, lineHeight: 64 },
  subtitle: { color: authTokens.colors.textSecondary, fontSize: 19, lineHeight: 28, marginTop: 8 },
  card: { gap: 14, marginTop: 22, padding: 22, position: 'relative', zIndex: 10 },
  menuOverflow: { overflow: 'visible' },
  fieldWrap: { flex: 1, gap: 6, minWidth: 220, position: 'relative' },
  menuFieldOpen: { elevation: 64, zIndex: 9000 },
  fieldLabelSlot: { height: 40, justifyContent: 'flex-end' },
  fieldLabel: { color: authTokens.colors.textSecondary, fontSize: 15, lineHeight: 20 },
  field: { backgroundColor: 'rgba(5,31,22,.54)', borderColor: 'rgba(190,239,210,.55)', borderRadius: 8, borderWidth: 1, color: authTokens.colors.textPrimary, fontSize: 17, minHeight: 52, paddingHorizontal: 16 },
  fieldError: { borderColor: authTokens.colors.danger, borderWidth: 2 },
  selectButton: { justifyContent: 'center' },
  selectValue: { color: authTokens.colors.textPrimary, fontSize: 16 },
  selectPlaceholder: { color: authTokens.colors.textMuted, fontSize: 16 },
  readOnlyField: { justifyContent: 'center', opacity: 0.92 },
  helpText: { color: authTokens.colors.textSecondary, fontSize: 12, lineHeight: 17, padding: 8 },
  menuAnchor: { position: 'relative', zIndex: 1 },
  optionList: { backgroundColor: '#031811', borderColor: authTokens.colors.border, borderRadius: 8, borderWidth: 1, maxHeight: 320, opacity: 1, overflow: 'hidden' },
  floatingMenu: { elevation: 64, zIndex: 10000 },
  inlineFloatingMenu: { left: 0, marginTop: 4, position: 'absolute', right: 0, top: '100%' },
  option: { backgroundColor: '#031811', borderBottomColor: authTokens.colors.borderSubtle, borderBottomWidth: 1, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12 },
  optionSelected: { backgroundColor: 'rgba(199,255,46,.12)' },
  optionText: { color: authTokens.colors.textPrimary, fontSize: 15 },
  optionCode: { color: authTokens.colors.textSecondary, fontSize: 11, marginTop: 2 },
  choice: { alignItems: 'center', borderColor: authTokens.colors.border, borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 14, minHeight: 58, padding: 14 },
  choiceSelected: { borderColor: authTokens.colors.primary, borderWidth: 2 },
  choicePressed: { backgroundColor: 'rgba(199,255,46,.08)' },
  choiceMark: { alignItems: 'center', borderColor: authTokens.colors.textSecondary, borderRadius: 5, borderWidth: 2, height: 28, justifyContent: 'center', width: 28 },
  choiceMarkSelected: { borderColor: authTokens.colors.primary },
  choiceTick: { color: authTokens.colors.primary, fontWeight: '900' },
  choiceCopy: { flex: 1 },
  choiceLabel: { color: authTokens.colors.textPrimary, fontSize: 16, fontWeight: '800' },
  choiceSupporting: { color: authTokens.colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 3 },
  notice: { alignItems: 'flex-start', borderTopColor: 'rgba(210,255,226,.25)', borderTopWidth: 1, flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 16 },
  noticeIcon: { color: authTokens.colors.textPrimary, fontSize: 24 },
  noticeText: { color: authTokens.colors.textSecondary, flex: 1, fontSize: 14, lineHeight: 21 },
  actions: { borderTopColor: 'rgba(210,255,226,.35)', borderTopWidth: 1, flexDirection: 'row', gap: 16, marginTop: 28, paddingTop: 22, position: 'relative', zIndex: 0 },
  mobileActions: { backgroundColor: 'rgba(2,20,14,.72)', marginHorizontal: -24, paddingHorizontal: 24 },
  secondaryButton: { alignItems: 'center', borderColor: 'rgba(228,255,236,.8)', borderRadius: 9, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 58, padding: 12 },
  secondaryText: { color: authTokens.colors.textPrimary, fontSize: 16, fontWeight: '800' },
  primaryButton: { alignItems: 'center', backgroundColor: authTokens.colors.primary, borderRadius: 9, flex: 1.25, flexDirection: 'row', justifyContent: 'center', minHeight: 58, padding: 12 },
  primaryPressed: { backgroundColor: authTokens.colors.primaryPressed },
  primaryText: { color: authTokens.colors.canvasDeep, flex: 1, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  arrow: { color: authTokens.colors.canvasDeep, fontSize: 28 },
  cardTitle: { color: authTokens.colors.textPrimary, fontSize: 22, fontWeight: '800' },
  evidenceRow: { alignItems: 'center', borderColor: authTokens.colors.borderSubtle, borderRadius: 9, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 70, padding: 12 },
  evidenceSelect: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12, minHeight: 44 },
  documentIcon: { alignItems: 'center', borderColor: authTokens.colors.border, borderRadius: 8, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 },
  documentIconClean: { backgroundColor: 'rgba(199,255,46,.12)', borderColor: authTokens.colors.primary },
  documentIconError: { borderColor: authTokens.colors.danger },
  documentGlyph: { color: authTokens.colors.textPrimary, fontSize: 24 },
  documentGlyphClean: { color: authTokens.colors.primary, fontWeight: '900' },
  evidenceLabel: { color: authTokens.colors.textPrimary, flex: 1, fontSize: 15, fontWeight: '700' },
  ready: { color: authTokens.colors.primary, fontSize: 12 },
  evidenceMissing: { color: authTokens.colors.textSecondary },
  evidenceError: { color: authTokens.colors.danger },
  removeEvidence: { alignItems: 'center', borderColor: authTokens.colors.borderSubtle, borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 44, minWidth: 44 },
  removeEvidenceGlyph: { color: authTokens.colors.danger, fontSize: 20 },
});
