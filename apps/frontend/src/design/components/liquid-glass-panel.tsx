import { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type LiquidGlassPanelProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const webBackdropFilter = Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(28px) saturate(135%)', boxShadow: '0 16px 28px rgba(11, 189, 114, 0.25)', WebkitBackdropFilter: 'blur(28px) saturate(135%)' } as unknown as ViewStyle)
  : {};

/**
 * A platform-safe glass surface. Web uses native backdrop diffusion; native keeps the
 * same translucent contrast treatment when a blur implementation is not available.
 */
export function LiquidGlassPanel({ children, style, testID }: LiquidGlassPanelProps) {
  return (
    <View style={[styles.surface, styles.passThrough, Platform.OS !== 'web' && styles.nativeShadow, webBackdropFilter, style]} testID={testID}>
      <View style={[styles.topHighlight, styles.decorative]} />
      <View style={[styles.lowerReflection, styles.decorative]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: 'rgba(12, 47, 34, 0.19)',
    borderColor: 'rgba(231, 255, 241, 0.46)',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  nativeShadow: { shadowColor: '#0BBD72', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.25, shadowRadius: 28 },
  passThrough: { pointerEvents: 'box-none' },
  decorative: { pointerEvents: 'none' },
  topHighlight: {
    backgroundColor: 'rgba(240, 255, 246, 0.56)',
    height: 1,
    left: 16,
    position: 'absolute',
    right: 16,
    top: 0,
  },
  lowerReflection: { backgroundColor: 'rgba(132, 255, 195, 0.26)', bottom: 0, height: 1, left: '44%', position: 'absolute', right: 12 },
});
