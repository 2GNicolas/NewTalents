import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { authTokens } from '../tokens';

type AuthenticationBrandProps = {
  variant: 'visual' | 'form';
  style?: StyleProp<ViewStyle>;
};

/** The approved authentication-specific New Talents lockups. */
export function AuthenticationBrand({ variant, style }: AuthenticationBrandProps) {
  const visual = variant === 'visual';

  return (
    <View accessibilityLabel="New Talents" accessibilityRole="image" style={[styles.lockup, visual ? styles.visualLockup : styles.formLockup, style]}>
      <View style={[styles.monogramWrap, visual ? styles.visualMonogramWrap : styles.formMonogramWrap]}>
        <Text style={[styles.monogram, visual ? styles.visualMonogram : styles.formMonogram]}>NT</Text>
        <View pointerEvents="none" style={[styles.dot, visual ? styles.visualDot : styles.formDot]} />
      </View>
      {visual ? <Text style={styles.wordmark}>NEW TALENTS</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { alignItems: 'flex-start' },
  visualLockup: { gap: 4 },
  formLockup: { alignItems: 'center', justifyContent: 'center' },
  monogramWrap: { position: 'relative' },
  visualMonogramWrap: { minWidth: 70 },
  formMonogramWrap: { alignItems: 'center', borderColor: authTokens.colors.primary, borderRadius: 18, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  monogram: { color: '#F5F7F2', fontFamily: undefined, fontWeight: '500' },
  visualMonogram: { fontSize: 46, letterSpacing: -3, lineHeight: 50 },
  formMonogram: { fontSize: 15, letterSpacing: -1.1, lineHeight: 18 },
  dot: { backgroundColor: authTokens.colors.primary, borderRadius: 3, height: 6, position: 'absolute', width: 6 },
  visualDot: { right: 1, top: 6 },
  formDot: { right: -3, top: -2 },
  wordmark: { color: '#F2F6F1', fontSize: 11, fontWeight: '500', letterSpacing: 3.1, lineHeight: 15 },
});
