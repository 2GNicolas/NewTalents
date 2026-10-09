import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { loadPublicEnvironment } from '../src/config/public-environment';

export default function RuntimeEntry() {
  const configuration = loadPublicEnvironment();
  const { width } = useWindowDimensions();
  const wide = width >= 720;

  return (
    <View style={styles.page} accessibilityLabel="Estado del runtime de New Talents">
      <View style={[styles.card, wide && styles.cardWide]}>
        <Text accessibilityRole="header" style={styles.title}>New Talents</Text>
        <Text style={styles.message} accessibilityLiveRegion="polite">
          {configuration.ok ? 'Runtime frontend listo' : 'Configuración frontend inválida'}
        </Text>
        <Text style={styles.detail}>
          {configuration.ok
            ? 'La base multiplataforma está preparada.'
            : 'Revise la configuración pública requerida antes de iniciar.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', backgroundColor: '#f4f7fb', flex: 1, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, maxWidth: 560, padding: 28, width: '100%' },
  cardWide: { padding: 40 },
  title: { color: '#14213d', fontSize: 30, fontWeight: '700', marginBottom: 16 },
  message: { color: '#1b4332', fontSize: 20, fontWeight: '600', marginBottom: 8 },
  detail: { color: '#4b5563', fontSize: 16, lineHeight: 24 },
});
