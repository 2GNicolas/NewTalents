import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { passportTheme } from '../passport/presentation/passport-theme';
import type { AnalystOverview, AnalystOverviewMatch, AnalystOverviewSection } from './analyst-workspace-api';
import { AnalystWorkspaceShell } from './analyst-workspace-shell';
import type { AnalystWorkspaceState } from './analyst-workspace-state';

type Props = Readonly<{ overview: AnalystOverview | null; kind?: AnalystWorkspaceState['kind'];
  onRetry: () => void; onCalendar: () => void; onOpenMatch?: (matchId: string) => void;
  onNavigate?: (destination: 'Inicio' | 'Pasaportes' | 'Partidos') => void;
  onLogout?: () => void; navigationNotice?: string | null }>;
type Category = 'pending' | 'upcoming';

function bogotaGreeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: '2-digit', hourCycle: 'h23' }).format(now));
  return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
}

function MatchRow({ match, category, onOpen }: Readonly<{ match: AnalystOverviewMatch; category: Category;
  onOpen?: (id: string) => void }>) {
  const initials = match.playerName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
  return <View style={styles.matchRow}>
    <View style={styles.avatar} accessible={false}><Text style={styles.avatarText}>{initials}</Text></View>
    <View style={styles.matchInfo}>
      <Text style={styles.matchName}>{match.playerName}</Text>
      <Text style={styles.reference}>{match.maskedReference}</Text>
      <Text style={styles.matchMeta}>▣  {match.matchDate} · {match.matchTime}</Text>
      <Text style={styles.matchMeta}>⌖  {match.venue}</Text>
    </View>
    <Text style={styles.badge}>{category === 'pending' ? 'Pendiente de análisis' : 'Programado'}</Text>
    {onOpen ? <Pressable accessibilityRole="button" accessibilityLabel={`Abrir partido de ${match.playerName}`}
      onPress={() => onOpen(match.id)} style={styles.openButton}><Text style={styles.openText}>Abrir partido</Text><Text style={styles.openText}>→</Text></Pressable> : null}
  </View>;
}

function Section({ title, subtitle, icon, category, section, onOpen, footer }: Readonly<{ title: string; subtitle: string;
  icon: string; category: Category; section: AnalystOverviewSection; onOpen?: (id: string) => void; footer?: ReactNode }>) {
  return <View style={styles.panel} accessibilityLabel={title}>
    <View style={styles.sectionHeading}>
      <View style={styles.iconCircle} accessible={false}><Text style={styles.icon}>{icon}</Text></View>
      <View style={styles.headingCopy}><Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text></View>
    </View>
    {section.availability === 'UNAVAILABLE' ? <Text accessibilityRole="alert" style={styles.empty}>Esta sección no está disponible.</Text>
      : section.data.length ? section.data.map((match) => <MatchRow key={`${match.sourceKind}:${match.id}`} match={match}
        category={category} onOpen={onOpen} />)
        : <Text style={styles.empty}>{section.hasMore ? 'Vista parcial. Consulta Partidos para más información.' : 'No hay partidos en esta sección.'}</Text>}
    {section.hasMore ? <Text style={styles.partial}>Vista parcial: puede haber más partidos.</Text> : null}
    {footer}
  </View>;
}

export function AnalystOverviewView({ overview, kind = 'ready', onRetry, onCalendar, onOpenMatch, onNavigate, onLogout, navigationNotice }: Props) {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  return <AnalystWorkspaceShell current="Inicio" onNavigate={onNavigate} onLogout={onLogout}
    accountLabel={kind === 'ready' ? overview?.analystLabel : undefined}>
    <View style={styles.hero}>
      {overview && kind === 'ready' ? desktop
        ? <Text accessibilityRole="header" style={styles.title}>{`${bogotaGreeting(new Date())}, ${overview.analystLabel}`}</Text>
        : <View><Text style={styles.mobileGreeting}>{`${bogotaGreeting(new Date())},`}</Text>
          <Text accessibilityRole="header" style={styles.mobileName}>{overview.analystLabel}</Text></View>
        : <Text accessibilityRole="header" style={styles.title}>Espacio del Analista</Text>}
      <Text style={styles.intro}>Tu espacio de análisis</Text>
    </View>
    {navigationNotice ? <Text accessibilityRole="alert" style={styles.message}>{navigationNotice}</Text> : null}
    {kind === 'loading' || kind === 'idle' ? <Text accessibilityRole="alert" style={styles.message}>Cargando Inicio…</Text> : null}
    {kind === 'restricted' ? <Text accessibilityRole="alert" style={styles.message}>Acceso restringido. Vuelve a iniciar sesión o consulta tu acceso.</Text> : null}
    {kind === 'error' ? <View><Text accessibilityRole="alert" style={styles.message}>El servicio no está disponible. Puedes reintentar.</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.openButton}><Text style={styles.openText}>Reintentar</Text></Pressable></View> : null}
    {overview && kind === 'ready' ? <View style={styles.sections}>
      <Section title="Análisis pendientes" subtitle="Partidos que requieren tu análisis." icon="▤" category="pending"
        section={overview.pending} onOpen={onOpenMatch} />
      <View style={[styles.lower, desktop && styles.lowerDesktop]}>
        <View style={[styles.lowerPanel, desktop && styles.lowerPanelDesktop]}><Section title="Próximos partidos" subtitle="Partidos programados en tu calendario." icon="▣" category="upcoming"
          section={overview.upcoming} onOpen={onOpenMatch} footer={<Pressable accessibilityRole="button"
            onPress={onCalendar} style={[styles.calendarButton, desktop && styles.calendarButtonDesktop]}><Text style={styles.calendarText}>Ver calendario</Text><Text style={styles.calendarText}>→</Text></Pressable>} /></View>
        <View style={[styles.lowerPanel, desktop && styles.lowerPanelDesktop]}><View style={styles.panel} accessibilityLabel="Análisis realizados">
          <View style={styles.sectionHeading}><View style={styles.iconCircle} accessible={false}><Text style={styles.icon}>✓</Text></View>
            <View style={styles.headingCopy}><Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>Análisis realizados</Text>
              <Text style={styles.subtitle}>Tus análisis completados recientemente.</Text></View></View>
          <Text style={styles.empty}>No disponible: aún no hay una fuente aprobada de análisis realizados.</Text>
        </View></View>
      </View>
    </View> : null}
  </AnalystWorkspaceShell>;
}

const colors = passportTheme.colors;
const styles = StyleSheet.create({
  hero: { paddingVertical: 24, paddingHorizontal: 4, marginBottom: 22, borderBottomColor: colors.border, borderBottomWidth: 1 },
  title: { color: colors.white, fontSize: 42, fontWeight: '800', marginBottom: 5 },
  mobileGreeting: { color: colors.white, fontSize: 29, fontWeight: '400' },
  mobileName: { color: colors.white, fontSize: 43, fontWeight: '800', marginBottom: 5 },
  intro: { color: colors.secondary, fontSize: 22 },
  sections: { gap: 18 }, lower: { gap: 18 }, lowerDesktop: { flexDirection: 'row' },
  lowerPanel: { minWidth: 0, flexShrink: 0 }, lowerPanelDesktop: { flex: 1, flexShrink: 1 },
  panel: { backgroundColor: colors.glass, borderColor: colors.border, borderRadius: 18,
    borderWidth: 1, padding: 24, gap: 12, minHeight: 230 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 14 }, headingCopy: { flex: 1 },
  iconCircle: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: colors.lime,
    alignItems: 'center', justifyContent: 'center' }, icon: { color: colors.lime, fontSize: 27, fontWeight: '700' },
  sectionTitle: { color: colors.white, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.secondary, fontSize: 15 },
  matchRow: { borderTopColor: colors.divider, borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap',
    alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingVertical: 17 },
  avatar: { width: 49, height: 49, borderRadius: 25, borderWidth: 2, borderColor: colors.lime,
    alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  matchInfo: { flexGrow: 1, flexShrink: 1, minWidth: 160, gap: 3 },
  matchName: { color: colors.white, fontSize: 17, fontWeight: '700' },
  reference: { color: colors.secondary, fontSize: 13 }, matchMeta: { color: colors.secondary, fontSize: 14 },
  badge: { color: '#f7c64a', borderColor: '#b98b12', borderWidth: 1, borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 5, overflow: 'hidden' },
  empty: { color: colors.secondary, fontSize: 16, paddingVertical: 18 }, partial: { color: colors.muted, fontSize: 12 },
  openButton: { borderColor: colors.lime, borderRadius: 10, borderWidth: 1, minHeight: 44, outlineColor: colors.lime,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16 },
  openText: { color: colors.lime, fontSize: 15, fontWeight: '700' },
  calendarButton: { borderColor: colors.lime, borderRadius: 10, borderWidth: 1, minHeight: 46, outlineColor: colors.lime,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  calendarButtonDesktop: { marginTop: 'auto' },
  calendarText: { color: colors.lime, fontSize: 16, fontWeight: '700' },
  message: { color: colors.white, fontSize: 18, marginTop: 26 },
});
