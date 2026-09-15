import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { authTokens } from './tokens';

type BrandMarkProps = {
  compact?: boolean;
  orientation?: 'horizontal' | 'stacked';
  style?: StyleProp<ViewStyle>;
};

/** Local, code-drawn branding; it intentionally has no image, font, or SVG dependency. */
export function BrandMark({ compact = false, orientation = 'horizontal', style }: BrandMarkProps) {
  const markSize = compact ? 40 : 56;

  return (
    <View
      accessibilityLabel="New Talents"
      accessibilityRole="image"
      style={[styles.lockup, orientation === 'stacked' && styles.lockupStacked, style]}
    >
      <View style={[styles.mark, { width: markSize, height: markSize, borderRadius: markSize / 2 }]}> 
        <View pointerEvents="none" style={styles.fieldLineVertical} />
        <View pointerEvents="none" style={styles.fieldLineHorizontal} />
        <Text style={[styles.monogram, compact && styles.monogramCompact]}>NT</Text>
      </View>
      {!compact ? (
        <View style={orientation === 'stacked' ? styles.wordmarkStacked : undefined}>
          <Text style={styles.wordmark}>NEW TALENTS</Text>
          <Text style={styles.tagline}>FÚTBOL · FUTURO · EVIDENCIA</Text>
        </View>
      ) : null}
    </View>
  );
}

export function DecorativeFieldPanel() {
  return (
    <View accessible={false} pointerEvents="none" style={styles.decorativePanel}>
      <View style={styles.decorativeCircle} />
      <View style={styles.decorativeHalfway} />
      <View style={styles.decorativeBox} />
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center', gap: authTokens.spacing.sm },
  lockupStacked: { alignItems: 'center', flexDirection: 'column', gap: 7 },
  wordmarkStacked: { alignItems: 'center' },
  mark: {
    alignItems: 'center',
    backgroundColor: authTokens.colors.surfaceElevated,
    borderColor: authTokens.colors.primary,
    borderWidth: 2,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fieldLineVertical: { backgroundColor: '#6F8C76', height: '100%', opacity: 0.28, position: 'absolute', width: 1 },
  fieldLineHorizontal: { backgroundColor: '#6F8C76', height: 1, opacity: 0.28, position: 'absolute', width: '100%' },
  monogram: { color: authTokens.colors.primary, fontSize: 20, fontWeight: '900', letterSpacing: -1 },
  monogramCompact: { fontSize: 15 },
  wordmark: { color: authTokens.colors.textPrimary, fontSize: 14, fontWeight: '900', letterSpacing: 1.4 },
  tagline: { color: authTokens.colors.textMuted, fontSize: 8, fontWeight: '700', letterSpacing: 0.75, marginTop: 2 },
  decorativePanel: { backgroundColor: '#0A1E15', flex: 1, minHeight: 320, overflow: 'hidden', position: 'relative' },
  decorativeCircle: { borderColor: '#52725A', borderRadius: 260, borderWidth: 1, height: 520, left: '50%', opacity: 0.22, position: 'absolute', top: -100, width: 520 },
  decorativeHalfway: { backgroundColor: '#52725A', height: 1, left: 0, opacity: 0.22, position: 'absolute', top: '50%', width: '100%' },
  decorativeBox: { borderColor: '#52725A', borderWidth: 1, height: 170, left: '50%', marginLeft: -90, opacity: 0.22, position: 'absolute', top: 75, width: 180 },
});
