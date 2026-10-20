import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';

import type { AnalystMatchDetail } from '../analyst-workspace/analyst-workspace-api';
import { AnalystEventWheel, type WheelAnchor } from './analyst-event-wheel';
import { contextChoices, temporalHelp, temporalShortLabel } from './analyst-match-choice-catalog';
import { chronologicalCapturedEvents } from './analyst-match-chronology';
import { CaptureButton, CaptureChoice, CaptureEventButton, CaptureFrame, CaptureIconButton, CaptureInput, captureColors, captureStyles } from './analyst-match-ui';
import { type AnalystMatchCaptureState, type CaptureState, type ComplexityKey, type ContextKey, type Observation,
  completeEvent, firstCaptureIssue, complexityKeys, complexityLabels, contextKeys, contextLabels, eventLabels, resultsByType } from './analyst-match-upload-state';

type Props = { match: AnalystMatchDetail; state: CaptureState; machine: AnalystMatchCaptureState; onBack?: () => void;
  onNavigate?: (destination: 'Inicio' | 'Pasaportes' | 'Partidos') => void };
const levels = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];
const valueLabels: Record<string, string> = { NONE: 'Inexistente', LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', VERY_HIGH: 'Muy alta',
  YES: 'Sí', NO: 'No', SUCCESS: 'Exitoso', FAILURE: 'Fallido', POOR_CONTROL: 'Control deficiente', SAVED: 'Detenido',
  BLOCKED: 'Bloqueado', WIDE: 'Fuera', WOODWORK: 'Al poste/travesaño', DANGEROUS_REBOUND: 'Rebote peligroso',
  DOMINANT: 'Dominante', NON_DOMINANT: 'No dominante', BOTH: 'Ambas', NO_HANDS: 'Sin manos' };
const display = (value: string) => valueLabels[value] ?? value;
const selected = (item: Observation, value: string) => item.status === 'OBSERVED' && item.value === value;
const answered = (item: Observation) => item.status === 'NOT_OBSERVABLE' || item.status === 'NOT_APPLICABLE'
  || (item.status === 'OBSERVED' && item.value.trim().length > 0);

function GroupProgress({ labels, shortLabels, observations, active, offset, machine }: { labels: readonly string[];
  shortLabels?: readonly string[];
  observations: readonly Observation[]; active: number; offset: number; machine: AnalystMatchCaptureState }) {
  return <View style={{ flexDirection: 'row', marginTop: 5, marginBottom: 4, position: 'relative' }} accessibilityLabel="Progreso de captura">
    <View pointerEvents="none" style={{ position: 'absolute', left: '5%', right: '5%', top: 13, height: 2,
      backgroundColor: captureColors.borderBright }} />
    {labels.map((label, index) => {
      const done = answered(observations[index]!);
      const selectedGroup = active === offset + index;
      const available = machine.canNavigateToGroup(offset + index);
      return <Pressable key={label} accessibilityRole="button" accessibilityLabel={`Progreso: ${label}`}
        accessibilityHint={!available ? 'Responde primero los grupos anteriores' : done ? 'Respondido; activar para corregir' : 'Sin respuesta; activar para responder'}
        accessibilityState={{ selected: selectedGroup, disabled: !available }} disabled={!available}
        onPress={() => machine.setGroup(offset + index)}
        style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 5, outlineColor: captureColors.lime }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2,
          borderColor: selectedGroup ? captureColors.lime : done ? captureColors.aqua : captureColors.borderBright,
          backgroundColor: selectedGroup ? '#203912' : done ? '#0d5748' : '#002019', alignItems: 'center', justifyContent: 'center' }}>
          {done ? <Text style={{ color: selectedGroup ? captureColors.lime : captureColors.aqua, fontWeight: '800' }}>✓</Text> : null}
        </View>
        <Text numberOfLines={2} style={{ color: selectedGroup ? captureColors.lime : available ? captureColors.white : captureColors.muted,
          textAlign: 'center', fontSize: 11, lineHeight: 13 }}>{shortLabels?.[index] ?? label}</Text>
      </Pressable>;
    })}
  </View>;
}

function ChoiceRail({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'stretch', marginTop: 8 }} accessibilityRole="radiogroup">
    {children}
  </View>;
}

export function AnalystMatchCaptureView({ match, state, machine, onBack, onNavigate }: Props) {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const wheelButton = useRef<View>(null);
  const minuteInput = useRef<TextInput>(null);
  const periodInput = useRef<TextInput>(null);
  const addedTimeInput = useRef<TextInput>(null);
  const [anchor, setAnchor] = useState<WheelAnchor | null>(null);
  const focusWheelButton = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.querySelector('[data-testid="event-wheel-anchor"]') as HTMLElement | null)?.focus();
    } else (wheelButton.current as unknown as { focus?: () => void } | null)?.focus?.();
  };
  const openWheel = () => {
    const target = wheelButton.current as unknown as { measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void } | null;
    target?.measureInWindow?.((x, y, measuredWidth, measuredHeight) => setAnchor({ x, y, width: measuredWidth, height: measuredHeight }));
    machine.openWheel();
  };
  const returnWheelFocus = () => { setTimeout(focusWheelButton, Platform.OS === 'web' ? 230 : 0); };
  const closeWheel = () => { machine.closeWheel(); returnWheelFocus(); };
  const revealSaved = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined')
      setTimeout(() => document.querySelector('[data-testid="captured-events-list"]')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 0);
  };
  const saveEvent = () => { if (machine.saveEvent()) revealSaved(); };
  const draft = state.draft;
  const group = state.activeGroup;
  const contextKey: ContextKey | null = group < contextKeys.length ? contextKeys[group]! : null;
  const complexityKey: ComplexityKey | null = group >= contextKeys.length ? complexityKeys[group - contextKeys.length]! : null;
  const currentContext = contextKey && draft ? draft.context[contextKey] : null;
  const currentComplexity = complexityKey && draft ? draft.complexity[complexityKey] : null;
  const noMeasurements = draft?.eventType === 'GOAL' || draft?.eventType === 'ASSIST' || draft?.result === 'FAILURE';
  const allChoicesAnswered = noMeasurements || (draft && contextKeys.every((key) => answered(draft.context[key]))
    && complexityKeys.every((key) => answered(draft.complexity[key])));
  const issue = state.captureIssue ?? (allChoicesAnswered && draft?.eventType && draft.result ? firstCaptureIssue(draft) : null);
  useEffect(() => {
    if (!issue || Platform.OS !== 'web') return;
    const timer = setTimeout(() => {
      if (issue.field === 'videoMinute') minuteInput.current?.focus();
      else if (issue.field === 'period') periodInput.current?.focus();
      else if (issue.field === 'addedTime') addedTimeInput.current?.focus();
      else if (typeof document !== 'undefined') {
        const selector = issue.field === 'eventType' || issue.field === 'variant' ? '[data-testid="event-wheel-anchor"]'
          : issue.field === 'result' ? '[data-testid="result-options"] [role="radio"]'
            : issue.field === 'handUsed' || issue.field === 'handChanged'
              ? `[data-testid="goalkeeper-${issue.field}"] [role="radio"]`
              : '[data-testid="measurement-choice-card"]';
        (document.querySelector(selector) as HTMLElement | null)?.focus();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [issue?.field, state.captureIssue]);
  const eventTitle = draft?.eventType === 'PASS' && draft.variant
    ? `Pase ${draft.variant === 'THROUGH' ? 'filtrado' : 'normal'}`
    : draft?.eventType ? eventLabels[draft.eventType] : 'Eventos';
  return <CaptureFrame match={match} step="capture" onBack={onBack} onNavigate={onNavigate}>
    <View style={{ gap: 3 }}>
      <Text accessibilityRole="header" aria-level={1} style={captureStyles.title}>Captura rápida en línea de tiempo</Text>
      <Text style={captureStyles.subtitle}>Registra las acciones observadas en el video de forma ágil y precisa.</Text>
    </View>
    <View style={[captureStyles.row, { marginBottom: 3 }]} accessibilityRole="radiogroup">
      <CaptureChoice label="Participó" selected={state.participation === 'PARTICIPATED'} onPress={() => machine.setParticipation('PARTICIPATED')} />
       <CaptureChoice label="No participó" selected={state.participation === 'DID_NOT_PARTICIPATE'}
         disabled={state.events.length > 0 || Boolean(state.draft?.eventType)}
         onPress={() => machine.setParticipation('DID_NOT_PARTICIPATE')} />
    </View>
     {state.events.length > 0 ? <Text style={captureStyles.text}>Hay eventos guardados: no se puede marcar «No participó» sin eliminarlos.</Text> : null}
    {state.participation === 'DID_NOT_PARTICIPATE' ? <View style={captureStyles.panel}>
      <Text style={captureStyles.text}>No participó; no se registran eventos.</Text>
      <CaptureButton label="Revisar captura" variant="primary" onPress={() => machine.review()} />
    </View> : <View style={captureStyles.split}>
      <View style={[captureStyles.panel, { padding: desktop ? 18 : 14 }]}>
        <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: desktop ? 235 : 185, marginVertical: 2 }}>
          <CaptureEventButton ref={wheelButton} desktop={desktop} onPress={openWheel}
            label={draft?.eventType ? `${eventTitle}, Cambiar` : 'Elegir evento'} title={eventTitle}
            action={draft?.eventType ? 'Cambiar' : 'Elegir evento'} />
          {issue?.field === 'eventType' || issue?.field === 'variant' ?
            <Text accessibilityRole="alert" style={{ color: '#ffe39c' }}>{issue.message}</Text> : null}
        </View>
        <Text accessibilityRole="header" aria-level={2} style={captureStyles.section}>Momento del video</Text>
        <View style={[captureStyles.row, { borderColor: captureColors.border, borderWidth: 1, borderRadius: 9,
          padding: desktop ? 15 : 10, gap: 10, alignItems: 'flex-start' }]}>
          <View style={{ flexGrow: 1, flexBasis: desktop ? '29%' : '100%', minWidth: desktop ? 150 : 0 }}>
            <CaptureInput label="Minuto del video" value={draft?.videoMinute ?? ''} disabled={!draft} inputRef={minuteInput}
              error={issue?.field === 'videoMinute' ? issue.message : undefined}
              onChangeText={(videoMinute) => machine.updateDraft({ videoMinute })} placeholder="Ej. 90+2" />
          </View>
          <View style={{ flexGrow: 1, flexBasis: desktop ? '29%' : '45%', minWidth: desktop ? 140 : 0 }}>
            <CaptureInput label="Periodo (si es visible)" value={draft?.period ?? ''} disabled={!draft} inputRef={periodInput}
              error={issue?.field === 'period' ? issue.message : undefined}
              onChangeText={(period) => machine.updateDraft({ period })} placeholder="Ej. 2T" />
          </View>
          <View style={{ flexGrow: 1, flexBasis: desktop ? '29%' : '45%', minWidth: desktop ? 160 : 0 }}>
            <CaptureInput label="Tiempo añadido (si es visible)" value={draft?.addedTime ?? ''} disabled={!draft} inputRef={addedTimeInput}
              error={issue?.field === 'addedTime' ? issue.message : undefined}
              onChangeText={(addedTime) => machine.updateDraft({ addedTime })} keyboardType="number-pad" placeholder="Ej. 2" />
          </View>
        </View>
         {draft?.eventType && draft.eventType !== 'GOAL' && draft.eventType !== 'ASSIST'
           ? <View style={{ gap: 8, borderTopColor: captureColors.border, borderTopWidth: 1, paddingTop: 12 }}>
          <Text style={captureStyles.label}>Resultado</Text>
          <View testID="result-options" style={captureStyles.row} accessibilityRole="radiogroup">{resultsByType[draft.eventType].map((result) =>
            <CaptureChoice key={result} label={result === 'NONE' ? 'Sin resultado' : display(result)} selected={draft.result === result}
              onPress={() => machine.selectResult(result)} />)}</View>
          {issue?.field === 'result' ? <Text accessibilityRole="alert" style={{ color: '#ffe39c' }}>{issue.message}</Text> : null}
         </View> : null}
      </View>
      <AnalystEventWheel visible={state.wheelOpen} anchor={anchor} onClose={closeWheel}
        selected={draft?.eventType ? { eventType: draft.eventType, variant: draft.variant ?? undefined } : null}
        onSelect={(eventType, variant) => { machine.selectType(eventType, variant); returnWheelFocus(); }} />
      {draft?.eventType && draft.result ? <View style={[captureStyles.panel, { padding: desktop ? 18 : 14 }]}>
        {!noMeasurements ? <>
        <Text accessibilityRole="header" aria-level={2} style={captureStyles.section}>Medición guiada</Text>
        <View style={{ gap: 3 }}>
          <Text style={captureStyles.label}>Contexto · {contextKeys.filter((key) => answered(draft.context[key])).length} de 5</Text>
          <GroupProgress labels={contextKeys.map((key) => contextLabels[key])} observations={contextKeys.map((key) => draft.context[key])}
            active={group} offset={0} machine={machine} />
        </View>
        <View style={{ gap: 3 }}>
          <Text style={captureStyles.label}>Complejidad · {complexityKeys.filter((key) => answered(draft.complexity[key])).length} de 7</Text>
          <GroupProgress labels={complexityKeys.map((key) => complexityLabels[key])}
            shortLabels={['Técnica', 'Distancia', 'Precisión', 'Velocidad', 'Rivales', 'Extremidad', 'Riesgo']}
            observations={complexityKeys.map((key) => draft.complexity[key])} active={group} offset={5} machine={machine} />
        </View>
        <View style={{ borderColor: captureColors.border, borderWidth: 1, borderRadius: 9, padding: desktop ? 16 : 10, gap: 6 }}>
          {contextKey && currentContext ? <>
            <Text accessibilityRole="header" aria-level={3} style={captureStyles.section}>{contextLabels[contextKey]}</Text>
            <Text style={captureStyles.text}>{contextKey === 'temporal' ? temporalHelp
              : 'Selecciona el dato observado en el instante del evento.'}</Text>
            <ChoiceRail>
              {contextChoices[contextKey].map((value) => <CaptureChoice rail key={value}
                label={`${contextLabels[contextKey]}: ${value}`}
                visualLabel={contextKey === 'temporal' ? temporalShortLabel[value] : undefined}
                selected={selected(currentContext, value)}
                onPress={() => machine.updateContext(contextKey, { status: 'OBSERVED', value })} />)}
              <CaptureChoice rail label={`${contextLabels[contextKey]}: no observable`} selected={currentContext.status === 'NOT_OBSERVABLE'}
                onPress={() => machine.updateContext(contextKey, { status: 'NOT_OBSERVABLE' })} />
            </ChoiceRail>
            {issue?.field === contextKey ? <Text accessibilityRole="alert" style={{ color: '#ffe39c' }}>{issue.message}</Text> : null}
          </> : null}
          {complexityKey && currentComplexity ? <>
            <Text accessibilityRole="header" aria-level={3} style={captureStyles.section}>{complexityLabels[complexityKey]}</Text>
            <Text style={captureStyles.text}>Selecciona explícitamente el nivel o la ausencia que observaste.</Text>
            <ChoiceRail>
              {(complexityKey === 'nonDominantLimb' ? ['YES', 'NO'] : levels).map((value) =>
                <CaptureChoice rail key={value} label={`${complexityLabels[complexityKey]}: ${display(value)}`}
                  selected={selected(currentComplexity, value)}
                  onPress={() => machine.updateComplexity(complexityKey, { status: 'OBSERVED', value })} />)}
              <CaptureChoice rail label={`${complexityLabels[complexityKey]}: no observable`}
                selected={currentComplexity.status === 'NOT_OBSERVABLE'}
                onPress={() => machine.updateComplexity(complexityKey, { status: 'NOT_OBSERVABLE' })} />
              <CaptureChoice rail label={`${complexityLabels[complexityKey]}: no aplica`}
                selected={currentComplexity.status === 'NOT_APPLICABLE'}
                onPress={() => machine.updateComplexity(complexityKey, { status: 'NOT_APPLICABLE' })} />
            </ChoiceRail>
            {issue?.field === complexityKey ? <Text accessibilityRole="alert" style={{ color: '#ffe39c' }}>{issue.message}</Text> : null}
          </> : null}
        </View>
         {draft.eventType === 'SAVE' && draft.result !== 'FAILURE' ? <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" aria-level={3} style={captureStyles.section}>Detalle de atajada</Text>
          {(['handUsed', 'handChanged'] as const).map((key) => <View key={key} testID={`goalkeeper-${key}`} style={captureStyles.row} accessibilityRole="radiogroup">
            {(key === 'handUsed' ? ['DOMINANT', 'NON_DOMINANT', 'BOTH', 'NO_HANDS'] : ['YES', 'NO']).map((value) =>
              <CaptureChoice key={value} label={`${key === 'handUsed' ? 'Mano usada' : 'Mano cambiada'}: ${display(value)}`}
                selected={selected(draft.goalkeeperDetail[key], value)} onPress={() => machine.updateGoalkeeper(key, { status: 'OBSERVED', value })} />)}
            {(['NOT_OBSERVABLE', 'NOT_APPLICABLE'] as const).map((status) => <CaptureChoice key={status}
              label={`${key === 'handUsed' ? 'Mano usada' : 'Mano cambiada'}: ${status === 'NOT_OBSERVABLE' ? 'no observable' : 'no aplica'}`}
              selected={draft.goalkeeperDetail[key].status === status} onPress={() => machine.updateGoalkeeper(key, { status })} />)}
            {issue?.field === key ? <Text accessibilityRole="alert" style={{ color: '#ffe39c' }}>{issue.message}</Text> : null}
          </View>)}
        </View> : null}
        </> : null}
        {completeEvent(draft) ? <View style={{ gap: 9, borderTopColor: captureColors.border, borderTopWidth: 1, paddingTop: 13 }}>
          <View style={{ alignSelf: 'flex-end' }}><CaptureButton label="Guardar evento" variant="primary" onPress={saveEvent} /></View>
        </View> : null}
      </View> : null}
      <View testID="captured-events-list" style={[captureStyles.panel, { padding: 0, gap: 0, overflow: 'hidden' }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Eventos capturados" accessibilityState={{ expanded: state.capturedExpanded }}
          onPress={() => machine.toggleCaptured()} style={{ minHeight: 54, paddingHorizontal: 16, flexDirection: 'row',
            alignItems: 'center', justifyContent: 'space-between', outlineColor: captureColors.lime }}>
          <Text style={{ color: captureColors.white, fontSize: 17, fontWeight: '700' }}>☷  Eventos capturados · {state.events.length}</Text>
          <Text style={{ color: captureColors.aqua, fontSize: 19 }}>{state.capturedExpanded ? '⌃' : '⌄'}</Text>
        </Pressable>
        {state.capturedExpanded ? <View style={{ borderTopColor: captureColors.border, borderTopWidth: 1, paddingHorizontal: 16 }}>
          {state.events.length ? chronologicalCapturedEvents(state.events).map(({ event, index }) => <View key={index} style={{ flexDirection: 'row', flexWrap: 'wrap',
            alignItems: 'center', gap: 10, borderBottomColor: captureColors.border, borderBottomWidth: 1, paddingVertical: 10 }}>
            <Text style={{ color: captureColors.white, fontWeight: '700', minWidth: 48 }}>{event.videoMinute}′</Text>
            <Text style={{ color: captureColors.white, flexGrow: 1 }}>{event.eventType === 'PASS' && event.variant
              ? `Pase ${event.variant === 'THROUGH' ? 'filtrado' : 'normal'}` : event.eventType ? eventLabels[event.eventType] : ''}</Text>
            {event.eventType !== 'GOAL' && event.eventType !== 'ASSIST'
              ? <Text style={{ color: captureColors.aqua }}>{event.result === 'NONE' ? 'Sin resultado' : display(event.result ?? '')}</Text> : null}
            <CaptureIconButton label={`Editar evento ${index + 1}`} icon="pencil-outline" onPress={() => machine.editSaved(index)} />
            <CaptureIconButton label={`Eliminar evento ${index + 1}`} icon="delete-outline" onPress={() => machine.removeSaved(index)} />
          </View>) : <Text style={[captureStyles.text, { paddingVertical: 12 }]}>Aún no hay eventos guardados.</Text>}
        </View> : null}
      </View>
      <View style={[captureStyles.row, { justifyContent: 'flex-end', paddingTop: 4 }]}>
        <CaptureButton label="Revisar captura" variant="primary" onPress={() => machine.review()} />
      </View>
      {draft ? <Text style={[captureStyles.text, { fontSize: 12 }]}>El evento en edición aún no figura en «Eventos capturados».</Text> : null}
      <Text style={[captureStyles.text, { fontSize: 12 }]}>Sin puntos, valores ni ratings en esta etapa.</Text>
    </View>}
  </CaptureFrame>;
}
