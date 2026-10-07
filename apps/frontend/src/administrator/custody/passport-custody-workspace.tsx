import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { LiquidGlassPanel } from '../../design/components/liquid-glass-panel';
import { authTokens } from '../../design/tokens';
import type { CustodyPassportSummary, EligibleAnalystSummary } from '../administrator-api';
import { CustodyChangeRemove } from './custody-change-remove';
import { CustodyAnalystDropZone, DraggableCustodyPassport } from './custody-drag-selection';
import type { PassportCustodyView } from './passport-custody-state';

export function PassportCustodyWorkspace({ view, onSearch, onRetry, onSelectDestination, onChangeCustody, onRemoveCustody, previewMode }: Readonly<{
  view: PassportCustodyView;
  onSearch: (query: string) => void;
  onRetry: () => void;
  onSelectDestination: (passportId: string, analystIdentityId: string) => void;
  onChangeCustody?: (passport: CustodyPassportSummary, analyst: EligibleAnalystSummary) => void;
  onRemoveCustody?: (passport: CustodyPassportSummary) => void;
  previewMode?: 'desktop' | 'mobile';
}>) {
  const dimensions = useWindowDimensions();
  const desktop = previewMode ? previewMode === 'desktop' : dimensions.width >= authTokens.breakpoints.desktop;
  const [selectedPassportId, setSelectedPassportId] = useState<string | undefined>(view.selection?.passportId);
  const previousPersistedSelection = useRef(view.selection?.passportId);
  const [reducedMotion, setReducedMotion] = useState(false);
  const selectedPassport = view.unassigned.items.find((item) => item.passportId === selectedPassportId);
  useEffect(() => { let active = true; void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReducedMotion(value); }); return () => { active = false; }; }, []);
  useEffect(() => {
    const current = view.selection?.passportId;
    if (previousPersistedSelection.current && !current) setSelectedPassportId(undefined);
    previousPersistedSelection.current = current;
  }, [view.selection?.passportId]);

  const selectPassport = (passportId: string) => {
    setSelectedPassportId(passportId);
  };
  const selectAnalyst = (analyst: EligibleAnalystSummary) => {
    if (!selectedPassport) return;
    onSelectDestination(selectedPassport.passportId, analyst.identityId);
  };

  return <ScrollView accessibilityLabel="Espacio administrativo de custodia" contentContainerStyle={[styles.page, !desktop && styles.pageMobile]} keyboardShouldPersistTaps="handled">
    <View style={styles.heading}><View><Text accessibilityRole="header" style={[styles.title, !desktop && styles.titleMobile]}>Custodia de pasaportes</Text><Text style={[styles.subtitle, !desktop && styles.subtitleMobile]}>Asigna la custodia operativa a Analistas</Text></View>{desktop ? <Text style={styles.date}>30 SEP 2026</Text> : null}</View>
    <LiquidGlassPanel style={[styles.filters, !desktop && styles.mobileFilters]}>
      <TextInput accessibilityLabel="Buscar jugador o pasaporte" defaultValue={view.query} onChangeText={onSearch} placeholder="Buscar por jugador o pasaporte…" placeholderTextColor="#a9b9af" style={[styles.search, !desktop && styles.mobileSearch]} />
      {desktop ? <View style={styles.filterPlaceholder}><Text style={styles.filterPlaceholderText}>Pasaportes activos · En espera de enriquecimiento</Text></View> : null}
    </LiquidGlassPanel>

    {view.state === 'loading' ? <StateMessage copy="Cargando custodia…" /> : null}
    {view.state === 'empty' ? <StateMessage copy="No hay pasaportes o Analistas elegibles disponibles." /> : null}
    {view.state === 'restricted' ? <StateMessage copy="No tienes acceso al espacio de Custodia." /> : null}
    {view.state === 'unavailable' ? <StateMessage copy="Custodia no está disponible en este momento." retry={onRetry} /> : null}
    {view.state === 'error' ? <StateMessage copy="No pudimos cargar la custodia." retry={onRetry} /> : null}

    {view.state === 'ready' && desktop ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.desktopColumns}>
      <CustodyColumn title="Sin Analista" count={view.unassigned.items.length} items={view.unassigned.items} onSelectPassport={selectPassport} />
      {view.analysts.map((analyst) => <AnalystColumn key={analyst.identityId} analyst={analyst} analysts={view.analysts} items={view.assigned.items.filter((item) => item.custody.state === 'ASSIGNED' && item.custody.analyst.identityId === analyst.identityId)} selectedPassport={selectedPassport} reducedMotion={reducedMotion} onSelect={() => selectAnalyst(analyst)} onChangeCustody={onChangeCustody} onRemoveCustody={onRemoveCustody} />)}
    </ScrollView> : null}

    {view.state === 'ready' && !desktop && !selectedPassport ? <View style={styles.mobileList}>{view.unassigned.items.map((item) => <PassportCard key={item.passportId} item={item} onAssign={() => selectPassport(item.passportId)} />)}</View> : null}
    {view.state === 'ready' && !desktop && selectedPassport ? <View style={styles.mobileList}>
      <View style={styles.mobileSelectionHeading}>
        <Text accessibilityRole="header" style={styles.selectionHeading}>Selecciona un Analista para {selectedPassport.displayLabel}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver a pasaportes sin Analista" onPress={() => setSelectedPassportId(undefined)} style={styles.cancelSelection}><Text style={styles.cancelSelectionText}>Volver</Text></Pressable>
      </View>
      {view.analysts.map((analyst) => <AnalystCard key={analyst.identityId} analyst={analyst} analysts={view.analysts} items={view.assigned.items.filter((item) => item.custody.state === 'ASSIGNED' && item.custody.analyst.identityId === analyst.identityId)} selectedPassport={selectedPassport} onSelect={() => selectAnalyst(analyst)} onChangeCustody={onChangeCustody} onRemoveCustody={onRemoveCustody} />)}
    </View> : null}
  </ScrollView>;
}

function CustodyColumn({ title, count, items, onSelectPassport }: Readonly<{ title: string; count: number; items: readonly CustodyPassportSummary[]; onSelectPassport: (passportId: string) => void }>) {
  return <LiquidGlassPanel style={styles.column}><View style={styles.columnHeading}><Text accessibilityRole="header" style={styles.columnTitle}>{title}</Text><Text style={styles.count}>{count}</Text></View>{items.map((item) => <DraggableCustodyPassport key={item.passportId} passport={item} onDragStart={onSelectPassport}><PassportCard item={item} /></DraggableCustodyPassport>)}</LiquidGlassPanel>;
}

function AnalystColumn({ analyst, analysts, items, selectedPassport, reducedMotion, onSelect, onChangeCustody, onRemoveCustody }: Readonly<{ analyst: EligibleAnalystSummary; analysts: readonly EligibleAnalystSummary[]; items: readonly CustodyPassportSummary[]; selectedPassport?: CustodyPassportSummary; reducedMotion: boolean; onSelect: () => void; onChangeCustody?: (passport: CustodyPassportSummary, analyst: EligibleAnalystSummary) => void; onRemoveCustody?: (passport: CustodyPassportSummary) => void }>) {
  return <LiquidGlassPanel style={styles.column}><View style={styles.columnHeading}><Text accessibilityRole="header" style={styles.columnTitle}>{analyst.displayLabel}</Text><Text style={styles.count}>{analyst.activeCustodyCount}</Text></View><Text style={styles.workload}>{analyst.activeCustodyCount} custodias activas</Text><CustodyAnalystDropZone analyst={analyst} active={Boolean(selectedPassport)} reducedMotion={reducedMotion} onDrop={onSelect} onSelect={onSelect} />{items.map((item) => <View key={item.passportId} style={styles.assignedCard}><PassportCard item={item} />{onChangeCustody && onRemoveCustody ? <CustodyChangeRemove passport={item} analysts={analysts} onChange={onChangeCustody} onRemove={onRemoveCustody} /> : null}</View>)}</LiquidGlassPanel>;
}

function AnalystCard({ analyst, analysts, items, selectedPassport, onSelect, onChangeCustody, onRemoveCustody }: Readonly<{ analyst: EligibleAnalystSummary; analysts: readonly EligibleAnalystSummary[]; items: readonly CustodyPassportSummary[]; selectedPassport?: CustodyPassportSummary; onSelect: () => void; onChangeCustody?: (passport: CustodyPassportSummary, analyst: EligibleAnalystSummary) => void; onRemoveCustody?: (passport: CustodyPassportSummary) => void }>) {
  return <LiquidGlassPanel style={styles.analystCard}><View style={styles.analystHeading}><View><Text style={styles.cardName}>{analyst.displayLabel}</Text><Text style={styles.workload}>{analyst.activeCustodyCount} custodias activas</Text></View>{selectedPassport ? <Pressable accessibilityRole="button" accessibilityLabel={`Asignar ${analyst.displayLabel} a ${selectedPassport.displayLabel}`} onPress={onSelect} style={styles.assignButton}><Text style={styles.assignText}>Asignar</Text></Pressable> : null}</View>{items.map((item) => <View key={item.passportId} style={styles.assignedCard}><PassportCard item={item} />{onChangeCustody && onRemoveCustody ? <CustodyChangeRemove passport={item} analysts={analysts} onChange={onChangeCustody} onRemove={onRemoveCustody} /> : null}</View>)}</LiquidGlassPanel>;
}

function PassportCard({ item, onAssign }: Readonly<{ item: CustodyPassportSummary; onAssign?: () => void }>) {
  return <View style={styles.passportCard}><View style={styles.documentIcon}><Text style={styles.documentGlyph}>▧</Text></View><View style={styles.passportCopy}><Text style={styles.cardName}>{item.displayLabel}</Text><Text style={styles.reference}>{`PAS-${item.passportId.toUpperCase()}`}</Text><Text style={styles.activeStatus}>✓ Activo básico</Text><Text style={styles.enrichment}>En espera de enriquecimiento del Analista</Text>{item.academyLabel ? <Text style={styles.academy}>{item.academyLabel}</Text> : null}</View>{onAssign ? <Pressable testID={`assign-passport-${item.passportId}`} accessibilityRole="button" accessibilityLabel={`Asignar Analista a ${item.displayLabel}`} onPress={onAssign} style={styles.assignButton}><Text style={styles.assignText}>Asignar ›</Text></Pressable> : null}</View>;
}

function StateMessage({ copy, retry }: Readonly<{ copy: string; retry?: () => void }>) {
  return <LiquidGlassPanel style={styles.state}><Text accessibilityRole="alert" style={styles.helper}>{copy}</Text>{retry ? <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}><Text style={styles.retryText}>Reintentar</Text></Pressable> : null}</LiquidGlassPanel>;
}

const styles = StyleSheet.create({
  page: { alignSelf: 'center', gap: 14, maxWidth: 1280, padding: 28, paddingBottom: 40, width: '100%' },
  pageMobile: { alignSelf: 'stretch', gap: 10, padding: 14, paddingTop: 10, width: 'auto' },
  heading: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: '#f8f8f2', fontSize: 48, fontWeight: '900', letterSpacing: -1.7 },
  titleMobile: { fontSize: 29, letterSpacing: -.8 },
  subtitle: { color: '#d7d2e8', fontSize: 23 }, subtitleMobile: { fontSize: 17 },
  date: { borderLeftColor: '#91ffb5', borderLeftWidth: 2, color: '#f5f7ef', marginTop: 10, paddingLeft: 20 },
  filters: { alignItems: 'center', flexDirection: 'row', gap: 16, padding: 16 },
  mobileFilters: { alignItems: 'stretch', flexDirection: 'column', gap: 8, padding: 7 },
  search: { backgroundColor: 'rgba(0,18,12,.76)', borderColor: '#d6ff19', borderRadius: 9, borderWidth: 2, color: '#f5f7ef', flex: 1, minHeight: 50, paddingHorizontal: 16 },
  mobileSearch: { flex: 0, width: '100%' },
  filterPlaceholder: { borderColor: 'rgba(130,255,180,.55)', borderRadius: 9, borderWidth: 1, justifyContent: 'center', minHeight: 50, paddingHorizontal: 18 },
  filterPlaceholderText: { color: '#dce7df' },
  desktopColumns: { gap: 10, minWidth: '100%', paddingBottom: 8 },
  column: { gap: 9, minHeight: 510, padding: 14, width: 278 },
  columnHeading: { alignItems: 'center', flexDirection: 'row', gap: 10 }, columnTitle: { color: '#f7f8f2', flex: 1, fontSize: 20, fontWeight: '900' },
  count: { backgroundColor: 'rgba(220,255,232,.18)', borderRadius: 14, color: '#f4f7ef', fontWeight: '900', minWidth: 30, paddingHorizontal: 9, paddingVertical: 4, textAlign: 'center' },
  workload: { color: '#b9cbc0', fontSize: 12 },
  passportCard: { alignItems: 'center', backgroundColor: 'rgba(1,31,22,.75)', borderColor: 'rgba(121,255,170,.38)', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 112, padding: 12 },
  documentIcon: { alignItems: 'center', borderColor: '#87efc4', borderRadius: 20, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 }, documentGlyph: { color: '#f5f7ef', fontSize: 23 },
  passportCopy: { flex: 1, minWidth: 90 }, cardName: { color: '#f7f8f2', fontSize: 15, fontWeight: '900' }, reference: { color: '#eef3ec', fontSize: 12, marginTop: 2 },
  activeStatus: { color: '#9cff67', fontSize: 11, fontWeight: '800', marginTop: 4 }, enrichment: { color: '#b9c9bf', fontSize: 10, marginTop: 3 }, academy: { color: '#d4dfd7', fontSize: 10, marginTop: 3 },
  assignButton: { alignItems: 'center', backgroundColor: '#d6ff19', borderRadius: 8, justifyContent: 'center', minHeight: 44, minWidth: 86, paddingHorizontal: 12 }, assignText: { color: '#06120c', fontSize: 12, fontWeight: '900' },
  cancelSelection: { alignItems: 'center', borderColor: '#b9cbc0', borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 }, cancelSelectionText: { color: '#e6eee8', fontSize: 12, fontWeight: '700' },
  mobileList: { gap: 8 }, mobileSelectionHeading: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' }, analystCard: { gap: 10, minHeight: 76, padding: 14 }, analystHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, assignedCard: { backgroundColor: 'rgba(1,31,22,.35)', borderRadius: 10, padding: 4 }, selectionHeading: { color: '#f6f8ef', flex: 1, fontSize: 17, fontWeight: '900', marginBottom: 4 },
  helper: { color: '#c4d2c9', fontSize: 13, lineHeight: 19, textAlign: 'center' }, state: { alignItems: 'center', gap: 12, justifyContent: 'center', minHeight: 160, padding: 24 }, retry: { borderColor: '#d6ff19', borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 18 }, retryText: { color: '#d6ff19', fontWeight: '800' },
});
