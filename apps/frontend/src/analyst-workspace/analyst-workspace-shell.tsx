import type { PropsWithChildren } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { passportTheme } from '../passport/presentation/passport-theme';

type Destination = 'Inicio' | 'Pasaportes' | 'Partidos';
type Props = PropsWithChildren<Readonly<{ current: Destination; onNavigate?: (destination: Destination) => void;
  onLogout?: () => void; accountLabel?: string }>>;
const destinations: Destination[] = ['Inicio', 'Pasaportes', 'Partidos'];
const destinationIcons: Record<Destination, string> = { Inicio: '⌂', Pasaportes: '▤', Partidos: '▣' };

export function AnalystWorkspaceShell({ current, onNavigate, onLogout, accountLabel, children }: Props) {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const initials = accountLabel?.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'A';
  const nav = (destination: Destination) => <Pressable key={destination} accessibilityRole="button"
    accessibilityLabel={destination} accessibilityState={{ selected: current === destination }}
    aria-current={current === destination ? 'page' : undefined}
    onPress={() => onNavigate?.(destination)}
    style={[styles.navItem, desktop ? styles.desktopNavItem : styles.mobileNavItem, current === destination && styles.navSelected]}>
    <Text accessible={false} style={[styles.navIcon, desktop && styles.desktopNavIcon, current === destination && styles.navTextSelected]}>{destinationIcons[destination]}</Text>
    <Text style={[styles.navText, current === destination && styles.navTextSelected]}>{destination}</Text>
  </Pressable>;
  const logout = onLogout ? <Pressable accessibilityRole="button" accessibilityLabel="Cerrar sesión" onPress={onLogout}
    style={styles.logout}><Text style={styles.logoutText}>Cerrar sesión</Text></Pressable> : null;
  return <ImageBackground testID="analyst-workspace-background"
    source={require('../../assets/authentication/liquid-emerald-abstract-v1.png')} resizeMode="cover" style={styles.background}>
    <View pointerEvents="none" style={styles.scrim} />
    <SafeAreaView style={styles.safe}>
    <View style={[styles.frame, desktop && styles.frameDesktop]}>
      {desktop ? <View style={styles.sidebar}>
        <Text style={styles.brand}><Text style={styles.brandAccent}>NEW</Text> TALENTS</Text>
        <View role="navigation" accessibilityLabel="Navegación del Analista" style={styles.navColumn}>{destinations.map(nav)}</View>
        <View style={styles.sidebarFoot}>
          <View style={styles.account}><View accessible={false} style={styles.accountAvatar}><Text style={styles.accountInitials}>{initials}</Text></View>
            <Text style={styles.accountText}>{accountLabel || 'Analista'}</Text></View>
          {logout}
        </View>
      </View> : null}
      <View style={styles.main}>
        {!desktop ? <View style={styles.mobileHeader}><Text style={styles.mobileBrand}><Text style={styles.brandAccent}>NEW</Text> TALENTS</Text>
          <View style={styles.mobileAccount}><View accessible={false} style={styles.accountAvatar}><Text style={styles.accountInitials}>{initials}</Text></View>
            {logout}</View></View> : null}
        <ScrollView contentContainerStyle={[styles.content, desktop && styles.contentDesktop]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {!desktop ? <View role="navigation" accessibilityLabel="Navegación del Analista" style={styles.bottomNav}>{destinations.map(nav)}</View> : null}
      </View>
    </View>
    </SafeAreaView>
  </ImageBackground>;
}

const colors = passportTheme.colors;
const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#001a13' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 18, 12, .62)' },
  safe: { flex: 1 },
  frame: { flex: 1 }, frameDesktop: { flexDirection: 'row' },
  sidebar: { width: 236, backgroundColor: 'rgba(0, 25, 17, .72)', borderRightColor: colors.border, borderRightWidth: 1, paddingHorizontal: 18, paddingTop: 38 },
  brand: { color: colors.white, fontSize: 25, fontWeight: '900', marginBottom: 48 },
  mobileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingHorizontal: 20, paddingTop: 18 },
  mobileBrand: { color: colors.white, fontSize: 24, fontWeight: '900', flexShrink: 1 },
  mobileAccount: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandAccent: { color: colors.lime }, navColumn: { gap: 12 },
  sidebarFoot: { borderTopColor: colors.divider, borderTopWidth: 1, gap: 12, marginTop: 'auto', paddingBottom: 26, paddingTop: 16 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accountAvatar: { width: 34, height: 34, borderRadius: 17, borderColor: colors.border, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center' },
  accountInitials: { color: colors.white, fontSize: 13, fontWeight: '800' },
  accountText: { color: colors.white, fontSize: 14, flexShrink: 1 },
  logout: { minHeight: 44, borderColor: colors.border, borderWidth: 1, borderRadius: 9, outlineColor: colors.lime,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 9 },
  logoutText: { color: colors.lime, fontWeight: '700', fontSize: 13 },
  navItem: { borderColor: 'transparent', borderRadius: 12, borderWidth: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center', gap: 5, paddingHorizontal: 15, outlineColor: colors.lime },
  desktopNavItem: { flexDirection: 'row', justifyContent: 'flex-start' },
  mobileNavItem: { flex: 1, flexDirection: 'column', minHeight: 62, paddingHorizontal: 4 },
  navIcon: { color: colors.white, fontSize: 23, minWidth: 27, textAlign: 'center' },
  desktopNavIcon: { borderColor: colors.lime, borderWidth: 1, borderRadius: 22, width: 38, height: 38, textAlignVertical: 'center' },
  navSelected: { backgroundColor: '#064632', borderColor: colors.border },
  navText: { color: colors.white, fontSize: 17 }, navTextSelected: { color: colors.lime, fontWeight: '700' },
  main: { flex: 1, minWidth: 0 }, content: { flexGrow: 1, padding: 20, paddingBottom: 38 },
  contentDesktop: { maxWidth: 1330, width: '100%', alignSelf: 'center', padding: 32, paddingTop: 70 },
  bottomNav: { backgroundColor: 'rgba(0, 30, 20, .96)', borderTopColor: colors.border, borderTopWidth: 1,
    flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 8, paddingTop: 8 },
});
