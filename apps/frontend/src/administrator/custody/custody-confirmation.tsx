import { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { LiquidGlassPanel } from '../../design/components/liquid-glass-panel';
import { hasCustodyConfirmationIntent, type CustodyConfirmationSnapshot } from './custody-confirmation-state';

export function CustodyConfirmation({ snapshot, onReason, onCancel, onConfirm, onReturnFocus, mobile = false }: Readonly<{
  snapshot: CustodyConfirmationSnapshot;
  onReason: (reason: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  onReturnFocus?: () => void;
  mobile?: boolean;
}>) {
  const titleRef = useRef<Text>(null);
  const reasonRef = useRef<TextInput>(null);
  const visible = hasCustodyConfirmationIntent(snapshot) && snapshot.stage !== 'applied';
  const reasonRequired = visible && snapshot.action !== 'ASSIGN';
  const reasonError = reasonRequired && 'reasonError' in snapshot ? snapshot.reasonError : undefined;
  useEffect(() => {
    if (!visible) return;
    if (reasonError) reasonRef.current?.focus();
    else (titleRef.current as unknown as { focus?: () => void } | null)?.focus?.();
  }, [reasonError, visible]);
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { onCancel(); onReturnFocus?.(); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onCancel, onReturnFocus, visible]);
  if (!hasCustodyConfirmationIntent(snapshot) || snapshot.stage === 'applied') return null;

  const cancel = () => { onCancel(); onReturnFocus?.(); };
  const onKeyDown = (event: Readonly<{ key?: string; nativeEvent?: Readonly<{ key?: string }> }>) => {
    if ((event.key ?? event.nativeEvent?.key) === 'Escape') cancel();
  };
  const busy = snapshot.stage === 'submitting';
  const actionLabel = snapshot.action === 'ASSIGN' ? 'asignación' : snapshot.action === 'CHANGE' ? 'cambio' : 'retiro';
  const actionArticle = snapshot.action === 'ASSIGN' ? 'la' : 'el';
  const reasonHint = reasonError === 'too-long' ? 'El motivo no puede superar 500 caracteres.' : reasonError ? 'El motivo es obligatorio.' : `Explica brevemente ${actionArticle} ${actionLabel}.`;

  return <View testID="custody-confirmation-backdrop" style={[styles.backdrop, mobile && styles.mobileBackdrop]} accessibilityViewIsModal>
    <LiquidGlassPanel testID="custody-confirmation-surface" style={[styles.surface, mobile && styles.mobileSurface]} {...({ onKeyDown } as object)}>
      <View style={styles.titleRow}><Text ref={titleRef} {...({ tabIndex: -1 } as object)} accessibilityRole="header" style={styles.title}>Confirmar custodia</Text><Pressable accessibilityRole="button" accessibilityLabel="Cerrar confirmación" onPress={cancel} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>
      <Detail label="Pasaporte" value={`PAS-${snapshot.passport.passportId.toUpperCase()} · ${snapshot.passport.displayLabel}`} />
      <Detail label="Analista actual" value={snapshot.passport.custody.state === 'ASSIGNED' ? snapshot.passport.custody.analyst.displayLabel : 'Sin asignar'} />
      {'analyst' in snapshot ? <Detail label="Analista seleccionado" value={snapshot.analyst.displayLabel} selected /> : null}
      {reasonRequired ? <>
        <View style={styles.rule} />
        <Text style={styles.label}>Motivo</Text>
        <TextInput
        ref={reasonRef}
        accessibilityLabel="Motivo obligatorio"
        accessibilityHint={reasonHint}
        autoFocus={Boolean(reasonError)}
        editable={!busy}
        maxLength={501}
        onChangeText={onReason}
        onKeyPress={(event) => { if (event.nativeEvent.key === 'Escape') cancel(); }}
        placeholder="Distribución inicial de carga"
        placeholderTextColor="#8ea79a"
        style={[styles.input, reasonError && styles.inputError]}
        value={'reason' in snapshot ? snapshot.reason : ''}
        />
      </> : null}
      {reasonError ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{reasonError === 'too-long' ? 'El motivo no puede superar 500 caracteres.' : 'Escribe un motivo antes de confirmar.'}</Text> : <Text style={styles.help}>{actionArticle === 'la' ? 'La' : 'El'} {actionLabel} se guardará solo al confirmar.</Text>}
      {snapshot.stage === 'recoverable-error' ? <Text accessibilityLiveRegion="polite" style={styles.warning}>No pudimos guardar. Puedes reintentar de forma segura.</Text> : null}
      {snapshot.stage === 'conflict' ? <Text accessibilityLiveRegion="assertive" style={styles.warning}>{snapshot.conflictKind === 'idempotency' ? 'La clave ya pertenece a otra intención. Revisa el estado antes de volver a seleccionar.' : 'La custodia cambió. Actualiza antes de volver a seleccionar.'}</Text> : null}
      <View style={[styles.actions, mobile && styles.mobileActions]}><Pressable accessibilityRole="button" disabled={busy} onPress={cancel} style={styles.cancel}><Text style={styles.cancelText}>Cancelar</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Confirmar ${actionLabel}`} accessibilityState={{ disabled: busy }} disabled={busy} onPress={onConfirm} style={styles.confirm}><Text style={styles.confirmText}>{busy ? 'Confirmando…' : `Confirmar ${actionLabel}  →`}</Text></Pressable></View>
    </LiquidGlassPanel>
  </View>;
}

function Detail({ label, value, selected = false }: Readonly<{ label: string; value: string; selected?: boolean }>) {
  return <View style={styles.detail}><Text style={[styles.marker, selected && styles.selectedMarker]}>{selected ? '→' : '○'}</Text><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, alignItems: 'flex-end', backgroundColor: 'rgba(0,10,7,.42)', justifyContent: 'flex-end', padding: 64, paddingRight: '14%', zIndex: 20 },
  mobileBackdrop: { alignItems: 'stretch', justifyContent: 'flex-end', padding: 0, paddingRight: 0 },
  surface: { borderColor: '#7ff2b1', gap: 12, maxWidth: 500, padding: 24, width: '100%' },
  mobileSurface: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, maxWidth: undefined, padding: 20 },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, title: { color: '#f8f8f2', fontSize: 27, fontWeight: '900' }, close: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 }, closeText: { color: '#eef6ef', fontSize: 34, fontWeight: '300' },
  detail: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 32 }, marker: { color: '#d7e6db', fontSize: 21, textAlign: 'center', width: 25 }, selectedMarker: { color: '#d6ff19' }, detailLabel: { color: '#b7c8be', fontSize: 12, width: 126 }, detailValue: { color: '#f7f8f2', flex: 1, fontSize: 14, fontWeight: '800' },
  rule: { backgroundColor: 'rgba(190,236,207,.35)', height: 1 }, label: { color: '#dce9e0', fontSize: 12, fontWeight: '800' }, input: { backgroundColor: 'rgba(0,18,12,.8)', borderColor: '#83caa4', borderRadius: 8, borderWidth: 1, color: '#fff', minHeight: 48, paddingHorizontal: 13 }, inputError: { borderColor: '#ff8992', borderWidth: 2 }, help: { color: '#b8c8be', fontSize: 11 }, error: { color: '#ffb0b6', fontSize: 12, fontWeight: '800' }, warning: { color: '#ffe59a', fontSize: 12, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 }, mobileActions: { gap: 8 }, cancel: { alignItems: 'center', borderColor: '#d7e8dd', borderRadius: 8, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 50 }, cancelText: { color: '#f7f8f2', fontWeight: '800' }, confirm: { alignItems: 'center', backgroundColor: '#d6ff19', borderRadius: 8, flex: 1.35, justifyContent: 'center', minHeight: 50, paddingHorizontal: 12 }, confirmText: { color: '#06120c', fontWeight: '900' },
});
