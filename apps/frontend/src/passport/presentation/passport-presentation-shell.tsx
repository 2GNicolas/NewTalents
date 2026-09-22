import { type ReactNode } from 'react';
import { Image, Platform, ScrollView, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';

import { authTokens } from '../../design/tokens';
import { PlayerIdentity } from './player-identity';
import { PassportNav } from './passport-nav';
import { AuthenticationBrand } from '../../design/components/authentication-brand';
import { passportScale, passportTheme } from './passport-theme';
import type { PassportSectionKey, PassportStatus, PlayerIdentityPresentation } from '../passport-types';

type PassportPresentationShellProps = Readonly<{
  activeKey: PassportSectionKey;
  children: ReactNode;
  onSelect: (key: PassportSectionKey) => void;
  player: PlayerIdentityPresentation | null;
  loading?: boolean;
  viewportWidth?: number;
  status?: PassportStatus | null;
}>;

export function PassportPresentationShell({
  activeKey,
  children,
  onSelect,
  player,
  loading = false,
  viewportWidth,
  status = null,
}: PassportPresentationShellProps) {
  const { width } = useWindowDimensions();
  const desktop = (viewportWidth ?? width) >= authTokens.breakpoints.desktop;
  const scale = passportScale(viewportWidth ?? width);

  return (
    <View style={styles.page}>
      <View pointerEvents="none" style={styles.backdrop}><Image accessible={false} source={require('../../../assets/authentication/liquid-emerald-abstract-v1.png')} resizeMode="cover" style={{ height: '100%', width: '100%' }} /></View>
      <View pointerEvents="none" style={styles.backdropTint} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: desktop ? 32 : 18 * scale, paddingBottom: 30 * scale }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { height: desktop ? 90 : 71 * scale }]}>
          <AuthenticationBrand variant="visual" />
        </View>
        <View style={[styles.shell, desktop && styles.shellDesktop, { gap: desktop ? 22 : 12 * scale }]} testID={desktop ? 'passport-presentation-desktop' : 'passport-presentation-mobile'}>
          <View style={[styles.identityColumn, desktop && styles.identityColumnDesktop, desktop && stickyIdentity]} testID="passport-identity-column">
            <PlayerIdentity loading={loading} player={player} status={status} viewportWidth={viewportWidth} />
            <PassportNav activeKey={activeKey} onSelect={onSelect} viewportWidth={viewportWidth} />
          </View>
          <View style={[styles.contentColumn, { gap: 12 * scale }]}>{children}</View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: passportTheme.colors.canvas, flex: 1, width: '100%', minHeight: '100%' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, height: '100%', width: '100%', opacity: 0.86 },
  backdropTint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0, 20, 16, 0.24)' },
  scrollContent: { flexGrow: 1, width: '100%', alignSelf: 'center', maxWidth: 1600 },
  header: { justifyContent: 'center', alignItems: 'flex-start', width: '100%' },
  shell: { width: '100%', alignItems: 'stretch' },
  shellDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  identityColumn: { gap: 12, width: '100%' },
  identityColumnDesktop: { flexBasis: 340, flexGrow: 0, flexShrink: 0, maxWidth: 340 },
  contentColumn: { flex: 1, minWidth: 0, width: '100%' },
});

const stickyIdentity = Platform.OS === 'web' ? ({ position: 'sticky', top: 16 } as unknown as ViewStyle) : {};
