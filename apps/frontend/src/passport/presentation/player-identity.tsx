import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { authTokens } from '../../design/tokens';
import { AuthLoading } from '../../design/components/auth-primitives';
import { LiquidGlassPanel } from '../../design/components/liquid-glass-panel';
import { projectAcademyOrigin, projectPhotographPlaceholder } from './availability';
import { PassportIcon } from './passport-icon';
import { passportScale, passportTheme } from './passport-theme';
import { LIFECYCLE_STATE_LABELS, type PassportStatus, type PlayerIdentityPresentation } from '../passport-types';

type PlayerIdentityProps = Readonly<{
  player: PlayerIdentityPresentation | null;
  loading?: boolean;
  status?: PassportStatus | null;
  viewportWidth?: number;
}>;

export function presentationText(value: string | null | undefined): string {
  if (!value?.trim()) return 'No disponible';
  // Corrupt/technical fixture values must never masquerade as player information.
  if (/[\uFFFD]|Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]|ï¿½|[0-9a-f]{8}-[0-9a-f]{4}|\b[0-9a-f]{32,}\b|\b(?:Nombre Local|fingerprint|fixture|NTLOCAL)\b/i.test(value)) return 'No disponible';
  return value.trim().normalize('NFC');
}

export function PlayerIdentity({ player, loading = false, status = null, viewportWidth }: PlayerIdentityProps) {
  const { width } = useWindowDimensions();
  const desktop = (viewportWidth ?? width) >= authTokens.breakpoints.desktop;
  const scale = passportScale(viewportWidth ?? width);
  if (loading && !player) return <AuthLoading label="Cargando identidad del jugador" />;

  const academy = projectAcademyOrigin(player);
  const photograph = projectPhotographPlaceholder();
  const name = presentationText(player?.displayName);
  const initials = name === 'No disponible' ? 'NT' : name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const location = [player?.city, player?.country].filter(Boolean).map(presentationText).join(', ') || 'No disponible';
  const type = { fontFamily: passportTheme.fontFamily };

  return (
    <LiquidGlassPanel style={[styles.identityPanel, { padding: desktop ? 20 : 13 * scale, borderRadius: 14 * scale }, !desktop && styles.identityMobile]} testID="passport-player-identity">
      <View accessibilityLabel={photograph.label} accessibilityRole="image" style={[styles.photographPlaceholder, { width: desktop ? '100%' : 131 * scale, height: desktop ? 300 : 161 * scale, borderRadius: 36 * scale }]} testID="passport-photograph-placeholder">
        <Text accessible={false} style={[styles.initials, type, { fontSize: desktop ? 88 : 48 * scale }]}>{initials}</Text>
        <Text accessible={false} style={[styles.photoCaption, type, { fontSize: 9 * scale }]}>Fotografía no disponible</Text>
      </View>
      <View style={[styles.information, { gap: desktop ? 13 : 9 * scale, marginLeft: desktop ? 0 : 15 * scale, marginTop: desktop ? 15 : 3 * scale }]}>
        <View style={[styles.statusBadge, { paddingHorizontal: 10 * scale, paddingVertical: 5 * scale, borderRadius: 99 }]}>
          <View style={[styles.statusDot, { width: 7 * scale, height: 7 * scale }]} />
          <Text style={[styles.badgeText, type, { fontSize: 11 * scale }]}>{status === 'ACTIVE' ? 'Perfil activo' : status ? LIFECYCLE_STATE_LABELS[status] : 'No disponible'}</Text>
        </View>
        <View style={{ gap: 4 * scale }}>
          <Text style={styles.screenReaderLabel}>Nombre visible</Text>
          <Text accessibilityRole="header" accessibilityLabel={`Nombre visible: ${name}`} style={[styles.displayName, type, { fontSize: desktop ? 31 : 25 * scale, lineHeight: desktop ? 37 : 29 * scale }]} testID="passport-player-name">{name}</Text>
          <Text style={styles.screenReaderLabel}>Posición</Text>
          <Text accessibilityLabel={`Posición: ${presentationText(player?.position)}. Categoría de edad: ${presentationText(player?.ageCategory)}`} style={[styles.position, type, { fontSize: desktop ? 19 : 13 * scale, lineHeight: 18 * scale }]}>
            <Text>{presentationText(player?.position)}</Text><Text style={styles.category}>{' · '}{presentationText(player?.ageCategory)}</Text>
          </Text>
        </View>
        <View style={[styles.context, { gap: desktop ? 13 : 10 * scale }]}>
          <View style={styles.contextRow}>
            <PassportIcon name="academy" size={18 * scale} />
            <View style={styles.contextValue}>
              <Text style={styles.screenReaderLabel}>Academia de origen</Text>
              <Text style={[styles.detail, type, { fontSize: desktop ? 16 : 12 * scale }]}>{academy.kind === 'available' ? presentationText(academy.name) : academy.label}</Text>
            </View>
          </View>
          <View style={styles.contextRow}>
            <PassportIcon name="location" size={18 * scale} />
            <Text accessibilityLabel={`Ciudad y país: ${location}`} style={[styles.detail, type, styles.contextValue, { fontSize: desktop ? 16 : 12 * scale }]}>{location}</Text>
          </View>
          <View style={styles.contextRow}>
            <PassportIcon name="foot" size={18 * scale} />
            <Text style={[styles.detail, type, styles.contextValue, { fontSize: desktop ? 15 : 11 * scale }]}>Pie dominante: <Text style={styles.foot}>{presentationText(player?.dominantFoot)}</Text></Text>
          </View>
        </View>
      </View>
    </LiquidGlassPanel>
  );
}

const styles = StyleSheet.create({
  identityPanel: { backgroundColor: 'rgba(8, 61, 44, 0.32)', borderColor: passportTheme.colors.border, width: '100%' },
  identityMobile: { flexDirection: 'row', alignItems: 'center' },
  photographPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 27, 22, 0.66)', borderWidth: 1, borderColor: 'rgba(100, 202, 165, 0.45)', overflow: 'hidden', flexShrink: 0 },
  initials: { color: '#98BCAF', fontWeight: '400', letterSpacing: -2 },
  photoCaption: { color: '#90B2A5', bottom: 14, position: 'absolute', letterSpacing: 0.4 },
  information: { flex: 1, minWidth: 0 },
  statusBadge: { flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'flex-start', borderColor: 'rgba(104, 203, 154, 0.34)', borderWidth: 1, backgroundColor: 'rgba(16, 89, 61, 0.35)', maxWidth: '100%' },
  statusDot: { backgroundColor: passportTheme.colors.lime, borderRadius: 99, flexShrink: 0 },
  badgeText: { color: passportTheme.colors.lime, flexShrink: 1 },
  displayName: { color: authTokens.colors.textPrimary, fontWeight: '700', letterSpacing: -0.6 },
  position: { color: passportTheme.colors.lime, fontWeight: '700' },
  category: { color: '#8DA4AF', fontWeight: '600' },
  context: { marginTop: 2 },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  contextValue: { flex: 1, minWidth: 0 },
  detail: { color: authTokens.colors.textSecondary },
  foot: { color: passportTheme.colors.lime, fontWeight: '600' },
  screenReaderLabel: { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' },
});
