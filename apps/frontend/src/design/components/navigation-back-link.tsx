import { Pressable, StyleSheet, Text } from 'react-native';

import { authTokens } from '../tokens';

export function NavigationBackLink({ label = 'Volver al inicio', onPress }: Readonly<{ label?: string; onPress: () => void }>) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.control, pressed && styles.pressed]}><Text accessibilityElementsHidden style={styles.arrow}>←</Text><Text style={styles.label}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  control: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 8, minHeight: 44, paddingRight: 12 },
  pressed: { opacity: 0.72 },
  arrow: { color: authTokens.colors.primary, fontSize: 24, lineHeight: 26 },
  label: { color: authTokens.colors.textPrimary, fontSize: 14, fontWeight: '800' },
});
