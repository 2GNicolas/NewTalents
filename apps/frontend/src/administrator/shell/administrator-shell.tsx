import type { ReactNode } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { authTokens } from '../../design/tokens';

export type AdministratorDestination = 'home' | 'requests' | 'dossiers' | 'passports' | 'custody';
export const administratorDestinationPath = (destination: AdministratorDestination): string => ({ home: '/admin', requests: '/admin/registration', dossiers: '/admin/dossiers', passports: '/admin/passports', custody: '/admin/custody' })[destination];
const destinations: readonly Readonly<{ id: AdministratorDestination; label: string; icon: string }>[] = [
  { id: 'home', label: 'Inicio', icon: '⌂' },
  { id: 'requests', label: 'Solicitudes', icon: '▤' },
  { id: 'dossiers', label: 'Expedientes', icon: '□' },
  { id: 'passports', label: 'Pasaportes', icon: '▣' },
  { id: 'custody', label: 'Custodia', icon: '♢' },
];
const administratorTypeface = { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' } as unknown as ViewStyle;
export const administratorRouteBackgroundStyle = { backgroundColor: '#02110b', flex: 1, minHeight: '100vh' as unknown as number, width: '100%' } as const;

export function AdministratorShell({ active, onNavigate, onLogout, children, previewMode }: Readonly<{
  active: AdministratorDestination;
  onNavigate: (destination: AdministratorDestination) => void;
  onLogout: () => void;
  children: ReactNode;
  previewMode?: 'desktop' | 'mobile';
}>) {
  const dimensions = useWindowDimensions();
  const desktop = previewMode ? previewMode === 'desktop' : dimensions.width >= authTokens.breakpoints.desktop;
  return <ImageBackground testID="administrator-shell-background" source={require('../../../assets/authentication/liquid-emerald-abstract-v1.png')} resizeMode="cover" imageStyle={styles.backgroundImage} style={[styles.background, administratorRouteBackgroundStyle]}>
    <View pointerEvents="none" style={styles.scrim} />
    <View testID="administrator-shell-frame" style={[styles.frame, administratorTypeface, desktop ? styles.frameDesktop : styles.frameMobile, previewMode === 'mobile' && styles.mobilePreview]}>
      {desktop ? <View testID="administrator-sidebar" style={styles.sidebar}>
        <Brand />
        <View style={styles.navRail}>{destinations.map((destination) => <NavItem key={destination.id} destination={destination} active={active === destination.id} onPress={() => onNavigate(destination.id)} desktop />)}</View>
        <View style={styles.account}><View style={styles.accountIdentity}><Text style={styles.accountIcon}>◎</Text><Text style={styles.accountText}>Administrador</Text></View><LogoutAction onPress={onLogout} /></View>
      </View> : null}
      <View style={styles.content}>{!desktop ? <View style={styles.mobileHeader}><Brand compact /><LogoutAction onPress={onLogout} compact /></View> : null}{children}</View>
      {!desktop ? <View testID="administrator-bottom-navigation" accessibilityRole="tablist" style={styles.bottomNavigation}>{destinations.map((destination) => <NavItem key={destination.id} destination={destination} active={active === destination.id} onPress={() => onNavigate(destination.id)} />)}</View> : null}
    </View>
  </ImageBackground>;
}

function LogoutAction({ onPress, compact = false }: Readonly<{ onPress: () => void; compact?: boolean }>) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Cerrar sesión" onPress={onPress} style={[styles.logout, compact && styles.logoutCompact]}><Text style={styles.logoutText}>Cerrar sesión</Text></Pressable>;
}

function Brand({ compact = false }: Readonly<{ compact?: boolean }>) {
  return <Text accessibilityRole="header" style={[styles.brand, compact && styles.brandCompact]}><Text style={styles.brandLime}>NEW</Text> TALENTS</Text>;
}

function NavItem({ destination, active, onPress, desktop = false }: Readonly<{
  destination: Readonly<{ id: AdministratorDestination; label: string; icon: string }>;
  active: boolean;
  onPress: () => void;
  desktop?: boolean;
}>) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={destination.label} onPress={onPress} style={[styles.navItem, desktop ? styles.navItemDesktop : styles.navItemMobile, active && styles.navItemActive]}>
    <Text style={[styles.navIcon, active && styles.navTextActive]}>{destination.icon}</Text><Text style={[styles.navText, !desktop && styles.navTextMobile, active && styles.navTextActive]}>{destination.label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  background: { backgroundColor: '#02110b', flex: 1, width: '100%' },
  backgroundImage: { height: '100%', width: '100%' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 15, 10, 0.52)' },
  frame: { flex: 1, minHeight: '100%' }, frameDesktop: { flexDirection: 'row' }, frameMobile: { paddingBottom: 70 }, mobilePreview: { alignSelf: 'flex-start', maxWidth: 390, minHeight: 844, width: '100%' },
  sidebar: { backgroundColor: 'rgba(0, 24, 17, .48)', borderRightColor: 'rgba(111, 255, 166, .28)', borderRightWidth: 1, height: '100vh' as unknown as number, paddingHorizontal: 34, paddingVertical: 42, position: 'sticky' as unknown as 'relative', top: 0, width: 260 },
  brand: { color: '#f6f8ef', fontSize: 27, fontStyle: 'italic', fontWeight: '900', letterSpacing: -1 }, brandCompact: { fontSize: 18 }, brandLime: { color: '#caff24' },
  navRail: { gap: 10, marginLeft: -34, marginRight: -18, marginTop: 58 },
  navItem: { alignItems: 'center', minHeight: 48 }, navItemDesktop: { borderColor: 'transparent', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 14, paddingHorizontal: 34, paddingVertical: 12 }, navItemMobile: { flex: 1, gap: 2, justifyContent: 'center', paddingHorizontal: 4 },
  navItemActive: { backgroundColor: 'rgba(42, 255, 123, .11)', borderColor: '#8aff9c' }, navIcon: { color: '#f5f7ef', fontSize: 23 }, navText: { color: '#f5f7ef', fontSize: 15 }, navTextMobile: { fontSize: 11, textAlign: 'center' }, navTextActive: { color: '#d6ff19', fontWeight: '800' },
  account: { alignItems: 'stretch', borderTopColor: 'rgba(210,255,226,.32)', borderTopWidth: 1, gap: 12, marginTop: 'auto', paddingTop: 18 }, accountIdentity: { alignItems: 'center', flexDirection: 'row', gap: 12 }, accountIcon: { color: '#f5f7ef', fontSize: 30 }, accountText: { color: '#f5f7ef', fontSize: 15 },
  logout: { alignItems: 'center', borderColor: 'rgba(214,255,25,.72)', borderRadius: 9, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 }, logoutCompact: { minWidth: 112 }, logoutText: { color: '#eaff8b', fontSize: 13, fontWeight: '800' },
  content: { flex: 1, minWidth: 0 }, mobileHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 18 },
  bottomNavigation: { backgroundColor: 'rgba(1, 28, 19, .96)', borderColor: 'rgba(111,255,166,.34)', borderRadius: 22, borderWidth: 1, bottom: 0, flexDirection: 'row', left: 0, minHeight: 68, paddingHorizontal: 8, position: 'absolute', right: 0 },
});
