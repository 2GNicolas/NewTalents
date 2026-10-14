import type { ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { AuthenticationBrand } from '../design/components/authentication-brand';

export const firstMatchColors = {
  lime: '#A5FF00', white: '#F5F8F6', muted: '#B8CAC8',
  border: 'rgba(128, 221, 181, 0.48)', glass: 'rgba(0, 28, 23, 0.77)',
  field: 'rgba(0, 14, 13, 0.75)',
} as const;

export function FirstMatchSurface({ children, screen, viewportWidth }: { children: ReactNode; screen: 'invitation' | 'form' | 'waiting' | 'status'; viewportWidth?: number }) {
  const { width } = useWindowDimensions();
  const desktop = (viewportWidth ?? width) >= 1024;
  return <View style={styles.page} testID={`first-match-${screen}-${desktop ? 'desktop' : 'mobile'}`}>
    <Image source={require('../../assets/authentication/liquid-emerald-abstract-v1.png')}
      resizeMode="cover" accessible={false} style={styles.background} />
    <View style={styles.tint} pointerEvents="none" />
    <ScrollView contentContainerStyle={[styles.scroll, desktop ? styles.scrollDesktop : styles.scrollMobile]}
      keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={[styles.panel, desktop ? styles.panelDesktop : styles.panelMobile]}>
        <AuthenticationBrand variant="visual" style={styles.brand} />
        {children}
      </View>
    </ScrollView>
  </View>;
}

/** Decorative calendar and football evoke the approved art without embedding its illustrative text. */
export function FirstMatchHero({ screen = 'invitation', viewportWidth }: { screen?: 'invitation' | 'form' | 'waiting'; viewportWidth?: number }) {
  const { width } = useWindowDimensions();
  const desktop = (viewportWidth ?? width) >= 1024;
  const source = screen === 'waiting'
    ? desktop ? require('../../../../docs/design/feature-009/first-match-waiting-desktop.png')
      : require('../../../../docs/design/feature-009/first-match-waiting-mobile.png')
    : screen === 'invitation'
    ? desktop ? require('../../../../docs/design/feature-009/first-match-invitation-desktop.png')
      : require('../../../../docs/design/feature-009/first-match-invitation-mobile.png')
    : require('../../../../docs/design/feature-009/first-match-scheduling-mobile.png');
  return <View accessible={false} style={[styles.heroCrop, desktop ? styles.heroCropDesktop : screen === 'form' ? styles.heroCropFormMobile : styles.heroCropMobile]} testID="first-match-hero">
    <Image source={source} accessible={false} resizeMode="stretch"
      style={[styles.heroImage, desktop ? styles.heroImageDesktop : screen === 'form' ? styles.heroImageFormMobile : styles.heroImageInvitationMobile]} />
  </View>;
}

export function FirstMatchTitle({ prefix, accent }: { prefix: string; accent: string }) {
  return <Text accessibilityRole="header" style={styles.title}>{prefix}<Text style={styles.accent}>{accent}</Text></Text>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#00150F', flex: 1, minHeight: '100%', width: '100%' },
  background: { height: '100%', position: 'absolute', width: '100%' },
  tint: { backgroundColor: 'rgba(0, 25, 18, 0.45)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  scroll: { alignItems: 'center', flexGrow: 1, justifyContent: 'center', width: '100%' },
  scrollDesktop: { padding: 32 }, scrollMobile: { paddingBottom: 42, paddingHorizontal: 16, paddingTop: 32 },
  panel: { alignItems: 'center', borderColor: firstMatchColors.border, borderRadius: 18, borderWidth: 1,
    backgroundColor: firstMatchColors.glass, gap: 16, maxWidth: 1200, width: '100%' },
  panelDesktop: { paddingHorizontal: 38, paddingVertical: 30 },
  panelMobile: { paddingHorizontal: 20, paddingVertical: 28 },
  brand: { alignItems: 'center', marginBottom: 4 },
  heroCrop: { alignSelf: 'center', marginVertical: 8, overflow: 'hidden', position: 'relative', width: '100%' },
  heroCropDesktop: { height: 250, maxWidth: 660 },
  heroCropMobile: { height: 220, maxWidth: 360 },
  heroCropFormMobile: { height: 175, maxWidth: 360 },
  heroImage: { position: 'absolute' },
  heroImageDesktop: { height: 952, left: -340, top: -203, width: 1340 },
  heroImageInvitationMobile: { height: 1106, left: -82, top: -192, width: 512 },
  // Crop between the PNG's own logo and heading; only the calendar/football art remains.
  heroImageFormMobile: { height: 1106, left: -82, top: -105, width: 512 },
  title: { color: firstMatchColors.white, fontSize: 38, fontWeight: '800', textAlign: 'center' },
  accent: { color: firstMatchColors.lime },
});
