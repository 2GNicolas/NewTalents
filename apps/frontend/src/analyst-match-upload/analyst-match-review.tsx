import { Text, View, useWindowDimensions } from 'react-native';

import type { AnalystMatchDetail } from '../analyst-workspace/analyst-workspace-api';
import { chronologicalCapturedEvents } from './analyst-match-chronology';
import { CaptureButton, CaptureFrame, captureStyles } from './analyst-match-ui';
import { type AnalystMatchCaptureState, type CaptureState, complexityKeys, complexityLabels,
  contextKeys, contextLabels, eventLabels } from './analyst-match-upload-state';

type Props = { match: AnalystMatchDetail; state: CaptureState; machine: AnalystMatchCaptureState; onBack?: () => void;
  onNavigate?: (destination: 'Inicio' | 'Pasaportes' | 'Partidos') => void };
const valueLabels: Record<string, string> = { NONE: 'Inexistente', LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta',
  VERY_HIGH: 'Muy alta', YES: 'Sí', NO: 'No', SUCCESS: 'Exitoso', FAILURE: 'Fallido',
  POOR_CONTROL: 'Control deficiente', SAVED: 'Detenido', BLOCKED: 'Bloqueado', WIDE: 'Fuera',
  WOODWORK: 'Al poste/travesaño', DANGEROUS_REBOUND: 'Rebote peligroso',
  DOMINANT: 'Dominante', NON_DOMINANT: 'No dominante', BOTH: 'Ambas', NO_HANDS: 'Sin manos' };
const observationText = (observation: { status: string; value?: string }) => observation.status === 'OBSERVED'
  ? (observation.value ? valueLabels[observation.value] ?? observation.value : 'Pendiente de corregir')
    : observation.status === 'NOT_APPLICABLE' ? 'No aplica'
    : observation.status === 'NOT_OBSERVABLE' ? 'No observable' : 'Pendiente de corregir';

export function AnalystMatchReviewView({ match, state, machine, onBack, onNavigate }: Props) {
  const { width } = useWindowDimensions();
  return <CaptureFrame match={match} step="review" onBack={onBack} onNavigate={onNavigate}>
    <Text accessibilityRole="header" aria-level={1} style={captureStyles.title}>Revisar eventos</Text>
    <Text style={captureStyles.subtitle}>Verifica jugador, partido y minuto; cuando corresponda, contexto y complejidad.</Text>
    <View style={[captureStyles.split, width >= 900 && { flexDirection: 'row', alignItems: 'flex-start' }]}>
      <View style={[captureStyles.panel, width >= 900 && { flex: 1 }]}>
        <Text accessibilityRole="header" aria-level={2} style={captureStyles.section}>Eventos capturados · {state.events.length}</Text>
        {state.participation === 'DID_NOT_PARTICIPATE' ? <Text style={captureStyles.text}>No participó; sin eventos.</Text> : null}
        {chronologicalCapturedEvents(state.events).map(({ event, index }) => <View key={index} style={[captureStyles.panel, { backgroundColor: '#00261c' }]}>
          <Text accessibilityRole="header" aria-level={3} style={captureStyles.section}>{event.videoMinute || 'Minuto pendiente'}′ · {event.eventType ? eventLabels[event.eventType] : 'Evento sin tipo'}</Text>
          {event.eventType !== 'GOAL' && event.eventType !== 'ASSIST'
            ? <Text style={captureStyles.text}>Resultado: {event.result === 'NONE' ? 'Sin resultado' : valueLabels[event.result ?? ''] ?? event.result}</Text> : null}
          {event.variant ? <Text style={captureStyles.text}>Variante: {event.variant === 'THROUGH' ? 'Filtrado' : 'Normal'}</Text> : null}
          {event.eventType !== 'GOAL' && event.eventType !== 'ASSIST' && event.result !== 'FAILURE' ? <>
            <Text style={captureStyles.label}>Contexto del evento</Text>
            {contextKeys.map((key) => <Text key={key} style={captureStyles.text}>{contextLabels[key]}: {observationText(event.context[key])}</Text>)}
            <Text style={captureStyles.label}>Complejidad de la acción</Text>
            {complexityKeys.map((key) => <Text key={key} style={captureStyles.text}>{complexityLabels[key]}: {observationText(event.complexity[key])}</Text>)}
          </> : null}
          {event.eventType === 'SAVE' && event.result !== 'FAILURE' ? <Text style={captureStyles.text}>Mano usada: {observationText(event.goalkeeperDetail.handUsed)} · Mano cambiada: {observationText(event.goalkeeperDetail.handChanged)}</Text> : null}
          {event.observation ? <Text style={captureStyles.text}>Observación: {event.observation}</Text> : null}
          <CaptureButton label={`Corregir evento ${index + 1}`} onPress={() => machine.editSaved(index)} />
        </View>)}
        <View style={captureStyles.row}>
          <CaptureButton label="Volver a captura" onPress={() => machine.backToCapture()} />
          <CaptureButton label="Continuar a datos finales" onPress={() => machine.toFinal()} />
        </View>
      </View>
      <View style={[captureStyles.panel, width >= 900 && { width: 270 }]}>
        <Text accessibilityRole="header" aria-level={2} style={captureStyles.section}>Resumen de captura</Text>
        <Text style={captureStyles.text}>{state.events.length} {state.events.length === 1 ? 'evento' : 'eventos'} · {state.participation === 'PARTICIPATED' ? 'Participó' : 'No participó'}</Text>
        <Text style={captureStyles.text}>{match.playerName} · {match.maskedReference}</Text>
        <Text style={captureStyles.text}>vs. {match.opponent}</Text>
        <Text style={captureStyles.text}>Sin puntos ni ratings en esta etapa.</Text>
      </View>
    </View>
  </CaptureFrame>;
}
