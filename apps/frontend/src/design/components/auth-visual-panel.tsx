import { Image, StyleSheet, Text, View } from 'react-native';

import { AuthenticationBrand } from './authentication-brand';
import { LiquidGlassPanel } from './liquid-glass-panel';
import { authTokens } from '../tokens';

const abstractBackdrop = require('../../../assets/authentication/liquid-emerald-abstract-v1.png');

type AuthenticationVisualPanelProps = {
  journey: 'login' | 'activation';
};

const progressCopy = {
  login: [
    { number: '01', label: 'Identifícate' },
    { number: '02', label: 'Accede' },
    { number: '03', label: 'Proyéctate' },
  ],
  activation: [
    { number: '01', label: 'Credencial' },
    { number: '02', label: 'Contraseña' },
    { number: '03', label: 'Activación' },
  ],
} as const;

/** Full-height abstract companion for authentication; it carries no interactive controls. */
export function AuthenticationVisualPanel({ journey }: AuthenticationVisualPanelProps) {
  const progress = progressCopy[journey];

  return (
    <View accessible={false} pointerEvents="none" style={styles.panel} testID={`authentication-visual-${journey}`}>
      <AuthenticationBrand variant="visual" style={styles.brand} />
      <LiquidGlassPanel style={styles.glass} testID="authentication-liquid-glass">
        <Text style={styles.heading}>Tu talento{`\n`}<Text style={styles.headingMuted}>merece ser visto.</Text></Text>
        <Text style={styles.support}>Accede a la plataforma donde tu evidencia construye oportunidades.</Text>
      </LiquidGlassPanel>
      <View style={styles.progressRail} testID={`authentication-progress-${journey}`}>
        <View pointerEvents="none" style={styles.progressTrack} />
        <View pointerEvents="none" style={styles.progressActiveTrack} />
        {progress.map((item, index) => (
          <View key={item.number} style={[styles.progressItem, index === 1 && styles.progressItemMiddle, index === 2 && styles.progressItemEnd]}>
            <View style={[styles.progressDot, index === 0 && styles.progressDotActive]} />
            <Text style={[styles.progressNumber, index === 0 && styles.progressTextActive]}>{item.number}</Text>
            <Text style={[styles.progressLabel, index === 0 && styles.progressTextActive]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Shared full-viewport gradient layer used beneath both desktop panels. */
export function AuthenticationBackground() {
  return <Image accessible={false} source={abstractBackdrop} resizeMode="cover" style={styles.globalBackdrop} testID="authentication-abstract-background" />;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: 'transparent', flex: 1, minWidth: 0, overflow: 'hidden', position: 'relative' },
  globalBackdrop: { height: '100%', opacity: 0.86, width: '100%' },
  brand: { left: authTokens.spacing.xl, position: 'absolute', top: authTokens.spacing.xl },
  glass: { bottom: 178, left: authTokens.spacing.xl, padding: authTokens.spacing.xl, position: 'absolute', width: '76%' },
  heading: { color: '#F1F5F0', fontSize: 51, fontWeight: '400', letterSpacing: -1.3, lineHeight: 57, maxWidth: 440 },
  headingMuted: { color: '#AFC4B6' },
  support: { color: '#B6C9BC', fontSize: 16, lineHeight: 24, marginTop: authTokens.spacing.lg, maxWidth: 405 },
  progressRail: { bottom: 74, height: 58, left: authTokens.spacing.xl, position: 'absolute', width: '62%' },
  progressTrack: { backgroundColor: 'rgba(211, 239, 221, 0.34)', height: 1, left: 3, position: 'absolute', right: 3, top: 5 },
  progressActiveTrack: { backgroundColor: authTokens.colors.primary, height: 1, left: 3, position: 'absolute', top: 5, width: '50%' },
  progressItem: { alignItems: 'flex-start', gap: 3, left: 0, position: 'absolute', top: 0 },
  progressItemMiddle: { alignItems: 'center', left: '50%', transform: [{ translateX: -21 }] },
  progressItemEnd: { alignItems: 'flex-end', left: undefined, right: 0 },
  progressDot: { backgroundColor: '#9AAEA1', borderColor: 'rgba(239, 255, 244, 0.45)', borderRadius: 5, borderWidth: 1, height: 10, marginBottom: 8, width: 10 },
  progressDotActive: { backgroundColor: authTokens.colors.primary, borderColor: '#E6FFD0', shadowColor: authTokens.colors.primary, shadowOpacity: 0.72, shadowRadius: 8 },
  progressNumber: { color: 'rgba(235, 248, 239, 0.66)', fontSize: 11, fontWeight: '500', letterSpacing: 0.35, lineHeight: 14 },
  progressLabel: { color: 'rgba(235, 248, 239, 0.66)', fontSize: 12, fontWeight: '400', lineHeight: 16 },
  progressTextActive: { color: '#F1F9F3' },
});
