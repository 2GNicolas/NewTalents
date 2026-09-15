import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { authTokens } from '../tokens';

const playerHero = require('../../../assets/authentication/scouting-player-hero-v1.png');

/** Desktop-only photographic panel. The player is a bundled raster asset, never a CSS substitute. */
export function ScoutingHero() {
  return (
    <View accessibilityElementsHidden accessible={false} style={styles.hero} testID="scouting-hero">
      <Image source={playerHero} style={styles.image} resizeMode="cover" />
      <View pointerEvents="none" style={styles.tint} />
      <View pointerEvents="none" style={styles.diagram}>
        <View style={styles.diagramCircle} />
        <View style={styles.diagramLine} />
        <View style={styles.diagramDotOne} />
        <View style={styles.diagramDotTwo} />
      </View>
      <View pointerEvents="none" style={styles.copy}>
        <Text style={styles.eyebrow}>NEW TALENTS</Text>
        <Text style={styles.copyText}>EL TALENTO{`\n`}NO TIENE{`\n`}FRONTERAS.</Text>
        <Text style={styles.copyBody}>Talento · Disciplina · Oportunidades.</Text>
        <View style={styles.underline} />
      </View>
      <View pointerEvents="none" style={styles.glassValues}>
        <Text style={styles.glassValue}>HOY OBSERVAMOS EL MAÑANA</Text>
      </View>
    </View>
  );
}

export function MobileFootballDecoration() {
  return (
    <View accessible={false} pointerEvents="none" style={styles.mobileDecoration} testID="mobile-football-decoration">
      <View style={styles.mobileArc} />
      <View style={styles.mobileLine} />
      <Text style={styles.mobileMotto}>EL TALENTO MUEVE EL MUNDO</Text>
    </View>
  );
}

export function DesktopTalentMotto() {
  const { width } = useWindowDimensions();
  if (width < authTokens.breakpoints.desktop) return null;

  return <Text style={styles.desktopMotto} testID="desktop-talent-motto">EL TALENTO{`\n`}NO TIENE FRONTERAS</Text>;
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#082119', flex: 1, minHeight: 620, overflow: 'hidden', position: 'relative' },
  image: { height: '130%', position: 'absolute', top: 0, width: '100%' },
  tint: { backgroundColor: 'rgba(1, 18, 12, 0.58)', height: '100%', position: 'absolute', width: '100%' },
  diagram: { height: '100%', left: 0, opacity: 0.72, position: 'absolute', top: 0, width: '100%' },
  diagramCircle: { borderColor: '#9AC8A8', borderRadius: 150, borderWidth: 1, height: 300, left: -145, opacity: 0.48, position: 'absolute', top: 144, width: 300 },
  diagramLine: { backgroundColor: '#9AC8A8', height: 1, left: 0, opacity: 0.5, position: 'absolute', top: 292, width: '49%' },
  diagramDotOne: { backgroundColor: authTokens.colors.textPrimary, borderRadius: 3, height: 6, left: 88, position: 'absolute', top: 273, width: 6 },
  diagramDotTwo: { backgroundColor: authTokens.colors.primary, borderRadius: 3, height: 6, left: 148, position: 'absolute', top: 351, width: 6 },
  copy: { bottom: 72, left: 52, maxWidth: 310, position: 'absolute' },
  eyebrow: { color: authTokens.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: authTokens.spacing.sm },
  copyText: { color: authTokens.colors.textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.4, lineHeight: 32 },
  copyBody: { color: authTokens.colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: authTokens.spacing.sm },
  underline: { backgroundColor: authTokens.colors.primary, height: 3, marginTop: authTokens.spacing.md, width: 52 },
  glassValues: { backgroundColor: 'rgba(218, 255, 232, 0.10)', borderColor: 'rgba(222, 255, 235, 0.20)', borderRadius: authTokens.radius.md, borderWidth: 1, bottom: 42, paddingHorizontal: authTokens.spacing.md, paddingVertical: authTokens.spacing.sm, position: 'absolute', right: 36 },
  glassValue: { color: authTokens.colors.textPrimary, fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  mobileDecoration: { height: 78, justifyContent: 'flex-end', marginTop: authTokens.spacing.md, overflow: 'hidden', position: 'relative' },
  mobileArc: { borderColor: '#668A6F', borderRadius: 90, borderWidth: 1, height: 150, left: -25, opacity: 0.35, position: 'absolute', top: 18, width: 190 },
  mobileLine: { backgroundColor: '#668A6F', height: 1, left: 0, opacity: 0.38, position: 'absolute', top: 39, width: '100%' },
  mobileMotto: { color: authTokens.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.35, marginBottom: 4 },
  desktopMotto: { color: authTokens.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.35, marginTop: authTokens.spacing.sm },
});
