import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { passportTheme } from '../passport/presentation/passport-theme';
import type { AnalystPassportCard, AnalystPassportDetail } from './analyst-workspace-api';
import { AnalystWorkspaceShell } from './analyst-workspace-shell';

type ViewKind = 'idle' | 'loading' | 'ready' | 'restricted' | 'error';
type ListProps = Readonly<{ data: readonly AnalystPassportCard[]; hasMore: boolean; kind: ViewKind;
  onOpen: (passportId: string) => void; onRetry: () => void; onMore?: () => void;
  onNavigate?: (destination: 'Inicio' | 'Pasaportes' | 'Partidos') => void; onLogout?: () => void }>;
type DetailProps = Readonly<{ detail: AnalystPassportDetail | null; kind: ViewKind;
  onBack: () => void; onRetry: () => void; onNavigate?: (destination: 'Inicio' | 'Pasaportes' | 'Partidos') => void;
  onLogout?: () => void }>;

function Status({ kind, onRetry }: { kind: ViewKind; onRetry: () => void }) {
  if (kind === 'loading' || kind === 'idle') return <Text accessibilityRole="alert" style={styles.status}>Cargando pasaportes…</Text>;
  if (kind === 'restricted') return <Text accessibilityRole="alert" style={styles.status}>Acceso restringido.</Text>;
  if (kind === 'error') return <View><Text accessibilityRole="alert" style={styles.status}>El servicio no está disponible.</Text>
    <Pressable accessibilityRole="button" onPress={onRetry} style={styles.action}><Text style={styles.actionText}>Reintentar</Text></Pressable></View>;
  return null;
}

function PassportCardView({ card, onOpen }: { card: AnalystPassportCard; onOpen: () => void }) {
  const initials = card.playerName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
  return <View style={styles.card}>
    <View style={styles.identityRow}>
      <View style={styles.avatar} accessible={false}><Text style={styles.avatarText}>{initials}</Text></View>
      <View style={styles.identityText}><Text style={styles.name}>{card.playerName}</Text>
        <Text style={styles.reference}>{card.maskedReference}</Text></View>
      <Text style={styles.active}>● ACTIVE</Text>
    </View>
    <Text style={styles.custody}>✓ Asignado a ti</Text>
    <View style={styles.separator} />
    {card.nextMatch ? <View><Text style={styles.nextTitle}>Próximo partido programado</Text>
      <Text style={styles.meta}>{card.nextMatch.matchDate} · {card.nextMatch.matchTime} · {card.nextMatch.opponent}</Text>
      <Text style={styles.meta}>{card.nextMatch.venue}</Text></View>
      : <Text style={styles.nextTitle}>Sin próximo partido programado</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel={`Abrir pasaporte de ${card.playerName}`}
      onPress={onOpen} style={styles.action}><Text style={styles.actionText}>Abrir pasaporte</Text><Text style={styles.arrow}>→</Text></Pressable>
  </View>;
}

export function AnalystPassportListView({ data, hasMore, kind, onOpen, onRetry, onMore, onNavigate, onLogout }: ListProps) {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  return <AnalystWorkspaceShell current="Pasaportes" onNavigate={onNavigate} onLogout={onLogout}>
    <Text accessibilityRole="header" style={styles.title}>Pasaportes bajo mi custodia</Text>
    <Text style={styles.intro}>Solo pasaportes ACTIVE con custodia vigente.</Text>
    <Text style={styles.note}>El acceso se actualiza cuando cambia la custodia.</Text>
    <Status kind={kind} onRetry={onRetry} />
    {kind === 'ready' && (data.length ? <View style={[styles.grid, desktop && styles.gridDesktop]}>
      {data.map((card) => <View key={card.passportId} style={[styles.slot, desktop && styles.slotDesktop]}>
        <PassportCardView card={card} onOpen={() => onOpen(card.passportId)} />
      </View>)}
    </View> : <Text style={styles.status}>No tienes pasaportes bajo custodia actual.</Text>)}
    {kind === 'ready' && hasMore && onMore ? <Pressable accessibilityRole="button" onPress={onMore} style={styles.action}>
      <Text style={styles.actionText}>Ver más pasaportes</Text></Pressable> : null}
  </AnalystWorkspaceShell>;
}

export function AnalystPassportDetailView({ detail, kind, onBack, onRetry, onNavigate, onLogout }: DetailProps) {
  return <AnalystWorkspaceShell current="Pasaportes" onNavigate={onNavigate} onLogout={onLogout}>
    <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}><Text style={styles.backText}>← Volver a Pasaportes</Text></Pressable>
    <Text accessibilityRole="header" style={styles.title}>Pasaporte bajo mi custodia</Text>
    <Status kind={kind} onRetry={onRetry} />
    {kind === 'ready' && detail ? <View style={styles.detail}>
      <Text accessibilityRole="header" aria-level={2} style={styles.name}>{detail.playerName}</Text>
      <Text style={styles.reference}>{detail.maskedReference}</Text>
      <Text style={styles.custody}>● ACTIVE · Asignado a ti</Text>
      {detail.nextMatch ? <View style={styles.detailBlock}><Text style={styles.nextTitle}>Próximo partido programado</Text>
        <Text style={styles.meta}>{detail.nextMatch.matchDate} · {detail.nextMatch.matchTime} · {detail.nextMatch.opponent}</Text>
        <Text style={styles.meta}>{detail.nextMatch.venue}</Text></View>
        : <Text style={styles.meta}>Sin próximo partido programado</Text>}
      <View style={styles.detailBlock}><Text accessibilityRole="header" aria-level={3} style={styles.nextTitle}>Contacto de trabajo</Text>
        {detail.contact.availability === 'UNAVAILABLE' ? <Text style={styles.meta}>Contacto no disponible</Text> : <View>
          {detail.contact.phone ? <Text style={styles.meta}>Teléfono: {detail.contact.phone}</Text> : null}
          {detail.contact.email ? <Text style={styles.meta}>Correo: {detail.contact.email}</Text> : null}
        </View>}
      </View>
    </View> : null}
  </AnalystWorkspaceShell>;
}

const colors = passportTheme.colors;
const styles = StyleSheet.create({
  title: { color: colors.white, fontSize: 39, fontWeight: '800', marginBottom: 5 },
  intro: { color: colors.secondary, fontSize: 19, marginBottom: 12 }, note: { color: colors.secondary, fontSize: 14, marginBottom: 26 },
  grid: { gap: 18 }, gridDesktop: { flexDirection: 'row', flexWrap: 'wrap' }, slot: { width: '100%' }, slotDesktop: { width: '48%' },
  card: { backgroundColor: colors.glass, borderColor: colors.border, borderWidth: 1, borderRadius: 18,
    padding: 22, minHeight: 305, gap: 16 },
  identityRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 },
  avatar: { width: 66, height: 66, borderColor: colors.lime, borderWidth: 2, borderRadius: 33,
    alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.white, fontSize: 23, fontWeight: '800' },
  identityText: { flexGrow: 1, flexShrink: 1, minWidth: 130 }, name: { color: colors.white, fontSize: 24, fontWeight: '800' },
  reference: { color: colors.secondary, fontSize: 16 }, active: { color: colors.lime, fontSize: 13, fontWeight: '700' },
  custody: { color: colors.lime, fontSize: 16, fontWeight: '700' }, separator: { borderTopWidth: 1, borderTopColor: colors.divider },
  nextTitle: { color: colors.white, fontSize: 17, fontWeight: '700', marginBottom: 4 }, meta: { color: colors.secondary, fontSize: 15, lineHeight: 22 },
  action: { borderColor: colors.lime, borderWidth: 1, borderRadius: 10, minHeight: 48, marginTop: 'auto', outlineColor: colors.lime,
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionText: { color: colors.lime, fontWeight: '700', fontSize: 16 }, arrow: { color: colors.lime, fontSize: 24 },
  status: { color: colors.white, fontSize: 18, marginTop: 22 }, back: { minHeight: 44, justifyContent: 'center', marginBottom: 12, outlineColor: colors.lime },
  backText: { color: colors.lime, fontSize: 16 }, detail: { backgroundColor: colors.glass, borderColor: colors.border,
    borderWidth: 1, borderRadius: 18, padding: 24, gap: 12, maxWidth: 800 }, detailBlock: { borderTopColor: colors.divider,
    borderTopWidth: 1, paddingTop: 18, gap: 5 },
});
