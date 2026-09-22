import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthAlert, AuthButton, AuthLoading } from '../../../src/design/components/auth-primitives';
import { LiquidGlassPanel } from '../../../src/design/components/liquid-glass-panel';
import { SessionControls } from '../../../src/authentication/components/session-controls';
import { PASSPORT_NOTICE_MESSAGES, usePassportState } from '../../../src/passport/passport-state';
import { LIFECYCLE_STATE_LABELS, type PassportListContext } from '../../../src/passport/passport-types';
import { passportTheme } from '../../../src/passport/presentation/passport-theme';

export default function PassportEntryRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ context?: string; academyId?: string }>();
  const passport = usePassportState();
  const redirected = useRef(false);
  const requested = useMemo(() => {
    const context: PassportListContext = params.context === 'ACADEMY' ? 'ACADEMY' : 'PARTICULAR';
    return context === 'ACADEMY' ? { context, academyId: params.academyId } as const : { context } as const;
  }, [params.academyId, params.context]);
  useEffect(() => { redirected.current = false; void passport.loadList(requested); }, [passport.loadList, requested]);
  const ready = passport.state.phase === 'ready' && passport.state.list !== null && passport.state.context === requested.context;
  useEffect(() => {
    if (!ready || redirected.current || requested.context !== 'PARTICULAR' || passport.state.list?.length !== 1) return;
    redirected.current = true;
    router.replace(`/passports/${passport.state.list[0]!.passportId}/sections/resumen` as never);
  }, [passport.state.list, ready, requested.context, router]);
  if (!ready && (passport.state.phase === 'idle' || passport.state.phase === 'loading')) return <AuthLoading label="Cargando pasaportes" />;
  const list = passport.state.list ?? [];
  const academyName = list.find(item => item.academyOriginName)?.academyOriginName ?? 'academia';
  const title = requested.context === 'ACADEMY' ? `Cartera de ${academyName}` : list.length > 1 ? 'Selecciona un jugador' : 'Tus pasaportes';
  const createActions = passport.state.collectionActions ?? [];
  return <View style={styles.screen}>
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    {passport.state.notice ? <AuthAlert variant="warning" message={PASSPORT_NOTICE_MESSAGES[passport.state.notice]} /> : null}
    <View style={styles.actions}>
      {createActions.includes('CREATE_SELF') ? <AuthButton label="Crear mi pasaporte" onPress={() => router.push('/passports/new?managementContext=SELF' as never)} /> : null}
      {createActions.includes('CREATE_REPRESENTED_MINOR') ? <AuthButton label="Crear para un menor" variant="secondary" onPress={() => router.push('/passports/new?managementContext=LEGAL_REPRESENTATIVE' as never)} /> : null}
      {createActions.includes('CREATE_ACADEMY') && requested.context === 'ACADEMY' ? <AuthButton label="Crear en academia" onPress={() => router.push(`/passports/new?managementContext=ACADEMY&academyId=${encodeURIComponent(requested.academyId ?? '')}` as never)} /> : null}
    </View>
    {list.length === 0 ? <LiquidGlassPanel style={styles.empty}><Text style={styles.secondary}>No hay pasaportes accesibles en este contexto.</Text></LiquidGlassPanel> : null}
    {list.length > 0 && !(requested.context === 'PARTICULAR' && list.length === 1) ? <View style={styles.list}>{list.map(item => <Pressable key={item.passportId} accessibilityRole="button" accessibilityLabel={`Abrir pasaporte de ${item.displayName}`} onPress={() => router.push(`/passports/${item.passportId}/sections/resumen` as never)} style={styles.row}>
      <Text style={styles.name}>{item.displayName}</Text><Text style={styles.state}>{LIFECYCLE_STATE_LABELS[item.lifecycleState]}</Text>{item.academyOriginName ? <Text style={styles.secondary}>{item.academyOriginName}</Text> : null}
    </Pressable>)}</View> : null}
    <SessionControls />
  </View>;
}
const styles = StyleSheet.create({ screen: { backgroundColor: passportTheme.colors.canvas, flex: 1, gap: 18, padding: 24, width: '100%' }, title: { color: passportTheme.colors.white, fontFamily: passportTheme.fontFamily, fontSize: 28, fontWeight: '700' }, actions: { gap: 10 }, list: { gap: 12 }, row: { backgroundColor: passportTheme.colors.glass, borderColor: passportTheme.colors.border, borderRadius: 16, borderWidth: 1, minHeight: 76, justifyContent: 'center', padding: 18 }, name: { color: passportTheme.colors.white, fontSize: 18, fontWeight: '700' }, state: { color: passportTheme.colors.lime, marginTop: 4 }, secondary: { color: passportTheme.colors.secondary }, empty: { padding: 20 } });
