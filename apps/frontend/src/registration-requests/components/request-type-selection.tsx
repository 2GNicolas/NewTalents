import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { authTokens } from '../../design/tokens';
import type { RegistrationDraft } from '../registration-request-api';
import { Actions, JourneyShell, Notice } from './registration-journey';

type InitialRequestType = RegistrationDraft['type'];

const choices: readonly Readonly<{ type: InitialRequestType; category: 'Personal' | 'Academia'; label: string; description: string; announcement: string }>[] = [
  { type: 'PERSONAL_ADULT', category: 'Personal', label: 'Para mí', description: 'Crearé mi cuenta y mi pasaporte deportivo básico.', announcement: 'Solicitud personal para adulto' },
  { type: 'REPRESENTED_MINOR', category: 'Personal', label: 'Para un menor que represento', description: 'El menor no tendrá cuenta. Gestionaré su solicitud como representante.', announcement: 'Solicitud personal para menor representado' },
  { type: 'FORMAL_ACADEMY', category: 'Academia', label: 'Academia formal', description: 'Organización constituida con identificación tributaria.', announcement: 'Solicitud de academia formal' },
  { type: 'NATURAL_PERSON_ACADEMY', category: 'Academia', label: 'Academia operada por persona natural', description: 'Actividad gestionada directamente por una persona responsable.', announcement: 'Solicitud de academia operada por persona natural' },
] as const;

export function RequestTypeSelection({ onContinue, onBack }: Readonly<{ onContinue: (type: InitialRequestType) => void; onBack?: () => void }>) {
  const [category, setCategory] = useState<'Personal' | 'Academia'>('Personal');
  const [selected, setSelected] = useState<InitialRequestType>('REPRESENTED_MINOR');
  const { width } = useWindowDimensions();
  const desktop = width >= authTokens.breakpoints.desktop;
  const selectedChoice = choices.find((choice) => choice.type === selected)!;
  const selectCategory = (nextCategory: 'Personal' | 'Academia') => {
    setCategory(nextCategory);
    setSelected(nextCategory === 'Personal' ? 'REPRESENTED_MINOR' : 'FORMAL_ACADEMY');
  };
  return <JourneyShell steps={[{ label: 'Cuenta', state: 'current' }, { label: 'Identidad', state: 'pending' }, { label: 'Documentos', state: 'pending' }, { label: 'Consentimiento', state: 'pending' }, { label: 'Envío', state: 'pending' }]} title="Solicitud de registro" subtitle="¿A quién vas a registrar?">
    <Text style={styles.intro}>Selecciona una opción para preparar los datos y documentos correctos.</Text>
    <View accessibilityLabel="Categoría de solicitud" style={styles.categoryTabs}>
      {(['Personal', 'Academia'] as const).map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: category === item }} onPress={() => selectCategory(item)} style={[styles.categoryTab, category === item && styles.categoryTabSelected]}><Text style={[styles.categoryTitle, category === item && styles.categoryTitleSelected]}>{item}</Text></Pressable>)}
    </View>
    <View style={styles.category}>
      <View style={[styles.choiceGrid, desktop && styles.choiceGridDesktop]}>{choices.filter((choice) => choice.category === category).map((choice) => {
        const active = choice.type === selected;
        return <Pressable key={choice.type} accessibilityLabel={choice.label} accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={() => setSelected(choice.type)} style={({ pressed }) => [styles.typeCard, active && styles.typeCardSelected, pressed && styles.typeCardPressed]}>
          <View style={[styles.typeIcon, active && styles.typeIconSelected]}><Text style={styles.typeIconText}>{category === 'Personal' ? '○' : '◇'}</Text></View>
          <View style={styles.typeCopy}><Text style={styles.typeLabel}>{choice.label}</Text><Text style={styles.typeDescription}>{choice.description}</Text></View>
          <View style={[styles.radio, active && styles.radioSelected]} />
        </Pressable>;
      })}</View>
    </View>
    <Text accessibilityLiveRegion="polite" style={styles.announcement}>{selectedChoice.announcement}</Text>
    <Actions primaryLabel="Continuar" onBack={onBack} onPrimary={() => onContinue(selected)} secondaryLabel="Volver al inicio" />
    <View style={styles.finalNotice}><Notice>Revisión final por un Administrador de New Talents.</Notice></View>
  </JourneyShell>;
}

const styles = StyleSheet.create({
  intro: { color: authTokens.colors.textSecondary, fontSize: 17, lineHeight: 25, marginTop: 8 },
  categoryTabs: { flexDirection: 'row', gap: 24, marginTop: 24 },
  categoryTab: { borderBottomColor: 'transparent', borderBottomWidth: 2, paddingBottom: 7 },
  categoryTabSelected: { borderBottomColor: authTokens.colors.primary },
  category: { gap: 12, marginTop: 18 },
  categoryTitle: { color: authTokens.colors.textPrimary, fontSize: 22, fontWeight: '900' },
  categoryTitleSelected: { color: authTokens.colors.primary },
  choiceGrid: { gap: 14 },
  choiceGridDesktop: { flexDirection: 'row' },
  typeCard: { alignItems: 'center', backgroundColor: 'rgba(4,35,24,.58)', borderColor: 'rgba(210,255,226,.34)', borderRadius: 14, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 16, minHeight: 126, padding: 20 },
  typeCardSelected: { backgroundColor: 'rgba(199,255,46,.13)', borderColor: authTokens.colors.primary, borderWidth: 2 },
  typeCardPressed: { opacity: .86 },
  typeIcon: { alignItems: 'center', borderColor: authTokens.colors.border, borderRadius: 28, borderWidth: 1, height: 56, justifyContent: 'center', width: 56 },
  typeIconSelected: { borderColor: authTokens.colors.primary },
  typeIconText: { color: authTokens.colors.textPrimary, fontSize: 30 },
  typeCopy: { flex: 1, gap: 6 },
  typeLabel: { color: authTokens.colors.textPrimary, fontSize: 18, fontWeight: '900' },
  typeDescription: { color: authTokens.colors.textSecondary, fontSize: 14, lineHeight: 20 },
  radio: { borderColor: authTokens.colors.textSecondary, borderRadius: 12, borderWidth: 2, height: 24, width: 24 },
  radioSelected: { backgroundColor: authTokens.colors.primary, borderColor: authTokens.colors.primary },
  announcement: { color: authTokens.colors.primary, fontSize: 15, fontWeight: '800', marginTop: 18 },
  finalNotice: { marginTop: 4 },
});
