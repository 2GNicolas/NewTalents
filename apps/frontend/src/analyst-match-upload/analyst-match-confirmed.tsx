import { Text, View, useWindowDimensions } from 'react-native';

import type { AnalystMatchDetail } from '../analyst-workspace/analyst-workspace-api';
import type { ConfirmedUpload } from './analyst-match-upload-api';
import { CaptureFrame, captureStyles } from './analyst-match-ui';
import { complexityKeys, complexityLabels, contextKeys, contextLabels, eventLabels } from './analyst-match-upload-state';

type Props = Readonly<{ match: AnalystMatchDetail; upload: ConfirmedUpload; onBack?: () => void;
  onNavigate?: (destination: 'Inicio' | 'Pasaportes' | 'Partidos') => void }>;
const valueLabels: Record<string, string> = { NONE: 'Inexistente', LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta',
  VERY_HIGH: 'Muy alta', YES: 'Sí', NO: 'No', SUCCESS: 'Exitoso', FAILURE: 'Fallido',
  POOR_CONTROL: 'Control deficiente', SAVED: 'Detenido', BLOCKED: 'Bloqueado', WIDE: 'Fuera',
  WOODWORK: 'Al poste/travesaño', DANGEROUS_REBOUND: 'Rebote peligroso',
  DOMINANT: 'Dominante', NON_DOMINANT: 'No dominante', BOTH: 'Ambas', NO_HANDS: 'Sin manos' };

function describeObservation(value: unknown): string {
  if (!value || typeof value !== 'object') return 'No observable';
  const observation = value as { status?: string; value?: string };
  if (observation.status === 'OBSERVED') return observation.value ? valueLabels[observation.value] ?? observation.value : 'No observable';
  if (observation.status === 'NOT_APPLICABLE') return 'No aplica';
  return 'No observable';
}

export function AnalystMatchConfirmedView({ match, upload, onBack, onNavigate }: Props) {
  const { width } = useWindowDimensions();
  return <CaptureFrame match={match} step="confirmed" onBack={onBack} onNavigate={onNavigate}>
    <Text accessibilityRole="header" style={captureStyles.title}>Carga confirmada</Text>
    <Text style={captureStyles.subtitle}>Datos privados del partido. La carga no completa una evaluación FEM ni un Análisis realizado.</Text>
    <View style={[captureStyles.split, width >= 900 && { flexDirection: 'row', alignItems: 'flex-start' }]}>
      <View style={[captureStyles.panel, width >= 900 && { flex: 1 }]}>
        <Text accessibilityRole="header" style={captureStyles.section}>Participación y video</Text>
        <Text style={captureStyles.text}>{upload.participation === 'DID_NOT_PARTICIPATE' ? 'No participó' : 'Participó'}</Text>
        <Text style={captureStyles.text}>{upload.totalMinutesPlayed} minutos jugados, incluido tiempo añadido</Text>
        <Text style={captureStyles.label}>Enlace de YouTube del partido</Text>
        <Text selectable style={captureStyles.text}>{upload.youtubeUrl}</Text>
        <Text style={captureStyles.text}>El enlace no se publica automáticamente en el pasaporte.</Text>
      </View>
      <View style={[captureStyles.panel, width >= 900 && { flex: 1 }]}>
        <Text accessibilityRole="header" style={captureStyles.section}>Eventos capturados · {upload.events.length}</Text>
        {upload.participation === 'DID_NOT_PARTICIPATE' ? <Text style={captureStyles.text}>Sin eventos; no participó.</Text> : null}
        {upload.events.map((event) => <View key={event.sequence} style={captureStyles.panel}>
          <Text accessibilityRole="header" style={captureStyles.section}>
            {event.videoMinute}′ · {eventLabels[event.eventType as keyof typeof eventLabels] ?? event.eventType}
          </Text>
          {event.eventType !== 'GOAL' && event.eventType !== 'ASSIST'
            ? <Text style={captureStyles.text}>Resultado: {event.result === 'NONE' ? 'Sin resultado' : valueLabels[event.result] ?? event.result}</Text> : null}
          {event.variant ? <Text style={captureStyles.text}>Variante: {event.variant === 'THROUGH' ? 'Filtrado' : 'Normal'}</Text> : null}
          {event.eventType !== 'GOAL' && event.eventType !== 'ASSIST' && event.result !== 'FAILURE' ? <>
            {contextKeys.map((key) => <Text key={key} style={captureStyles.text}>
              {contextLabels[key]}: {describeObservation(event.context[key])}</Text>)}
            {complexityKeys.map((key) => <Text key={key} style={captureStyles.text}>
              {complexityLabels[key]}: {describeObservation(event.complexity[key])}</Text>)}
          </> : null}
          {event.observation ? <Text style={captureStyles.text}>Observación: {event.observation}</Text> : null}
        </View>)}
      </View>
    </View>
  </CaptureFrame>;
}
