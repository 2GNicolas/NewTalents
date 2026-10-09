import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { authTokens } from '../../design/tokens';
import { LiquidGlassPanel } from '../../design/components/liquid-glass-panel';
import { PASSPORT_SECTIONS } from './sections';
import { PassportIcon } from './passport-icon';
import { passportScale, passportTheme } from './passport-theme';
import type { PassportSectionKey } from '../passport-types';

type PassportNavProps = Readonly<{
  activeKey: PassportSectionKey;
  onSelect: (key: PassportSectionKey) => void;
  viewportWidth?: number;
}>;

function PassportNavItem({ active, label, sectionKey, onSelect, desktop, scale }: { active: boolean; label: string; sectionKey: PassportSectionKey; onSelect: PassportNavProps['onSelect']; desktop: boolean; scale: number }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onBlur={() => { setFocused(false); }}
      onFocus={() => { setFocused(true); }}
      onPress={() => { onSelect(sectionKey); }}
      style={[styles.navItem, { minHeight: Math.max(authTokens.sizing.minInteractiveSize, 35 * scale) }, desktop && styles.desktopItem, active && styles.navItemActive, desktop && active && styles.desktopItemActive, focused && styles.navItemFocused]}
      testID={`passport-nav-item-${sectionKey}`}
    >
      <Text style={[styles.navLabel, { fontSize: desktop ? 17 : 12 * scale }, active && styles.navLabelActive]}>{label}</Text>
      {desktop && active ? <PassportIcon name="next" color={passportTheme.colors.lime} size={18} /> : null}
      {!desktop && active ? <View pointerEvents="none" style={styles.activeUnderline} /> : null}
    </Pressable>
  );
}

export function PassportNav({ activeKey, onSelect, viewportWidth }: PassportNavProps) {
  const { width } = useWindowDimensions();
  const desktop = (viewportWidth ?? width) >= authTokens.breakpoints.desktop;
  const scale = passportScale(viewportWidth ?? width);
  return (
    <LiquidGlassPanel style={[styles.navigation, { borderRadius: desktop ? 16 : 99 }, desktop && styles.verticalNav]} testID={desktop ? 'passport-nav-desktop' : 'passport-nav-mobile'}>
      <View style={[styles.list, desktop && styles.verticalList]} testID={desktop ? 'passport-nav-vertical' : 'passport-nav-horizontal'}>
        {PASSPORT_SECTIONS.map(section => (
          <PassportNavItem key={section.key} active={section.key === activeKey} label={section.title} onSelect={onSelect} sectionKey={section.key} desktop={desktop} scale={scale} />
        ))}
      </View>
    </LiquidGlassPanel>
  );
}

const styles = StyleSheet.create({
  navigation: { backgroundColor: passportTheme.colors.glassRaised, borderColor: passportTheme.colors.border, width: '100%' },
  list: { flexDirection: 'row', width: '100%' },
  verticalNav: { padding: 8 },
  verticalList: { flexDirection: 'column', gap: 3 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 0, borderWidth: 2, borderColor: 'transparent', position: 'relative' },
  desktopItem: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 48, borderRadius: 8 },
  navItemActive: { backgroundColor: 'rgba(40, 115, 72, 0.12)' },
  desktopItemActive: { borderLeftColor: passportTheme.colors.lime, backgroundColor: 'rgba(39, 112, 65, 0.24)' },
  navItemFocused: { borderColor: authTokens.focus.webOutlineColor, borderWidth: authTokens.focus.borderWidth },
  navLabel: { color: passportTheme.colors.secondary, fontFamily: passportTheme.fontFamily, fontWeight: '400', textAlign: 'center' },
  navLabelActive: { color: passportTheme.colors.lime, fontWeight: '700' },
  activeUnderline: { position: 'absolute', bottom: 0, left: '10%', right: '10%', height: 3, borderRadius: 8, backgroundColor: passportTheme.colors.lime },
});
