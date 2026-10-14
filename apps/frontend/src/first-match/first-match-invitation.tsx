import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { FirstMatchAvailability } from './first-match-api';
import { FirstMatchHero, FirstMatchSurface, FirstMatchTitle, firstMatchColors } from './first-match-surface';

const cadenceLabel = { MONTHLY: 'mensual', QUARTERLY: 'trimestral', SEMIANNUAL: 'semestral', ANNUAL: 'anual' } as const;

export function FirstMatchInvitation({ availability, onStart, viewportWidth }: {
  availability: FirstMatchAvailability | null; onStart: () => void; viewportWidth?: number;
}) {
  const { width } = useWindowDimensions();
  const desktop = (viewportWidth ?? width) >= 1024;
  return <FirstMatchSurface screen="invitation" viewportWidth={viewportWidth}>
    <FirstMatchHero viewportWidth={viewportWidth} />
    <FirstMatchTitle prefix="Tu pasaporte está " accent="activo" />
    <Text style={styles.subtitle}>Agenda tu primer partido para comenzar a construir el análisis del jugador.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Agendar primer partido" onPress={onStart}
      style={[styles.button, !desktop && styles.mobileButton]}>
      <Text style={styles.buttonText}>Agendar primer partido  ›</Text>
    </Pressable>
    {availability?.configured && availability.available !== undefined
      ? <Text style={styles.availability}>Período {cadenceLabel[availability.cadence ?? 'MONTHLY']} · {availability.available} partidos disponibles</Text>
      : availability && !availability.configured ? <Text style={styles.availability}>Consulta los cupos al elegir la fecha del partido.</Text> : null}
    <View style={[styles.steps, desktop ? styles.stepsDesktop : styles.stepsMobile]} testID="first-match-invitation-steps">
      {['1. Agendar partido', '2. Analista registra eventos', '3. FEM calcula valores', '4. Disponible en el pasaporte'].map((step) =>
        <View key={step} style={styles.step}><Text style={styles.stepText}>{step}</Text></View>)}
    </View>
  </FirstMatchSurface>;
}

const styles = StyleSheet.create({
  subtitle: { color: firstMatchColors.muted, fontSize: 19, lineHeight: 27, maxWidth: 660, textAlign: 'center' },
  button: { alignItems: 'center', backgroundColor: firstMatchColors.lime, borderRadius: 13, justifyContent: 'center',
    marginTop: 6, minHeight: 60, paddingHorizontal: 28 },
  mobileButton: { alignSelf: 'stretch' },
  buttonText: { color: '#06160F', fontSize: 20, fontWeight: '800' },
  availability: { color: firstMatchColors.muted, fontSize: 16, textAlign: 'center' },
  steps: { gap: 14, justifyContent: 'space-between', marginTop: 16, maxWidth: 760, width: '100%' },
  stepsDesktop: { flexDirection: 'row' }, stepsMobile: { alignItems: 'center' },
  step: { alignItems: 'center', flex: 1, padding: 8 },
  stepText: { color: firstMatchColors.white, fontSize: 15, textAlign: 'center' },
});
