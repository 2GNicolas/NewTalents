import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import type { FirstMatchAvailability, ScheduleFields } from './first-match-api';
import { FIRST_MATCH_NOTICES, type FirstMatchNotice } from './first-match-state';
import { FirstMatchHero, FirstMatchSurface, FirstMatchTitle, firstMatchColors } from './first-match-surface';

type Field = keyof ScheduleFields;
const labels: Record<Field, string> = {
  matchDate: 'Fecha', matchTime: 'Hora', opponent: 'Rival', competition: 'Competición', venue: 'Lugar',
};
const requiredMessages: Record<Field, string> = {
  matchDate: 'La fecha es obligatoria.', matchTime: 'La hora es obligatoria.',
  opponent: 'El rival es obligatorio.', competition: 'La competición es obligatoria.', venue: 'El lugar es obligatorio.',
};
const requiredAccessibleLabels: Record<Field, string> = {
  matchDate: 'Fecha obligatoria', matchTime: 'Hora obligatoria', opponent: 'Rival obligatorio',
  competition: 'Competición obligatoria', venue: 'Lugar obligatorio',
};
const initial: ScheduleFields = { matchDate: '', matchTime: '', opponent: '', competition: '', venue: '' };
const dateValid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
  && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

export function FirstMatchForm({ passportId, availability, notice, submitting, onDateChange, onSubmit, onDiscard,
  mode = 'schedule', initialFields, currentMatchDate, viewportWidth }: {
  passportId: string; availability: FirstMatchAvailability | null; notice?: FirstMatchNotice;
  submitting: boolean; onDateChange: (date: string) => void;
  onSubmit: (fields: ScheduleFields) => void; onDiscard: () => void; viewportWidth?: number;
  mode?: 'schedule' | 'reschedule'; initialFields?: ScheduleFields; currentMatchDate?: string;
}) {
  const { width } = useWindowDimensions();
  const desktop = (viewportWidth ?? width) >= 1024;
  // Match summaries also carry id/version/state. Never leak those into the strict command body.
  const [fields, setFields] = useState<ScheduleFields>(() => initialFields ? {
    matchDate: initialFields.matchDate, matchTime: initialFields.matchTime,
    opponent: initialFields.opponent, competition: initialFields.competition, venue: initialFields.venue,
  } : initial);
  const inputRefs = useRef<Partial<Record<Field, TextInput | null>>>({});
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const set = (field: Field, value: string) => {
    setFields((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (field === 'matchDate') onDateChange(value);
  };
  const submit = () => {
    const next: Partial<Record<Field, string>> = {};
    for (const field of Object.keys(labels) as Field[]) {
      if (!fields[field].trim()) next[field] = requiredMessages[field];
      else if (fields[field].length > 160 && !['matchDate', 'matchTime'].includes(field)) next[field] = 'Máximo 160 caracteres.';
    }
    if (fields.matchDate && !dateValid(fields.matchDate)) next.matchDate = 'Usa una fecha válida AAAA-MM-DD.';
    if (fields.matchTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(fields.matchTime)) next.matchTime = 'Usa una hora válida HH:mm.';
    setErrors(next);
    if (Object.keys(next).length) {
      const firstInvalid = (Object.keys(next) as Field[])[0];
      if (firstInvalid) inputRefs.current[firstInvalid]?.focus();
      return;
    }
    if (!hasCapacity) return;
    onSubmit(fields);
  };
  const field = (name: Field, placeholder: string) => <View key={name} style={styles.field}>
    <Text style={styles.label}>{labels[name]} <Text style={styles.required}>*</Text></Text>
    <TextInput ref={(node) => { inputRefs.current[name] = node; }}
      accessibilityLabel={`${requiredAccessibleLabels[name]}${errors[name] ? `. ${errors[name]}` : ''}`} accessibilityHint={errors[name]}
      accessibilityState={{ disabled: submitting }} editable={!submitting} autoCorrect={false}
      maxLength={name === 'matchDate' ? 10 : name === 'matchTime' ? 5 : 160}
      placeholder={placeholder} placeholderTextColor="#8EA9A4" value={fields[name]}
      onChangeText={(value) => set(name, value)} style={[styles.input, errors[name] && styles.inputError]}
      testID={`first-match-field-${name}`} />
    {errors[name] ? <Text accessibilityRole="alert" accessibilityLabel={errors[name]} style={styles.error}>{errors[name]}</Text> : null}
  </View>;
  const available = availability?.matchDate === fields.matchDate && availability.configured;
  const samePeriod = mode === 'reschedule' && !!currentMatchDate && !!availability?.periodStart
    && !!availability.periodEndExclusive && currentMatchDate >= availability.periodStart
    && currentMatchDate < availability.periodEndExclusive;
  const effectiveAvailable = (availability?.available ?? 0) + (samePeriod ? 1 : 0);
  const hasCapacity = available && effectiveAvailable > 0;
  return <FirstMatchSurface screen="form" viewportWidth={viewportWidth}>
    {!desktop ? <FirstMatchHero screen="form" viewportWidth={viewportWidth} /> : null}
    <FirstMatchTitle prefix={mode === 'reschedule' ? 'Reagendar primer ' : 'Agendar primer '} accent="partido" />
    <Text style={styles.subtitle}>Completa la información del partido para iniciar el proceso de análisis.</Text>
    <View style={[styles.columns, desktop && styles.columnsDesktop]} testID={desktop ? 'first-match-form-columns' : 'first-match-form-stack'}>
      <View style={styles.card}>
        <View style={[styles.dateTime, desktop && styles.dateTimeDesktop]}>
          {field('matchDate', 'AAAA-MM-DD')}{field('matchTime', 'HH:mm')}
        </View>
        {field('opponent', 'Nombre del rival')}{field('competition', 'Competición')}{field('venue', 'Lugar del partido')}
        <View style={styles.info}><Text style={styles.infoText}>Agendado por una cuenta autorizada. El pasaporte es {passportId.slice(0, 8)}…</Text></View>
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.cardTitle}>{mode === 'reschedule' ? 'Confirma el cambio' : 'Confirma el partido'}</Text>
        <Text style={styles.muted}>Revisa la información antes de confirmar.</Text>
        <View style={styles.summary}>{(Object.keys(labels) as Field[]).map((name) =>
          <View key={name} style={styles.summaryRow}><Text style={styles.muted}>{labels[name]}</Text><Text style={styles.summaryValue}>{fields[name] || '—'}</Text></View>)}</View>
        <View style={styles.availability} accessibilityLiveRegion="polite">
          {!fields.matchDate ? <Text style={styles.muted}>Elige una fecha para consultar su cupo.</Text>
            : !dateValid(fields.matchDate) ? <Text style={styles.muted}>Ingresa una fecha válida para consultar el cupo.</Text>
              : !availability || availability.matchDate !== fields.matchDate ? <Text style={styles.muted}>Consultando cupos…</Text>
                : !availability.configured ? <Text style={styles.error}>No hay cupo configurado para esa fecha.</Text>
                  : <Text style={styles.muted}>Impacto en cupos · {mode === 'reschedule' ? 'Se conserva una sola unidad del partido.' : 'Usará 1 cupo.'} Quedarán {Math.max(0, effectiveAvailable - 1)} de {availability.limit} en el período. Reservados: {availability.reserved}; usados: {availability.used}.</Text>}
          {available && !hasCapacity ? <Text style={styles.error}>El período no tiene cupos disponibles.</Text> : null}
        </View>
        <View style={styles.info}><Text style={styles.infoText}>{mode === 'reschedule'
          ? 'Al confirmar, se actualizarán este mismo partido y su cupo. La asignación de Analista es un paso independiente.'
          : 'Al confirmar, el partido quedará agendado sin aprobación administrativa. La asignación de Analista es un paso independiente.'}</Text></View>
        {notice ? <Text accessibilityRole="alert" style={styles.error}>{FIRST_MATCH_NOTICES[notice]}</Text> : null}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancelar formulario" onPress={onDiscard}
            disabled={submitting} style={styles.secondaryButton}><Text style={styles.secondaryText}>Cancelar</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={mode === 'reschedule' ? 'Confirmar reagendamiento' : 'Confirmar agendamiento'} onPress={submit}
            accessibilityState={{ disabled: submitting, busy: submitting }}
            disabled={submitting} style={[styles.primaryButton, submitting && styles.disabled]}>
            <Text style={styles.primaryText}>{submitting ? 'Confirmando…' : mode === 'reschedule' ? 'Confirmar reagendamiento' : 'Confirmar agendamiento'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </FirstMatchSurface>;
}

const styles = StyleSheet.create({
  subtitle: { color: firstMatchColors.muted, fontSize: 18, textAlign: 'center' },
  columns: { gap: 18, marginTop: 14, width: '100%' },
  columnsDesktop: { flexDirection: 'row' },
  card: { borderColor: firstMatchColors.border, borderRadius: 15, borderWidth: 1, flex: 1,
    gap: 13, minWidth: 0, padding: 20 },
  dateTime: { gap: 12 }, dateTimeDesktop: { flexDirection: 'row' },
  field: { flex: 1, gap: 6, minWidth: 0 },
  label: { color: firstMatchColors.white, fontSize: 15, fontWeight: '700' }, required: { color: '#FF5C55' },
  input: { backgroundColor: firstMatchColors.field, borderColor: firstMatchColors.border, borderRadius: 8,
    borderWidth: 1, color: firstMatchColors.white, fontSize: 16, minHeight: 48, paddingHorizontal: 14 },
  inputError: { borderColor: '#FF826D' }, error: { color: '#FFB0A1', fontSize: 14 },
  info: { backgroundColor: 'rgba(0, 40, 29, 0.68)', borderColor: firstMatchColors.border, borderRadius: 9,
    borderWidth: 1, padding: 14 }, infoText: { color: firstMatchColors.white, fontSize: 13, lineHeight: 19 },
  cardTitle: { color: firstMatchColors.white, fontSize: 24, fontWeight: '800' },
  muted: { color: firstMatchColors.muted, fontSize: 14 },
  summary: { gap: 10, marginVertical: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14 },
  summaryValue: { color: firstMatchColors.white, flex: 1, fontSize: 14, textAlign: 'right' },
  availability: { borderColor: firstMatchColors.border, borderTopWidth: 1, gap: 4, paddingTop: 14 },
  actions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end', marginTop: 4 },
  secondaryButton: { alignItems: 'center', borderColor: firstMatchColors.border, borderRadius: 10,
    borderWidth: 1, justifyContent: 'center', minHeight: 52, paddingHorizontal: 20 },
  secondaryText: { color: firstMatchColors.white, fontWeight: '700' },
  primaryButton: { alignItems: 'center', backgroundColor: firstMatchColors.lime, borderRadius: 10,
    justifyContent: 'center', minHeight: 52, paddingHorizontal: 20 },
  primaryText: { color: '#06160F', fontWeight: '800' }, disabled: { opacity: 0.55 },
});
