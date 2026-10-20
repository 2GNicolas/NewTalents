import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { passportTheme } from '../passport/presentation/passport-theme';
import type { AnalystMatchDetail } from './analyst-workspace-api';
import { AnalystWorkspaceShell } from './analyst-workspace-shell';

type ViewKind = 'idle' | 'loading' | 'ready' | 'restricted' | 'error';
type Navigate = (destination: 'Inicio' | 'Pasaportes' | 'Partidos') => void;
type ListProps = Readonly<{ data: readonly AnalystMatchDetail[]; hasMore: boolean; kind: ViewKind;
  onOpen: (id: string) => void; onRetry: () => void; onMore?: () => void; onNavigate?: Navigate; onLogout?: () => void }>;
type DetailProps = Readonly<{ detail: AnalystMatchDetail | null; kind: ViewKind;
  onBack: () => void; onRetry: () => void; captureAvailability?: 'AVAILABLE' | 'UNAVAILABLE' | 'CONFIRMED';
  onCapture?: () => void; onNavigate?: Navigate; onLogout?: () => void }>;

const dateLabel = (date: string) => {
  const day = new Date(`${date}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'long' }).format(day).toUpperCase();
  const month = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', month: 'short' }).format(day).toUpperCase().replace('.', '');
  return `${weekday} ${date.slice(8, 10)} ${month} ${date.slice(0, 4)}`;
};
const stateLabel = (state: AnalystMatchDetail['state']) => state === 'WAITING' ? 'En espera' : 'Carga confirmada';

function Status({ kind, onRetry }: { kind: ViewKind; onRetry: () => void }) {
  if (kind === 'idle' || kind === 'loading') return <Text accessibilityRole="alert" style={styles.status}>Cargando partidos…</Text>;
  if (kind === 'restricted') return <Text accessibilityRole="alert" style={styles.status}>Acceso restringido.</Text>;
  if (kind === 'error') return <View><Text accessibilityRole="alert" style={styles.status}>El servicio no está disponible.</Text>
    <Pressable accessibilityRole="button" onPress={onRetry} style={styles.action}><Text style={styles.actionText}>Reintentar</Text></Pressable></View>;
  return null;
}

function MatchCard({ match, onOpen, desktop }: { match: AnalystMatchDetail; onOpen: () => void; desktop: boolean }) {
  const initials = match.playerName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
  return <View style={[styles.card, desktop && styles.cardDesktop]}>
    <View style={styles.identity}><View style={styles.avatar} accessible={false}><Text style={styles.avatarText}>{initials}</Text></View>
      <View style={styles.identityText}><Text style={styles.name}>{match.playerName}</Text><Text style={styles.meta}>{match.maskedReference}</Text></View></View>
    <View style={styles.facts}><Text style={styles.meta}>◷  {match.matchTime}</Text><Text style={styles.meta}>Rival  ·  {match.opponent}</Text>
      <Text style={styles.meta}>Competencia  ·  {match.competition}</Text><Text style={styles.meta}>Sede  ·  {match.venue}</Text></View>
    <Text style={styles.badge}>{stateLabel(match.state)}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Ver partido de ${match.playerName}`} onPress={onOpen} style={styles.action}>
      <Text style={styles.actionText}>Ver partido</Text><Text style={styles.actionText}>→</Text></Pressable>
  </View>;
}

export function AnalystMatchListView({ data, hasMore, kind, onOpen, onRetry, onMore, onNavigate, onLogout }: ListProps) {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const groups = new Map<string, AnalystMatchDetail[]>();
  for (const match of data) groups.set(match.matchDate, [...(groups.get(match.matchDate) ?? []), match]);
  return <AnalystWorkspaceShell current="Partidos" onNavigate={onNavigate} onLogout={onLogout}>
    <Text accessibilityRole="header" style={styles.title}>Agenda de partidos</Text>
    <Text style={styles.intro}>Partidos programados de los pasaportes bajo tu custodia.</Text>
    <Status kind={kind} onRetry={onRetry} />
    {kind === 'ready' && (data.length ? <View style={styles.board}>
      {[...groups].sort(([a], [b]) => a.localeCompare(b)).map(([date, matches]) => <View key={date} style={styles.group}>
        <Text accessibilityRole="header" aria-level={2} style={styles.date}>{dateLabel(date)}</Text>
        {matches.map((match) => <MatchCard key={`${match.sourceKind}:${match.id}`} match={match} desktop={desktop} onOpen={() => onOpen(match.id)} />)}
      </View>)}
      <Text style={styles.foot}>Esta vista es de solo lectura y refleja la programación vigente.</Text>
    </View> : <Text style={styles.status}>No hay partidos confirmados bajo tu custodia.</Text>)}
    {kind === 'ready' && hasMore && onMore ? <Pressable accessibilityRole="button" onPress={onMore} style={styles.action}>
      <Text style={styles.actionText}>Ver más partidos</Text></Pressable> : null}
  </AnalystWorkspaceShell>;
}

export function AnalystMatchDetailView({ detail, kind, onBack, onRetry, captureAvailability, onCapture, onNavigate, onLogout }: DetailProps) {
  return <AnalystWorkspaceShell current="Partidos" onNavigate={onNavigate} onLogout={onLogout}>
    <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}><Text style={styles.actionText}>← Volver a Partidos</Text></Pressable>
    <Text accessibilityRole="header" style={styles.title}>Partido programado</Text>
    <Status kind={kind} onRetry={onRetry} />
    {kind === 'ready' && detail ? <View style={styles.board}>
      <Text accessibilityRole="header" aria-level={2} style={styles.name}>{detail.playerName}</Text><Text style={styles.meta}>{detail.maskedReference}</Text>
      <Text style={styles.date}>{dateLabel(detail.matchDate)}  ·  {detail.matchTime}</Text>
      <Text style={styles.meta}>Rival  ·  {detail.opponent}</Text><Text style={styles.meta}>Competencia  ·  {detail.competition}</Text>
      <Text style={styles.meta}>Sede  ·  {detail.venue}</Text><Text style={styles.badge}>{stateLabel(detail.state)}</Text>
      {detail.state === 'WAITING' && detail.sourceKind === 'FIRST_MATCH' && captureAvailability === 'AVAILABLE' && onCapture
        ? <Pressable accessibilityRole="button" onPress={onCapture} style={styles.action}>
          <Text style={styles.actionText}>Registrar datos del partido</Text></Pressable> : null}
      {detail.state === 'LOADED' && detail.sourceKind === 'FIRST_MATCH' && captureAvailability === 'CONFIRMED' && onCapture
        ? <Pressable accessibilityRole="button" onPress={onCapture} style={styles.action}>
          <Text style={styles.actionText}>Consultar carga confirmada</Text></Pressable> : null}
      <Text style={styles.foot}>Consulta de solo lectura. La carga confirmada no acredita un análisis realizado.</Text>
    </View> : null}
  </AnalystWorkspaceShell>;
}

const colors = passportTheme.colors;
const styles = StyleSheet.create({
  title: { color: colors.white, fontSize: 39, fontWeight: '800', marginBottom: 5 },
  intro: { color: colors.secondary, fontSize: 19, marginBottom: 28 },
  board: { borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 24, backgroundColor: colors.glass, gap: 20 },
  group: { gap: 12 }, date: { color: colors.white, fontSize: 18, fontWeight: '800', borderBottomColor: colors.divider,
    borderBottomWidth: 1, paddingBottom: 8 },
  card: { borderColor: colors.border, borderWidth: 1, borderRadius: 15, padding: 18, gap: 14, backgroundColor: '#00251c' },
  cardDesktop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 190, flexGrow: 1 },
  identityText: { flexShrink: 1 }, avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2,
    borderColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontWeight: '800', fontSize: 19 }, name: { color: colors.white, fontWeight: '800', fontSize: 20 },
  meta: { color: colors.secondary, fontSize: 15, lineHeight: 22 }, facts: { gap: 3, flexGrow: 2 },
  badge: { color: '#f7c64a', borderColor: '#b98b12', borderWidth: 1, borderRadius: 18,
    paddingHorizontal: 13, paddingVertical: 6, alignSelf: 'flex-start', overflow: 'hidden' },
  action: { borderColor: colors.lime, borderWidth: 1, borderRadius: 10, minHeight: 48, paddingHorizontal: 18, outlineColor: colors.lime,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  actionText: { color: colors.lime, fontWeight: '700', fontSize: 16 },
  status: { color: colors.white, fontSize: 18, marginTop: 22 }, foot: { color: colors.secondary, fontSize: 14,
    borderTopColor: colors.divider, borderTopWidth: 1, paddingTop: 18 }, back: { minHeight: 44, justifyContent: 'center', marginBottom: 12, outlineColor: colors.lime },
});
