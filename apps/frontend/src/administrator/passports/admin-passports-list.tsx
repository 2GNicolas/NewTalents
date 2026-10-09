import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { LiquidGlassPanel } from '../../design/components/liquid-glass-panel';
import { authTokens } from '../../design/tokens';
import type { AdminPassportCard } from '../administrator-api';
import type { PassportViewState } from './admin-passports-state';

export function AdminPassportsList({ items, state, page, canGoPrevious, canGoNext, onOpen, onRetry, onNext, onPrevious, previewMode }: Readonly<{
  items: readonly AdminPassportCard[]; state: PassportViewState; page: number; canGoPrevious: boolean; canGoNext: boolean;
  onOpen: (id: string) => void; onRetry: () => void; onNext: () => void; onPrevious: () => void; previewMode?: 'desktop' | 'mobile';
}>) {
  const dimensions = useWindowDimensions();
  const desktop = previewMode ? previewMode === 'desktop' : dimensions.width >= authTokens.breakpoints.desktop;
  return <ScrollView accessibilityLabel="Pasaportes" contentContainerStyle={[styles.page, !desktop && styles.mobile]}>
    <Text accessibilityRole="header" style={[styles.title, !desktop && styles.mobileTitle]}>Pasaportes</Text>
    <Text style={styles.subtitle}>Todos los pasaportes · Configuración administrativa</Text>
    {state === 'ready' ? <View style={styles.grid}>{items.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Abrir pasaporte de ${item.playerLabel}`} onPress={() => onOpen(item.id)} style={[styles.cardWrap, desktop && styles.cardDesktop]}>
      <LiquidGlassPanel style={styles.card}><Text style={styles.name}>{item.playerLabel}</Text><Text style={styles.reference}>Pasaporte: {item.maskedReference}</Text><Text style={styles.status}>Estado: {item.state === 'ACTIVE' ? 'Activo' : item.state}</Text><Text style={styles.mode}>{item.canConfigure ? 'Configurable' : 'Solo consulta'}</Text></LiquidGlassPanel>
    </Pressable>)}</View> : <LiquidGlassPanel style={styles.state}><Text accessibilityRole="alert" style={styles.stateText}>{stateCopy(state)}</Text>{state === 'unavailable' || state === 'error' ? <Action label="Reintentar" onPress={onRetry} /> : null}</LiquidGlassPanel>}
    {state === 'ready' ? <View style={styles.pagination}><Text style={styles.pageLabel}>Página {page + 1}</Text><Action label="Anterior" disabled={!canGoPrevious} onPress={onPrevious} /><Action label="Siguiente" disabled={!canGoNext} onPress={onNext} /></View> : null}
  </ScrollView>;
}

function stateCopy(state: PassportViewState) {
  return state === 'loading' || state === 'idle' ? 'Cargando pasaportes…' : state === 'empty' ? 'Aún no hay pasaportes.' : state === 'restricted' ? 'No tienes acceso a Pasaportes.' : state === 'unavailable' ? 'Pasaportes no está disponible en este momento.' : 'No pudimos cargar Pasaportes.';
}
function Action({ label, onPress, disabled = false }: Readonly<{ label: string; onPress: () => void; disabled?: boolean }>) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({
  page: { alignSelf: 'center', gap: 14, maxWidth: 1160, padding: 28, paddingBottom: 55, width: '100%' }, mobile: { padding: 14 },
  title: { color: '#f7f8f2', fontSize: 46, fontWeight: '900' }, mobileTitle: { fontSize: 32 }, subtitle: { color: '#c6d2cb', fontSize: 17 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, cardWrap: { width: '100%' }, cardDesktop: { width: '48%' }, card: { gap: 8, minHeight: 150, padding: 20 },
  name: { color: '#f7f8f2', fontSize: 22, fontWeight: '900' }, reference: { color: '#d0ddd3' }, status: { color: '#d6ff19', fontWeight: '800' }, mode: { color: '#aebfb5', fontSize: 12 },
  state: { alignItems: 'center', gap: 15, justifyContent: 'center', minHeight: 250, padding: 25 }, stateText: { color: '#f7f8f2', fontSize: 17, textAlign: 'center' },
  pagination: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 9, justifyContent: 'flex-end' }, pageLabel: { color: '#d0ddd3', marginRight: 'auto' },
  button: { alignItems: 'center', borderColor: '#a6d6b4', borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 48, minWidth: 100, paddingHorizontal: 14 }, buttonText: { color: '#f7f8f2', fontWeight: '800' }, disabled: { opacity: .4 },
});
