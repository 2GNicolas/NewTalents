import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { PUBLIC_REGISTRATION_CTA } from '../src/authentication/public-entry-policy';
import { AuthenticationBrand } from '../src/design/components/authentication-brand';
import { LiquidGlassPanel } from '../src/design/components/liquid-glass-panel';
import { authTokens } from '../src/design/tokens';

export default function RuntimeEntry() {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const wide = width >= authTokens.breakpoints.tablet;
  const [primaryFocused, setPrimaryFocused] = useState(false);
  const [loginFocused, setLoginFocused] = useState(false);

  return (
    <View accessibilityLabel="New Talents" style={[styles.page, publicEntryViewportStyle(width, height)]} testID="public-entry-page">
      <View pointerEvents="none" style={fixedViewportBackground(Platform.OS)} testID="public-entry-fixed-background">
        <View style={[StyleSheet.absoluteFill, styles.backgroundFallback, webBackgroundGradient]} />
        <Image source={require('../assets/authentication/liquid-emerald-abstract-v1.png')} resizeMode="cover" style={[StyleSheet.absoluteFill, styles.backgroundImage]} testID="public-entry-background-image" />
        <View style={styles.scrim} />
      </View>
      <View style={[styles.content, wide && styles.contentWide]}>
        <AuthenticationBrand variant="form" style={styles.brand} />
        <LiquidGlassPanel style={[styles.panel, wide && styles.panelWide]}>
          <Text accessibilityRole="header" style={[styles.title, wide && styles.titleWide]}>Tu talento merece ser visto.</Text>
          <Text style={styles.message}>Inicia una solicitud segura para crear tu acceso o registrar una academia.</Text>
          <Pressable accessibilityLabel={PUBLIC_REGISTRATION_CTA} accessibilityRole="button" onBlur={() => setPrimaryFocused(false)} onFocus={() => setPrimaryFocused(true)} onPress={() => router.push('/(public)/registration' as never)} style={({ pressed }) => [styles.primaryAction, primaryFocused && styles.focused, pressed && styles.pressed]} testID="public-registration-cta">
            <Text style={styles.primaryActionText}>{PUBLIC_REGISTRATION_CTA}</Text>
            <Text accessibilityElementsHidden style={styles.arrow}>→</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onBlur={() => setLoginFocused(false)} onFocus={() => setLoginFocused(true)} onPress={() => router.push('/(auth)/login')} style={[styles.loginLink, loginFocused && styles.linkFocused]}>
            <Text style={styles.loginText}>Ya tengo acceso · Iniciar sesión</Text>
          </Pressable>
        </LiquidGlassPanel>
      </View>
    </View>
  );
}

export function fixedViewportBackground(platform: typeof Platform.OS): ViewStyle {
  const fill: ViewStyle = { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 };
  return platform === 'web' ? ({ ...fill, position: 'fixed' } as unknown as ViewStyle) : fill;
}

export function publicEntryViewportStyle(width: number, height: number): ViewStyle {
  return { minHeight: height, minWidth: width };
}

const webBackgroundGradient = Platform.OS === 'web'
  ? ({ backgroundImage: 'linear-gradient(145deg, #062418 0%, #03110c 58%, #010705 100%)' } as unknown as ViewStyle)
  : {};

const styles = StyleSheet.create({
  page: { backgroundColor: authTokens.colors.canvasDeep, flex: 1, overflow: 'hidden', position: 'relative', width: '100%' },
  backgroundImage: { height: '100%', width: '100%' },
  backgroundFallback: { backgroundColor: authTokens.colors.canvasDeep },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(1, 8, 5, 0.48)' },
  content: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 32, zIndex: 1 },
  contentWide: { alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: '8%' },
  brand: { alignSelf: 'flex-start' },
  panel: { gap: 20, marginTop: 72, padding: 24, width: '100%' },
  panelWide: { maxWidth: 650, padding: 44 },
  title: { color: authTokens.colors.textPrimary, fontSize: 38, fontWeight: '800', letterSpacing: -1.1, lineHeight: 43 },
  titleWide: { fontSize: 56, lineHeight: 61 },
  message: { color: authTokens.colors.textSecondary, fontSize: 17, lineHeight: 26, maxWidth: 520 },
  primaryAction: { alignItems: 'center', backgroundColor: authTokens.colors.primary, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', minHeight: 54, paddingHorizontal: 18 },
  focused: { borderColor: '#FFFFFF', borderWidth: 2 },
  pressed: { backgroundColor: authTokens.colors.primaryPressed },
  primaryActionText: { color: authTokens.colors.canvasDeep, flex: 1, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  arrow: { color: authTokens.colors.canvasDeep, fontSize: 28, lineHeight: 28 },
  loginLink: { alignSelf: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  linkFocused: { borderBottomColor: authTokens.colors.focusRing, borderBottomWidth: 2 },
  loginText: { color: authTokens.colors.textPrimary, fontSize: 14, textDecorationLine: 'underline' },
});
