import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';

import { captureColors } from './analyst-match-ui';
import { type EventType } from './analyst-match-upload-state';

type Family = 'distribution' | 'attack' | 'defense' | 'keeper';
type WheelChoice = { eventType: EventType; variant?: 'NORMAL' | 'THROUGH'; label: string;
  family: Family; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] };
const choices: readonly WheelChoice[] = [
  { eventType: 'PASS', variant: 'NORMAL', label: 'Pase normal', family: 'distribution', icon: 'arrow-right' },
  { eventType: 'PASS', variant: 'THROUGH', label: 'Pase filtrado', family: 'distribution', icon: 'arrow-decision' },
  { eventType: 'ORIENTED_CONTROL', label: 'Control orientado', family: 'distribution', icon: 'soccer' },
  { eventType: 'RECEPTION', label: 'Recepción', family: 'distribution', icon: 'arrow-down' },
  { eventType: 'ASSIST', label: 'Asistencia', family: 'distribution', icon: 'target' },
  { eventType: 'CROSS', label: 'Centro', family: 'attack', icon: 'arrow-top-right' },
  { eventType: 'DRIBBLE', label: 'Regate', family: 'attack', icon: 'run-fast' },
  { eventType: 'SHOT', label: 'Remate', family: 'attack', icon: 'target' },
  { eventType: 'GOAL', label: 'Gol', family: 'attack', icon: 'soccer' },
  { eventType: 'OFFSIDE', label: 'Fuera de lugar', family: 'attack', icon: 'flag-outline' },
  { eventType: 'BALL_LOSS', label: 'Pérdida del balón', family: 'attack', icon: 'alert-outline' },
  { eventType: 'INTERCEPTION', label: 'Intercepción', family: 'defense', icon: 'shield-outline' },
  { eventType: 'TACKLE', label: 'Entrada', family: 'defense', icon: 'run' },
  { eventType: 'CLEARANCE', label: 'Despeje', family: 'defense', icon: 'arrow-top-right' },
  { eventType: 'SHOT_BLOCK', label: 'Bloqueo de remate', family: 'defense', icon: 'cancel' },
  { eventType: 'FOUL_RECEIVED', label: 'Falta recibida', family: 'defense', icon: 'account-outline' },
  { eventType: 'FOUL_COMMITTED', label: 'Falta cometida', family: 'defense', icon: 'alert-circle-outline' },
  { eventType: 'TACTICAL_FOUL', label: 'Falta táctica', family: 'defense', icon: 'alert-outline' },
  { eventType: 'SAVE', label: 'Atajada', family: 'keeper', icon: 'hand-back-right-outline' },
  { eventType: 'GOALKEEPER_EXIT', label: 'Salida del arquero', family: 'keeper', icon: 'run' },
  { eventType: 'GOALKEEPER_DISTRIBUTION', label: 'Saque ordinario', family: 'keeper', icon: 'arrow-right' },
  { eventType: 'GOALKEEPER_DIRECTED_DISTRIBUTION', label: 'Saque dirigido', family: 'keeper', icon: 'target' },
  { eventType: 'CLOSE_DOWN', label: 'Achique', family: 'keeper', icon: 'arrow-expand-all' },
];
const families: readonly { key: Family; label: string; color: string; start: number; end: number }[] = [
  { key: 'distribution', label: 'Distribución', color: '#51eac5', start: -Math.PI, end: -Math.PI / 2 },
  { key: 'attack', label: 'Ataque', color: '#d7f623', start: -Math.PI / 2, end: 0 },
  { key: 'defense', label: 'Defensa', color: '#43d9f1', start: 0, end: Math.PI / 2 },
  { key: 'keeper', label: 'Arquero', color: '#e383ee', start: Math.PI / 2, end: Math.PI },
];
const polar = (radius: number, angle: number) => ({ x: 300 + Math.cos(angle) * radius, y: 300 + Math.sin(angle) * radius });
// Reserve a perimeter for family names without shrinking the overlay or moving
// its anchor: the SVG wheel occupies the inner 600 units of a 732-unit viewBox.
const wheelCoreScale = 600 / 732;
const familyLabelRadius = 300;
const familyLabelWidth = 120;
export function wheelGeometry(diameter: number) {
  const scale = diameter / 600;
  return { wheelOuterRadius: 291 * wheelCoreScale * scale,
    familyLabelRadius: familyLabelRadius * scale,
    familyLabelHalfExtent: (familyLabelWidth / 2 * Math.SQRT1_2 + 12 * Math.SQRT1_2) * scale };
}
export function sectorPath(inner: number, outer: number, start: number, end: number) {
  const a = polar(outer, start), b = polar(outer, end), c = polar(inner, end), d = polar(inner, start);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${a.x} ${a.y} A ${outer} ${outer} 0 ${large} 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${inner} ${inner} 0 ${large} 0 ${d.x} ${d.y} Z`;
}
const angleFor = (choice: WheelChoice, mobile: boolean) => {
  const family = families.find((item) => item.key === choice.family)!;
  const familyChoices = choices.filter((item) => item.family === choice.family);
  const index = familyChoices.indexOf(choice);
  if (!mobile) {
    const slice = (family.end - family.start) / familyChoices.length;
    return { start: family.start + index * slice, end: family.start + (index + 1) * slice,
      center: family.start + (index + .5) * slice, color: family.color,
      inner: 117, outer: 278,
      radius: (index + (choice.family === 'attack' || choice.family === 'keeper' ? 1 : 0)) % 2 === 0 ? 174 : 226 };
  }
  // Narrow screens retain the family quadrants while dividing their many
  // choices into two radial bands with legible touch targets.
  const innerCount = choice.family === 'distribution' || choice.family === 'keeper' ? 2 : 3;
  const innerBand = index < innerCount;
  const bandChoices = innerBand ? familyChoices.slice(0, innerCount) : familyChoices.slice(innerCount);
  const bandIndex = innerBand ? index : index - innerCount;
  const slice = (family.end - family.start) / bandChoices.length;
  return { start: family.start + bandIndex * slice, end: family.start + (bandIndex + 1) * slice,
    center: family.start + (bandIndex + .5) * slice, color: family.color,
    inner: innerBand ? 115 : 196,
    outer: innerBand ? 193 : 278,
    radius: innerBand ? 154 : 236 };
};

export type WheelAnchor = { x: number; y: number; width: number; height: number };
type Props = { visible: boolean; anchor: WheelAnchor | null; onClose: () => void;
  onSelect: (eventType: EventType, variant?: 'NORMAL' | 'THROUGH') => void;
  selected?: { eventType: EventType; variant?: 'NORMAL' | 'THROUGH' } | null };

export function AnalystEventWheel({ visible, anchor, onClose, onSelect, selected }: Props) {
  const { width, height } = useWindowDimensions();
  const mobile = width < 900;
  const diameter = Math.min(mobile ? width - 18 : 610, height - (mobile ? 145 : 90));
  const left = Math.max(9, Math.min(width - diameter - 9, (anchor?.x ?? width / 2) + (anchor?.width ?? 0) / 2 - diameter / 2));
  const top = Math.max(9, Math.min(height - diameter - 9, (anchor?.y ?? height / 2) + (anchor?.height ?? 0) / 2 - diameter / 2));
  const originX = (anchor?.x ?? width / 2) + (anchor?.width ?? 0) / 2 - (left + diameter / 2);
  const originY = (anchor?.y ?? height / 2) + (anchor?.height ?? 0) / 2 - (top + diameter / 2);
  const progress = useRef(new Animated.Value(0)).current;
  const opened = useRef(false);
  const [mounted, setMounted] = useState(visible);
  const [focused, setFocused] = useState<number | null>(null);
  const choiceRefs = useRef<Array<View | null>>([]);
  const selectedIndex = selected ? choices.findIndex((choice) => choice.eventType === selected.eventType
    && choice.variant === selected.variant) : -1;

  useEffect(() => {
    if (visible) {
      opened.current = true;
      setMounted(true);
      Animated.timing(progress, { toValue: 1, duration: Platform.OS === 'web' ? 210 : 0, useNativeDriver: false }).start();
      const index = selectedIndex >= 0 ? selectedIndex : 0;
      setFocused(index);
      const timer = setTimeout(() => (choiceRefs.current[index] as unknown as { focus?: () => void } | null)?.focus?.(), 0);
      return () => clearTimeout(timer);
    }
    if (!opened.current) return;
    setFocused(null);
    if (Platform.OS !== 'web') { setMounted(false); progress.setValue(0); opened.current = false; return; }
    Animated.timing(progress, { toValue: 0, duration: 170, useNativeDriver: false }).start(({ finished }) => {
      if (finished) { setMounted(false); opened.current = false; }
    });
  }, [visible, progress, selectedIndex]);
  useEffect(() => {
    if (!visible || typeof document === 'undefined') return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [visible, onClose]);

  const scale = diameter / 600;
  const animatedStyle = { opacity: progress, transform: [
    { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [originX, 0] }) },
    { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [originY, 0] }) },
    { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [(anchor?.width ?? 175) / diameter, 1] }) },
  ] };
  return <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
    <View testID="event-wheel-overlay" style={{ flex: 1 }} accessibilityViewIsModal>
      <Pressable testID="event-wheel-backdrop" accessibilityRole="button" accessibilityLabel="Cerrar rueda de eventos"
        onPress={onClose} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
          backgroundColor: 'rgba(0, 23, 17, 0.28)' }} />
      <Animated.View testID="event-wheel-expanded-anchor" style={[{ position: 'absolute', left, top,
        width: diameter, height: diameter }, animatedStyle]}>
        <View role="group" accessibilityLabel="Rueda de eventos"
          style={{ width: diameter, height: diameter }}>
          <Svg width={diameter} height={diameter} viewBox="-66 -66 732 732" pointerEvents="none">
            <Circle cx="300" cy="300" r="289" fill="rgba(6, 47, 37, .82)" stroke={captureColors.borderBright} strokeWidth="1" />
            {choices.map((choice, index) => {
              const angle = angleFor(choice, mobile);
              const highlighted = focused === index || selectedIndex === index;
              return <Path key={choice.label} d={sectorPath(angle.inner, angle.outer, angle.start, angle.end)}
                fill={highlighted ? 'rgba(202, 244, 31, .20)' : 'rgba(14, 62, 48, .78)'}
                stroke={highlighted ? captureColors.lime : angle.color} strokeWidth={highlighted ? 4 : 1.15} />;
            })}
            {families.map((family) => <Path key={family.key}
              d={sectorPath(284, 291, family.start + .014, family.end - .014)}
              fill={family.color} />)}
            <Circle cx="300" cy="300" r="114" fill="rgba(0, 35, 27, .9)" stroke={captureColors.lime} strokeWidth="3" />
          </Svg>
          {families.map((family) => {
            const angle = (family.start + family.end) / 2;
            return <Text key={family.key} accessibilityLabel={`Familia ${family.label}`}
              style={{ position: 'absolute', width: familyLabelWidth * scale,
                left: diameter / 2 + Math.cos(angle) * familyLabelRadius * scale - familyLabelWidth * scale / 2,
                top: diameter / 2 + Math.sin(angle) * familyLabelRadius * scale - 12 * scale,
                color: family.color, fontWeight: '800', textAlign: 'center',
                fontSize: mobile ? 10 : 14, backgroundColor: 'rgba(0, 28, 21, .88)',
                borderRadius: 7, paddingVertical: 2 * scale }}>
              {family.label}</Text>;
          })}
          {choices.map((choice, index) => {
            const { center, color, radius: sectorRadius, inner } = angleFor(choice, mobile);
            const radius = sectorRadius * wheelCoreScale * scale;
            const buttonWidth = (inner === 115 ? 75 : 85) * wheelCoreScale * scale;
            const buttonHeight = 75 * wheelCoreScale * scale;
            const highlighted = focused === index || selectedIndex === index;
            return <Pressable key={choice.label} ref={(node) => { choiceRefs.current[index] = node; }}
              testID="event-wheel-sector" accessibilityRole="button" accessibilityLabel={choice.label}
              accessibilityState={{ selected: selectedIndex === index }} onFocus={() => setFocused(index)}
              onBlur={() => setFocused(null)} onPress={() => onSelect(choice.eventType, choice.variant)}
              style={{ position: 'absolute', left: diameter / 2 + Math.cos(center) * radius - buttonWidth / 2,
                top: diameter / 2 + Math.sin(center) * radius - buttonHeight / 2,
                width: buttonWidth, height: buttonHeight, alignItems: 'center', justifyContent: 'center',
                gap: mobile ? 1 : 3, outlineColor: captureColors.lime }}>
              <MaterialCommunityIcons name={choice.icon} size={mobile ? 13 : 21}
                color={highlighted ? captureColors.lime : color} />
              <Text numberOfLines={3} style={{ color: highlighted ? captureColors.lime : captureColors.white,
                textAlign: 'center', fontSize: mobile ? 8 : 10.5, lineHeight: mobile ? 9.5 : 12,
                fontWeight: highlighted ? '800' : '600' }}>{choice.label}</Text>
            </Pressable>;
          })}
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar rueda"
            testID="event-wheel-center-button" onPress={onClose}
            style={{ position: 'absolute', width: 216 * wheelCoreScale * scale, height: 216 * wheelCoreScale * scale,
              left: diameter / 2 - 108 * wheelCoreScale * scale, top: diameter / 2 - 108 * wheelCoreScale * scale,
              borderRadius: 108 * wheelCoreScale * scale, alignItems: 'center', justifyContent: 'center',
              outlineColor: captureColors.lime }}>
            <MaterialCommunityIcons name="soccer" size={mobile ? 22 : 32} color={captureColors.lime} />
            <Text style={{ color: captureColors.white, fontSize: mobile ? 12 : 17, fontWeight: '800', textAlign: 'center' }}>
              {selectedIndex >= 0 ? choices[selectedIndex]?.label : 'Eventos'}</Text>
            <Text style={{ color: captureColors.muted, fontSize: mobile ? 10 : 13, textAlign: 'center' }}>
              Cerrar rueda</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  </Modal>;
}
