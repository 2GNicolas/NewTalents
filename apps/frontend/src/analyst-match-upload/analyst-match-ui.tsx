import { forwardRef, type CSSProperties, type PropsWithChildren, type Ref } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { AnalystMatchDetail } from '../analyst-workspace/analyst-workspace-api';
import { AnalystWorkspaceShell } from '../analyst-workspace/analyst-workspace-shell';

export const captureColors = { white: '#f5fff9', muted: '#bdd1cc', lime: '#c8f51c', aqua: '#63e7cc',
  border: 'rgba(124, 202, 166, .45)', borderBright: 'rgba(156, 235, 193, .72)',
  panel: 'rgba(0, 29, 23, .76)', dark: '#001b14' };
export const captureStyles = StyleSheet.create({
  title: { color: captureColors.white, fontSize: 36, fontWeight: '800', letterSpacing: -.7 },
  subtitle: { color: captureColors.muted, fontSize: 17, lineHeight: 23, marginBottom: 14 },
  panel: { backgroundColor: captureColors.panel, borderColor: captureColors.border, borderWidth: 1, borderRadius: 13, padding: 16, gap: 12 },
  split: { gap: 10 }, section: { color: captureColors.white, fontSize: 21, fontWeight: '700' },
  label: { color: captureColors.white, fontSize: 15, fontWeight: '600' }, text: { color: captureColors.muted, fontSize: 15 },
  field: { color: captureColors.white, backgroundColor: 'rgba(0, 14, 12, .76)', borderColor: captureColors.borderBright,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, minHeight: 46, outlineColor: captureColors.lime },
  button: { borderColor: captureColors.borderBright, borderWidth: 1, borderRadius: 8, minHeight: 45, paddingHorizontal: 15,
    justifyContent: 'center', alignItems: 'center', outlineColor: captureColors.lime, backgroundColor: 'rgba(0, 20, 18, .42)' },
  buttonText: { color: captureColors.white, fontSize: 15, fontWeight: '700' },
  choice: { borderColor: captureColors.border, borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 10,
    minHeight: 42, justifyContent: 'center', outlineColor: captureColors.lime },
  choiceSelected: { borderColor: captureColors.lime, backgroundColor: 'rgba(183, 239, 27, .17)' },
  choiceText: { color: captureColors.white, fontSize: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

export function CaptureFrame({ match, step, onBack, onNavigate, children }: PropsWithChildren<{
  match: AnalystMatchDetail; step: 'capture' | 'review' | 'final' | 'confirmed'; onBack?: () => void;
  onNavigate?: (destination: 'Inicio' | 'Pasaportes' | 'Partidos') => void }>) {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const initials = match.playerName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
  const stages = [['capture', 'Captura'], ['review', 'Revisión'], ['final', 'Datos finales'], ['confirmed', 'Confirmada']] as const;
  const current = stages.findIndex(([key]) => key === step);
  return <AnalystWorkspaceShell current="Partidos" onNavigate={onNavigate}>
    <View style={{ gap: desktop ? 16 : 13, marginTop: desktop ? -34 : 0 }}>
      {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Volver a Partidos" onPress={onBack}
        style={{ minHeight: 38, alignSelf: 'flex-start', justifyContent: 'center', outlineColor: captureColors.lime }}>
        <Text style={{ color: captureColors.white, fontSize: 16 }}>←  Partidos</Text>
      </Pressable> : null}
      <View style={{ flexDirection: desktop ? 'row' : 'column', alignItems: desktop ? 'center' : 'flex-start', gap: desktop ? 24 : 7,
        borderBottomColor: captureColors.border, borderBottomWidth: 1, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 }}>
          <View accessible={false} style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1.5,
            borderColor: captureColors.aqua, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: captureColors.white, fontSize: 17, fontWeight: '700' }}>{initials}</Text>
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ color: captureColors.white, fontSize: desktop ? 18 : 20, fontWeight: '700' }}>
              {match.playerName}</Text>
            <Text style={{ color: captureColors.muted, fontSize: 13 }}>{match.maskedReference}</Text>
          </View>
          <Text style={{ color: captureColors.aqua, borderColor: captureColors.border, borderWidth: 1, borderRadius: 15,
            overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, fontSize: 12 }}>En espera</Text>
        </View>
        <View style={{ flex: desktop ? 1 : undefined, borderLeftColor: desktop ? captureColors.border : 'transparent',
          borderLeftWidth: desktop ? 1 : 0, paddingLeft: desktop ? 24 : 0, gap: 3 }}>
          <Text style={{ color: captureColors.white, fontSize: desktop ? 17 : 16, fontWeight: '600' }}>vs. {match.opponent}</Text>
          <Text style={{ color: captureColors.muted, fontSize: 13 }}>{match.matchDate}  ·  {match.matchTime}  ·  {match.venue}</Text>
          <Text style={{ color: captureColors.muted, fontSize: 13 }}>{match.competition}</Text>
        </View>
      </View>
      <View accessibilityLabel={`Etapa ${current + 1} de 4: ${stages[current]?.[1]}`} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2 }}>
        {stages.map(([key, label], index) => <View key={key} style={{ flex: 1, alignItems: 'center', position: 'relative' }}>
          {index > 0 ? <View style={{ position: 'absolute', left: '-50%', right: '50%', top: 15, height: 2,
            backgroundColor: index <= current ? captureColors.aqua : captureColors.border }} /> : null}
          <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2,
            borderColor: index === current ? captureColors.lime : index < current ? captureColors.aqua : captureColors.borderBright,
            backgroundColor: index === current ? '#183316' : '#001b17', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: index === current ? captureColors.lime : captureColors.white, fontWeight: '700' }}>{index < current ? '✓' : index + 1}</Text>
          </View>
          <Text style={{ color: index === current ? captureColors.lime : captureColors.white, fontSize: desktop ? 13 : 11,
            fontWeight: index === current ? '700' : '400', marginTop: 5, textAlign: 'center' }}>{label}</Text>
        </View>)}
      </View>
      {children}
    </View>
  </AnalystWorkspaceShell>;
}

export function CaptureButton({ label, onPress, disabled, variant = 'outline' }: { label: string; onPress: () => void;
  disabled?: boolean; variant?: 'outline' | 'primary' | 'quiet' }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={[captureStyles.button, variant === 'primary' && { borderColor: captureColors.lime,
      backgroundColor: captureColors.lime }, variant === 'quiet' && { borderColor: 'transparent', backgroundColor: 'transparent' },
      disabled && { opacity: .45 }]}>
    <Text style={[captureStyles.buttonText, variant === 'primary' && { color: '#001a13' }]}>{label}</Text></Pressable>;
}
export function CaptureIconButton({ label, icon, onPress }: { label: string; icon: 'pencil-outline' | 'delete-outline'; onPress: () => void }) {
  if (Platform.OS === 'web') return <button type="button" aria-label={label} title={label} onClick={onPress}
    style={{ width: 42, height: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      border: `1px solid ${captureColors.borderBright}`, borderRadius: 8, background: 'rgba(0, 34, 28, .72)',
      color: captureColors.white, cursor: 'pointer', outlineColor: captureColors.lime }}>
    <MaterialCommunityIcons name={icon} size={21} color={captureColors.white} /></button>;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={{ width: 42, height: 42, borderColor: captureColors.borderBright, borderWidth: 1, borderRadius: 8,
      backgroundColor: 'rgba(0, 34, 28, .72)', alignItems: 'center', justifyContent: 'center', outlineColor: captureColors.lime }}>
    <MaterialCommunityIcons name={icon} size={21} color={captureColors.white} />
  </Pressable>;
}
export const CaptureEventButton = forwardRef<View, { label: string; title: string; action: string; desktop: boolean; onPress: () => void }>(
  function CaptureEventButton({ label, title, action, desktop, onPress }, ref) {
    const size = desktop ? 214 : 174;
    return <Pressable ref={ref} testID="event-wheel-anchor" accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: captureColors.lime,
        backgroundColor: 'rgba(0, 19, 17, .94)', justifyContent: 'center', alignItems: 'center', gap: 5,
        outlineColor: captureColors.lime, boxShadow: '0 0 20px rgba(200, 245, 28, .25)' }}>
      <Image source={require('../../assets/passport/icons/ball-football.png')} style={{ width: 32, height: 32 }} tintColor={captureColors.lime} />
      <Text style={{ color: captureColors.white, fontSize: desktop ? 21 : 18, fontWeight: '800', textAlign: 'center' }}>{title}</Text>
      <Text style={{ color: captureColors.white, fontSize: 14 }}>{action}</Text>
    </Pressable>;
  });
export function CaptureChoice({ label, visualLabel, selected, onPress, rail = false, disabled = false }: { label: string; visualLabel?: string;
  selected: boolean; onPress: () => void; rail?: boolean; disabled?: boolean }) {
  const visibleLabel = visualLabel ?? (rail && label.includes(': ') ? label.slice(label.indexOf(': ') + 2) : label);
  if (Platform.OS === 'web') {
    const style: CSSProperties = { border: `1px solid ${selected ? captureColors.lime : captureColors.borderBright}`,
      borderRadius: 8, padding: '10px 14px', minHeight: 44, backgroundColor: selected ? 'rgba(192, 240, 28, .17)' : 'rgba(0, 18, 16, .48)',
      color: selected ? captureColors.lime : captureColors.white, fontSize: 14, cursor: 'pointer', outlineColor: captureColors.lime };
    const railStyle: CSSProperties = { border: `2px solid ${selected ? captureColors.lime : captureColors.borderBright}`,
      borderRadius: 10, background: selected ? 'rgba(200, 245, 28, .22)' : 'rgba(5, 47, 37, .72)',
      boxShadow: selected ? 'inset 0 0 0 1px rgba(200,245,28,.34), 0 0 12px rgba(200,245,28,.15)' : 'none',
      color: selected ? captureColors.lime : captureColors.white, cursor: 'pointer', outlineColor: captureColors.lime,
      padding: '12px 10px', minHeight: 62, flex: '1 1 112px', maxWidth: 210, minWidth: 96,
      fontSize: 14, fontWeight: selected ? 800 : 600, textAlign: 'center' };
    return <button type="button" role="radio" aria-checked={selected} aria-label={label} disabled={disabled}
      data-testid={rail ? 'measurement-choice-card' : undefined} onClick={onPress} style={{ ...(rail ? railStyle : style), opacity: disabled ? .5 : 1 }}>
      {visibleLabel}</button>;
  }
  return <Pressable testID={rail ? 'measurement-choice-card' : undefined}
     accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} aria-checked={selected}
     accessibilityLabel={label} onPress={onPress} disabled={disabled}
    style={rail ? { flexGrow: 1, flexBasis: 112, minWidth: 96, maxWidth: 210, minHeight: 62,
      borderWidth: 2, borderColor: selected ? captureColors.lime : captureColors.borderBright,
      backgroundColor: selected ? 'rgba(200, 245, 28, .22)' : 'rgba(5, 47, 37, .72)',
      borderRadius: 10, paddingHorizontal: 10, paddingVertical: 12,
      alignItems: 'center', justifyContent: 'center', outlineColor: captureColors.lime }
      : [captureStyles.choice, selected && captureStyles.choiceSelected]}>
    <Text style={[captureStyles.choiceText, rail && { fontSize: 14, fontWeight: selected ? '800' : '600',
      textAlign: 'center', color: selected ? captureColors.lime : captureColors.white }]}>{visibleLabel}</Text>
  </Pressable>;
}
export function CaptureInput({ label, value, onChangeText, keyboardType, placeholder, inputRef, error, disabled }: { label: string; value: string;
  onChangeText: (value: string) => void; keyboardType?: 'default' | 'number-pad' | 'url'; placeholder?: string;
  inputRef?: Ref<TextInput>; error?: string; disabled?: boolean }) {
  return <View style={{ gap: 5 }}><Text style={captureStyles.label}>{label}</Text>
    <TextInput ref={inputRef} accessibilityLabel={label} value={value} onChangeText={onChangeText} keyboardType={keyboardType}
      editable={!disabled} placeholder={placeholder} placeholderTextColor="#849e96" style={[captureStyles.field, disabled && { opacity: .58 }]} />
    {error ? <Text accessibilityRole="alert" style={captureStyles.text}>{error}</Text> : null}</View>;
}
