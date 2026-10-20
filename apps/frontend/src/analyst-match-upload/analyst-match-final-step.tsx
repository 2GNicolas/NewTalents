import { useEffect, useRef } from 'react';
import { Text, TextInput, View, useWindowDimensions } from 'react-native';

import type { AnalystMatchDetail } from '../analyst-workspace/analyst-workspace-api';
import { CaptureButton, CaptureFrame, CaptureInput, captureStyles } from './analyst-match-ui';
import type { AnalystMatchCaptureState, CaptureState } from './analyst-match-upload-state';

type Props = { match: AnalystMatchDetail; state: CaptureState; machine: AnalystMatchCaptureState; onBack?: () => void;
  onNavigate?: (destination: 'Inicio' | 'Pasaportes' | 'Partidos') => void };

function validVideoLink(value: string): boolean {
  if (!value || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    if (host === 'youtu.be') return /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
    if (host !== 'youtube.com' && !host.endsWith('.youtube.com')) return false;
    if (url.pathname === '/watch') return /^[A-Za-z0-9_-]+$/.test(url.searchParams.get('v') ?? '');
    return /^\/(?:shorts|embed|live)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
  } catch { return false; }
}

export function AnalystMatchFinalStep({ match, state, machine, onBack, onNavigate }: Props) {
  const { width } = useWindowDimensions();
  const minutesRef = useRef<TextInput>(null);
  const videoRef = useRef<TextInput>(null);
  const total = state.final.totalMinutesPlayed.trim();
  const invalidMinutes = !/^\d+$/.test(total) || !Number.isSafeInteger(Number(total))
    || (state.participation === 'PARTICIPATED' && Number(total) === 0)
    || (state.participation === 'DID_NOT_PARTICIPATE' && Number(total) !== 0);
  const invalidVideo = !validVideoLink(state.final.youtubeUrl.trim());
  useEffect(() => {
    if (state.finalError !== 'validation') return;
    if (invalidMinutes) minutesRef.current?.focus();
    else if (invalidVideo) videoRef.current?.focus();
  }, [state.finalError, invalidMinutes, invalidVideo]);
  return <CaptureFrame match={match} step="final" onBack={onBack} onNavigate={onNavigate}>
    {state.confirmation ? <View style={captureStyles.panel}>
      <Text accessibilityRole="header" aria-level={1} style={captureStyles.title}>Carga confirmada</Text>
      <Text style={captureStyles.text}>Los datos del partido se cargaron. Primer partido: LOADED/USED.</Text>
      <Text style={captureStyles.text}>Esta carga no completa una evaluación FEM ni crea un Análisis realizado.</Text>
    </View> : <>
    <Text accessibilityRole="header" aria-level={1} style={captureStyles.title}>Completar datos finales</Text>
    <Text style={captureStyles.subtitle}>Revisa la participación registrada y vincula el video antes de confirmar la carga.</Text>
    <View style={[captureStyles.split, width >= 900 && { flexDirection: 'row', alignItems: 'flex-start' }]}>
      <View style={[captureStyles.panel, width >= 900 && { flex: 1 }]}>
        <Text accessibilityRole="header" aria-level={2} style={captureStyles.section}>Participación del jugador</Text>
        <Text style={captureStyles.text}>{state.participation === 'PARTICIPATED' ? 'Participó' : 'No participó'}</Text>
        <CaptureInput label="Total de minutos jugados" value={state.final.totalMinutesPlayed} inputRef={minutesRef}
          error={state.finalError === 'validation' && invalidMinutes ? 'Introduce un total entero coherente con la participación.' : undefined}
          onChangeText={(totalMinutesPlayed) => machine.setFinal({ totalMinutesPlayed })} keyboardType="number-pad" />
        <Text style={captureStyles.text}>Minutos enteros, incluido tiempo añadido; sin tope fijo de 90. Cero solo si no participó.</Text>
        <CaptureInput label="Enlace de YouTube" value={state.final.youtubeUrl} inputRef={videoRef}
          error={state.finalError === 'validation' && invalidVideo ? 'Introduce un enlace HTTPS de video de YouTube.' : undefined}
          onChangeText={(youtubeUrl) => machine.setFinal({ youtubeUrl })} keyboardType="url" placeholder="https://youtu.be/..." />
        <Text style={captureStyles.text}>El formato no verifica disponibilidad ni publica automáticamente el enlace.</Text>
        <View style={captureStyles.row}><CaptureButton label="Volver a revisión" onPress={() => machine.backToReview()} /></View>
        {state.finalError ? <Text accessibilityRole="alert" style={captureStyles.text}>
          {state.finalError === 'validation' ? 'Revisa participación, minutos, enlace y eventos; conservamos los datos para corregir.'
            : state.finalError === 'conflict' ? 'El partido cambió. Consulta su estado antes de volver a confirmar.'
              : 'No se pudo confirmar. Conservamos los datos para reintentar.'}
        </Text> : null}
        <CaptureButton label={state.confirming ? 'Confirmando carga' : 'Confirmar carga'}
          disabled={state.confirming || state.finalError === 'conflict'}
          onPress={() => { void machine.confirm(); }} />
      </View>
      <View style={[captureStyles.panel, width >= 900 && { width: 270 }]}>
        <Text accessibilityRole="header" aria-level={2} style={captureStyles.section}>Resumen antes de confirmar</Text>
        <Text style={captureStyles.text}>{match.playerName} · {match.maskedReference}</Text>
        <Text style={captureStyles.text}>vs. {match.opponent}</Text>
        <Text style={captureStyles.text}>{state.events.length} {state.events.length === 1 ? 'evento revisado' : 'eventos revisados'}</Text>
        <Text style={captureStyles.text}>{state.participation === 'PARTICIPATED' ? 'Participó' : 'No participó'}</Text>
        <Text style={captureStyles.text}>No completa una evaluación FEM.</Text>
      </View>
    </View></>}
  </CaptureFrame>;
}
