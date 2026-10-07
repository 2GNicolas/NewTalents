import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CustodyPassportSummary, EligibleAnalystSummary } from '../administrator-api';

export function CustodyChangeRemove({ passport, analysts, onChange, onRemove }: Readonly<{
  passport: CustodyPassportSummary;
  analysts: readonly EligibleAnalystSummary[];
  onChange: (passport: CustodyPassportSummary, analyst: EligibleAnalystSummary) => void;
  onRemove: (passport: CustodyPassportSummary) => void;
}>) {
  const [selecting, setSelecting] = useState(false);
  const assigned = passport.custody.state === 'ASSIGNED';
  const canChange = assigned && passport.capabilities.includes('CHANGE');
  const canRemove = assigned && passport.capabilities.includes('REMOVE');
  const currentAnalystId = passport.custody.state === 'ASSIGNED' ? passport.custody.analyst.identityId : undefined;
  const candidates = analysts.filter((analyst) => analyst.identityId !== currentAnalystId);

  return <View style={styles.root}>
    <Text style={styles.current}>Custodia actual: {assigned ? passport.custody.analyst.displayLabel : 'Sin asignar'}</Text>
    <View style={styles.actions}>
      <Pressable
        testID={`change-custody-${passport.passportId}`}
        accessibilityRole="button"
        accessibilityLabel={`Cambiar Analista de ${passport.displayLabel}`}
        accessibilityState={{ disabled: !canChange }}
        disabled={!canChange}
        onPress={() => setSelecting((value) => !value)}
        style={[styles.change, !canChange && styles.disabled]}
      ><Text style={styles.changeText}>Cambiar Analista</Text></Pressable>
      <Pressable
        testID={`remove-custody-${passport.passportId}`}
        accessibilityRole="button"
        accessibilityLabel={`Retirar custodia de ${passport.displayLabel}`}
        accessibilityState={{ disabled: !canRemove }}
        disabled={!canRemove}
        onPress={() => onRemove(passport)}
        style={[styles.remove, !canRemove && styles.disabled]}
      ><Text style={styles.removeText}>Retirar custodia</Text></Pressable>
    </View>
    {selecting ? <View accessibilityRole="list" style={styles.destinations}>
      {candidates.length ? candidates.map((analyst) => <Pressable
        key={analyst.identityId}
        accessibilityRole="button"
        accessibilityLabel={`Seleccionar ${analyst.displayLabel} como nueva custodia`}
        onPress={() => { setSelecting(false); onChange(passport, analyst); }}
        style={styles.destination}
      ><Text style={styles.destinationName}>{analyst.displayLabel}</Text><Text style={styles.load}>{analyst.activeCustodyCount} custodias activas</Text></Pressable>)
        : <Text accessibilityRole="alert" style={styles.empty}>No hay otro Analista elegible.</Text>}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: 7, marginTop: 8, width: '100%' },
  current: { color: '#b9cbc0', fontSize: 10, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 6 },
  change: { alignItems: 'center', backgroundColor: '#d6ff19', borderRadius: 7, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  changeText: { color: '#06120c', fontSize: 10, fontWeight: '900' },
  remove: { alignItems: 'center', borderColor: '#ff9ca4', borderRadius: 7, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  removeText: { color: '#ffd0d4', fontSize: 10, fontWeight: '800' },
  disabled: { opacity: .42 },
  destinations: { backgroundColor: 'rgba(0,18,12,.94)', borderColor: '#75e6a8', borderRadius: 8, borderWidth: 1, gap: 5, padding: 6 },
  destination: { borderBottomColor: 'rgba(117,230,168,.25)', borderBottomWidth: 1, minHeight: 44, padding: 7 },
  destinationName: { color: '#f7f8f2', fontSize: 12, fontWeight: '900' },
  load: { color: '#b9cbc0', fontSize: 10 },
  empty: { color: '#d8e4dc', fontSize: 11, padding: 8 },
});
