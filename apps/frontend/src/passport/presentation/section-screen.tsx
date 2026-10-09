import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AuthAlert, AuthLoading } from '../../design/components/auth-primitives';
import { SessionControls } from '../../authentication/components/session-controls';
import { LiquidGlassPanel } from '../../design/components/liquid-glass-panel';
import { PASSPORT_NOTICE_MESSAGES, usePassportState } from '../passport-state';
import { PassportPresentationShell } from './passport-presentation-shell';
import { PassportLifecycleStatus } from './status';
import { PassportSectionContent } from './section-content';
import { PassportIcon } from './passport-icon';
import { passportScale, passportTheme } from './passport-theme';
import type { PassportSectionKey } from '../passport-types';
import { projectSectionAvailability, toPlayerIdentity } from './availability';

export function PassportSectionScreen({ sectionKey }: Readonly<{ sectionKey: PassportSectionKey }>) {
  const { passportId } = useLocalSearchParams<{ passportId?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { state } = usePassportState();
  const [sessionOpen, setSessionOpen] = useState(false);
  const presentation = state.presentation;
  const section = projectSectionAvailability(presentation, sectionKey);
  const loading = !presentation && (state.phase === 'loading' || state.phase === 'idle');
  const scale = passportScale(width);
  const desktop = width >= 1024;
  const capabilities = state.status?.availableActions ?? [];
  if (!passportId) return null;

  function navigate(key: PassportSectionKey) { router.push(`/passports/${passportId}/sections/${key}` as never); }

  return (
    <PassportPresentationShell activeKey={sectionKey} loading={loading} onSelect={navigate} player={toPlayerIdentity(presentation?.identity)} status={presentation?.lifecycleState ?? null}>
      {loading ? <AuthLoading label="Cargando pasaporte" /> : state.notice && !presentation ? <AuthAlert variant="warning" message={PASSPORT_NOTICE_MESSAGES[state.notice]} /> : (
        <>
          <PassportSectionContent sectionKey={sectionKey} availability={section.availability} message={section.message} desktop={desktop} scale={desktop ? scale : scale * (sectionKey === 'estadisticas' ? 0.78 : 0.86)} />
          {sectionKey === 'videos' ? <Pressable accessibilityRole="button" accessibilityLabel="Volver al resumen" onPress={() => { navigate('resumen'); }} style={[styles.backLink, { padding: 9 * scale }]}><PassportIcon name="back" size={20 * scale} color={passportTheme.colors.lime} /><Text style={[styles.linkText, { fontSize: 12 * scale }]}>Volver al resumen</Text></Pressable> : null}
        </>
      )}
      <View style={[styles.secondaryCycle, { gap: 10 * scale, marginTop: 4 * scale }]}>
        <PassportLifecycleStatus loading={loading} notice={state.notice} status={presentation?.lifecycleState ?? null} />
        <View style={styles.secondaryActions}>
          {capabilities.some(action => action === 'VIEW_HISTORY' || action === 'VIEW_INTERNAL_HISTORY') ? <Pressable accessibilityRole="button" accessibilityLabel="Estado e historial" onPress={() => { router.push(`/passports/${passportId}` as never); }} style={styles.secondaryButton}><PassportIcon name="history" size={18} /><Text style={styles.secondaryText}>Estado e historial</Text></Pressable> : null}
          {capabilities.includes('EDIT') ? <Pressable accessibilityRole="button" onPress={() => { router.push(`/passports/${passportId}/edit` as never); }} style={styles.secondaryButton}><Text style={styles.secondaryText}>Completar perfil</Text></Pressable> : null}
          {capabilities.some(action => ['APPROVE', 'RETURN', 'RESOLVE_DUPLICATE'].includes(action)) ? <Pressable accessibilityRole="button" onPress={() => { router.push(`/passports/${passportId}/review` as never); }} style={styles.secondaryButton}><Text style={styles.secondaryText}>Revisar pasaporte</Text></Pressable> : null}
          {capabilities.includes('ACTIVATE') ? <Pressable accessibilityRole="button" onPress={() => { router.push(`/passports/${passportId}/activate` as never); }} style={styles.secondaryButton}><Text style={styles.secondaryText}>Activar manualmente</Text></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Opciones de sesión" accessibilityState={{ expanded: sessionOpen }} onPress={() => { setSessionOpen(open => !open); }} style={styles.secondaryButton}><PassportIcon name="more" size={20} /><Text style={styles.secondaryText}>Sesión</Text></Pressable>
        </View>
      </View>
      {sessionOpen ? <LiquidGlassPanel style={styles.sessionPanel}><SessionControls /></LiquidGlassPanel> : null}
    </PassportPresentationShell>
  );
}

const styles = StyleSheet.create({
  secondaryCycle: { borderTopWidth: 1, borderTopColor: passportTheme.colors.divider, paddingTop: 12 },
  secondaryActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 18, rowGap: 4 },
  secondaryButton: { minHeight: 44, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8 },
  secondaryText: { color: passportTheme.colors.secondary, fontFamily: passportTheme.fontFamily, fontSize: 13 },
  backLink: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 10, minHeight: 44 },
  linkText: { color: passportTheme.colors.lime, fontFamily: passportTheme.fontFamily },
  sessionPanel: { padding: 20 },
});
