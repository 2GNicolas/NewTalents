import type { ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

import { LiquidGlassPanel } from '../../design/components/liquid-glass-panel';
import { PassportIcon, type PassportIconName } from './passport-icon';
import { passportTheme } from './passport-theme';
import type { PassportSectionAvailability, PassportSectionKey } from '../passport-types';

type ContentProps = { scale: number; desktop: boolean; availability: PassportSectionAvailability; message?: string | null };

function useTextScale(scale: number): number {
  const { width } = useWindowDimensions();
  return width >= 1024 ? 1.5 : scale;
}

function GlassCard({ children, scale, title, style }: { children: ReactNode; scale: number; title?: string; style?: StyleProp<ViewStyle> }) {
  const textScale = useTextScale(scale);
  return (
    <LiquidGlassPanel style={[styles.card, { padding: 16 * scale, borderRadius: 14 * scale, gap: 11 * scale }, style]}>
      {title ? <View style={styles.cardHeading}><Text accessibilityRole="header" style={[styles.title, { fontSize: 16 * textScale, lineHeight: 20 * textScale }]}>{title}</Text><PassportIcon name="info" size={15 * textScale} color={passportTheme.colors.muted} /></View> : null}
      {children}
    </LiquidGlassPanel>
  );
}

function AvailabilityNote({ scale, label = 'No disponible' }: { scale: number; label?: string }) {
  const textScale = useTextScale(scale);
  return <View style={styles.availability}><PassportIcon name="lock" size={12 * textScale} color={passportTheme.colors.muted} /><Text style={[styles.availabilityLabel, { fontSize: 10 * textScale }]}>{label}</Text></View>;
}

function EmptyContent({ scale, icon, title, message, compact = false }: { scale: number; icon: PassportIconName; title: string; message: string; compact?: boolean }) {
  const textScale = useTextScale(scale);
  return (
    <View style={[styles.emptyContent, { gap: 9 * scale, paddingVertical: (compact ? 5 : 14) * scale }, compact && styles.compactEmpty]}>
      <PassportIcon name={icon} size={(compact ? 34 : 60) * scale} color={passportTheme.colors.muted} />
      <View style={[{ gap: 7 * scale, maxWidth: '100%' }, compact && styles.flexCard]}>
        <Text style={[styles.emptyTitle, { fontSize: (compact ? 13 : 19) * textScale, lineHeight: (compact ? 18 : 24) * textScale }, compact && styles.leftAligned]}>{title}</Text>
        <Text style={[styles.body, styles.centered, { fontSize: 11 * textScale, lineHeight: 16 * textScale, maxWidth: compact ? undefined : 330 * textScale }, compact && styles.leftAligned]}>{message}</Text>
      </View>
    </View>
  );
}

type Metric = { label: string; icon: PassportIconName };
function MetricBand({ scale, metrics, wrap = false }: { scale: number; metrics: readonly Metric[]; wrap?: boolean }) {
  const textScale = useTextScale(scale);
  const { width } = useWindowDimensions();
  const dense = metrics.length > 3;
  wrap = wrap || (dense && width < 500);
  return (
    <View style={[styles.metricBand, wrap && styles.metricBandWrap]}>
      {metrics.map((metric, index) => (
        <View key={metric.label} style={[styles.metric, { gap: 6 * scale, paddingVertical: 9 * scale }, wrap && styles.metricWrapped, index > 0 && !wrap && styles.metricDivider]}>
          <PassportIcon name={metric.icon} size={26 * scale} color={passportTheme.colors.lime} />
          <Text style={[styles.metricAbsent, { fontSize: (dense ? 9 : 11) * textScale, lineHeight: (dense ? 12 : 14) * textScale }]}>No disponible</Text>
          <Text style={[styles.metricLabel, { fontSize: (dense ? 8 : 10) * textScale, lineHeight: (dense ? 11 : 14) * textScale }]}>{metric.label}</Text>
        </View>
      ))}
    </View>
  );
}

function Footnote({ children, scale }: { children: ReactNode; scale: number }) {
  const textScale = useTextScale(scale);
  return <View style={[styles.footnote, { gap: 8 * scale, paddingTop: 10 * scale }]}><PassportIcon name="info" size={14 * textScale} color={passportTheme.colors.muted} /><Text style={[styles.body, { flex: 1, fontSize: 10 * textScale, lineHeight: 14 * textScale }]}>{children}</Text></View>;
}

function SummaryContent({ scale, availability, desktop }: ContentProps) {
  const textScale = useTextScale(scale);
  return (
    <View style={{ gap: 10 * scale }} testID="passport-resumen-content">
      <GlassCard scale={scale} title="Perfil de capacidades" style={desktop && { minHeight: 500, justifyContent: 'space-between' }}>
        <AvailabilityNote scale={scale} />
        <EmptyContent scale={scale} icon="radar" title="Tu juego, respaldado por evidencia" message="El perfil de capacidades estará disponible cuando existan análisis publicados. Aún no hay una evaluación para mostrar." />
        <View style={[styles.capacityGrid, { gap: 8 * scale }]}>
          {['Técnica', 'Pase', 'Finalización', 'Defensa', 'Decisión', 'Participación'].map(label => (
            <View key={label} style={[styles.capacity, { paddingVertical: 7 * scale, gap: 4 * scale }]}>
              <Text style={[styles.capacityName, { fontSize: 11 * textScale }]}>{label}</Text>
              <Text style={[styles.body, { fontSize: 9 * textScale }]}>No disponible</Text>
            </View>
          ))}
        </View>
        <Footnote scale={scale}>Cada capacidad requiere evidencia de eventos, contexto, complejidad y consecuencia.</Footnote>
      </GlassCard>
      <GlassCard scale={scale} title="Rendimiento destacado" style={desktop && { minHeight: 270, justifyContent: 'space-between' }}>
        <Text style={[styles.body, { fontSize: 11 * textScale, lineHeight: 16 * textScale }]}>Indicadores respaldados por análisis publicados</Text>
        <MetricBand scale={scale} metrics={[{ icon: 'target', label: 'Precisión de pase' }, { icon: 'football', label: 'Ocasiones creadas' }, { icon: 'team', label: 'Goles' }]} />
        <View style={[styles.informationStrip, { padding: 10 * scale }]}>
          <PassportIcon name="chart" size={21 * scale} color={passportTheme.colors.muted} />
          <Text style={[styles.body, { fontSize: 11 * textScale, lineHeight: 16 * textScale, flex: 1 }]}>{availability === 'empty' ? 'Aún no hay información en el resumen.' : 'El análisis de rendimiento todavía no está disponible.'}</Text>
        </View>
      </GlassCard>
    </View>
  );
}

function MetricList({ scale, title, labels, desktop }: { scale: number; title: string; labels: readonly string[]; desktop: boolean }) {
  const textScale = useTextScale(scale);
  return (
    <GlassCard scale={scale} title={title} style={[desktop && styles.flexCard, { gap: 2 * scale, paddingVertical: 9 * scale }]}>
      {labels.map(label => (
        <View key={label} style={[styles.measureRow, { paddingVertical: 1 * scale, gap: 10 * scale }]}>
          <Text style={[styles.body, { flex: 1, fontSize: 10 * textScale, lineHeight: 13 * textScale }]}>{label}</Text>
          <Text style={[styles.unavailableValue, { fontSize: 9 * textScale }]}>No disponible</Text>
        </View>
      ))}
    </GlassCard>
  );
}

function StatisticsContent({ scale, desktop, availability }: ContentProps) {
  const textScale = useTextScale(scale);
  return (
    <View style={{ gap: 6 * scale }}>
      <GlassCard scale={scale}>
        <View style={styles.sectionHeading}><View style={styles.flexCard}><Text accessibilityRole="header" style={[styles.title, { fontSize: 18 * textScale }]}>Rendimiento estadístico</Text><Text style={[styles.body, { fontSize: 11 * textScale, marginTop: 4 * scale }]}>Indicadores del jugador</Text></View><AvailabilityNote scale={scale} label={availability === 'empty' ? 'Sin estadísticas publicadas' : 'No disponible'} /></View>
      </GlassCard>
      <GlassCard scale={scale} title="Producción ofensiva" style={desktop && { minHeight: 210, justifyContent: 'space-between' }}>
        <MetricBand scale={scale} metrics={[{ icon: 'football', label: 'Goles / 90' }, { icon: 'foot', label: 'Asistencias / 90' }, { icon: 'team', label: 'Participaciones de gol / 90' }, { icon: 'target', label: 'Remates / 90' }, { icon: 'target', label: 'Remates al arco' }, { icon: 'target', label: 'Conversión' }]} />
      </GlassCard>
      <View style={[styles.pair, desktop && styles.pairDesktop, { gap: 6 * scale }, desktop && { minHeight: 190 }]}>
        <MetricList scale={scale} desktop={desktop} title="Creación y progresión" labels={['Pases clave / 90', 'Ocasiones creadas / 90', 'Pases progresivos / 90', 'Pases que rompen líneas / 90', 'Regates exitosos']} />
        <MetricList scale={scale} desktop={desktop} title="Aporte sin balón" labels={['Recuperaciones / 90', 'Intercepciones / 90', 'Duelos ganados', 'Presiones efectivas / 90']} />
      </View>
      <View style={[styles.pair, desktop && styles.pairDesktop, { gap: 6 * scale }, desktop && { minHeight: 220 }]}>
        <GlassCard scale={scale} title="Tendencia de producción" style={desktop && styles.flexCard}>
          <EmptyContent scale={scale} icon="chart" compact title="Tendencia no disponible" message="Se mostrará cuando haya partidos con análisis publicado. La ausencia de información no representa un valor cero." />
        </GlassCard>
        <GlassCard scale={scale} title="Lectura rápida" style={desktop && styles.flexCard}>
          <EmptyContent scale={scale} icon="radar" compact title="Sin conclusiones deportivas" message="Las fortalezas y conclusiones requieren evidencia analizada. No hay información publicada para mostrarlas." />
        </GlassCard>
      </View>
      <Footnote scale={scale}>Las estadísticas estarán disponibles cuando se publiquen análisis. No hay comparaciones ni filtros disponibles por ahora.</Footnote>
    </View>
  );
}

function MatchesContent({ scale, availability, message, desktop }: ContentProps) {
  const textScale = useTextScale(scale);
  return (
    <GlassCard scale={scale} title="Partidos analizados" style={desktop && { minHeight: 820 }}>
      <Text style={[styles.body, { fontSize: 12 * textScale, lineHeight: 17 * textScale }]}>El recorrido del jugador, partido a partido</Text>
      <MetricBand scale={scale} metrics={[{ icon: 'football', label: 'Goles' }, { icon: 'foot', label: 'Asistencias' }, { icon: 'team', label: 'Participaciones de gol' }]} />
      <View style={[styles.matchEmpty, { paddingVertical: 28 * scale }, desktop && styles.flexCard]}>
        <AvailabilityNote scale={scale} label={availability === 'empty' ? 'Sin partidos publicados' : 'No disponible'} />
        <EmptyContent scale={scale} icon="calendar" title={availability === 'empty' ? 'Aún no hay partidos publicados' : 'Los partidos aún no están disponibles'} message={message ?? 'Aquí encontrarás el contexto de cada partido y su análisis cuando estén disponibles. El pasaporte conserva toda la información de tu perfil.'} />
      </View>
      <Footnote scale={scale}>Solo se mostrarán partidos con análisis publicado. Los goles y minutos no disponibles no se presentan como cero.</Footnote>
    </GlassCard>
  );
}

function VideosContent({ scale, desktop, availability }: ContentProps) {
  const textScale = useTextScale(scale);
  return (
    <View style={{ gap: 7 * scale }}>
      <GlassCard scale={scale}>
        <View style={styles.sectionHeading}><Text accessibilityRole="header" style={[styles.title, { fontSize: 18 * textScale, flex: 1 }]}>Evidencia en video</Text><AvailabilityNote scale={scale} label={availability === 'empty' ? 'Sin videos publicados' : 'No disponible'} /></View>
        <Text style={[styles.body, { fontSize: 12 * textScale, lineHeight: 16 * textScale }]}>Partidos completos y momentos destacados</Text>
      </GlassCard>
      <View style={[styles.pair, desktop && styles.pairDesktop, { gap: 7 * scale }, desktop && { minHeight: 400 }]}>
        <GlassCard scale={scale} title="Video destacado" style={desktop && styles.flexCard}>
          <View style={[styles.mediaEmpty, { borderRadius: 9 * scale }, desktop && styles.flexCard]}>
            <EmptyContent scale={scale} icon="video" compact={!desktop} title="Video no disponible" message="La evidencia del jugador aparecerá aquí cuando esté disponible." />
          </View>
        </GlassCard>
        <GlassCard scale={scale} title="Mejores momentos" style={desktop && styles.flexCard}>
          {['Finalización', 'Creación', 'Técnica', 'Sin balón'].map(label => (
            <View key={label} style={[styles.moment, { paddingVertical: desktop ? 16 : 5 * scale, gap: 10 * scale }]}>
              <PassportIcon name="video" size={22 * scale} color={passportTheme.colors.muted} />
              <View style={styles.flexCard}><Text style={[styles.momentCategory, { fontSize: 10 * textScale }]}>{label.toUpperCase()}</Text><Text style={[styles.body, { fontSize: 10 * textScale, marginTop: 3 * scale }]}>No disponible</Text></View>
            </View>
          ))}
          <Text style={[styles.body, { fontSize: 10 * textScale, lineHeight: 14 * textScale }]}>Los momentos requieren evidencia seleccionada por New Talents.</Text>
        </GlassCard>
      </View>
      <GlassCard scale={scale} title="Partidos completos" style={desktop && { minHeight: 220, justifyContent: 'space-between' }}>
        <EmptyContent scale={scale} icon="calendar" compact title={availability === 'empty' ? 'Aún no hay videos publicados' : 'Partidos completos no disponibles'} message="No hay videos aprobados para mostrar. No se ofrecen enlaces externos ni acciones de compartir hasta que exista evidencia disponible." />
      </GlassCard>
    </View>
  );
}

export function PassportSectionContent({ sectionKey, ...props }: ContentProps & { sectionKey: PassportSectionKey }) {
  if (props.availability === 'restricted') return <GlassCard scale={props.scale}><EmptyContent scale={props.scale} icon="lock" title="Acceso restringido" message="No tienes autorización para ver esta sección." /></GlassCard>;
  switch (sectionKey) {
    case 'resumen': return <SummaryContent {...props} />;
    case 'estadisticas': return <StatisticsContent {...props} />;
    case 'partidos': return <MatchesContent {...props} />;
    case 'videos': return <VideosContent {...props} />;
  }
}

const styles = StyleSheet.create({
  card: { width: '100%', backgroundColor: passportTheme.colors.glass, borderColor: passportTheme.colors.border },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: { color: passportTheme.colors.white, fontFamily: passportTheme.fontFamily, fontWeight: '700', letterSpacing: -0.3, flexShrink: 1 },
  body: { color: passportTheme.colors.secondary, fontFamily: passportTheme.fontFamily, fontWeight: '400' },
  centered: { textAlign: 'center' },
  leftAligned: { textAlign: 'left' },
  compactEmpty: { flexDirection: 'row', alignItems: 'center' },
  availability: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  availabilityLabel: { color: passportTheme.colors.muted, fontFamily: passportTheme.fontFamily },
  emptyContent: { alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: passportTheme.colors.white, fontFamily: passportTheme.fontFamily, fontWeight: '600', textAlign: 'center', maxWidth: '100%' },
  capacityGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  capacity: { flexBasis: '30%', alignItems: 'center' },
  capacityName: { color: passportTheme.colors.secondary, fontFamily: passportTheme.fontFamily },
  metricBand: { flexDirection: 'row', borderTopColor: passportTheme.colors.divider, borderTopWidth: 1, width: '100%' },
  metricBandWrap: { flexWrap: 'wrap' },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 4 },
  metricWrapped: { flexBasis: '30%', flexGrow: 1 },
  metricDivider: { borderLeftColor: passportTheme.colors.divider, borderLeftWidth: 1 },
  metricAbsent: { color: passportTheme.colors.white, fontFamily: passportTheme.fontFamily, textAlign: 'center', maxWidth: '100%' },
  metricLabel: { color: passportTheme.colors.secondary, fontFamily: passportTheme.fontFamily, textAlign: 'center', maxWidth: '100%' },
  informationStrip: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: passportTheme.colors.divider, borderRadius: 10, backgroundColor: 'rgba(12, 50, 39, 0.20)' },
  footnote: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: passportTheme.colors.divider },
  flexCard: { flex: 1, minWidth: 0 },
  pair: { gap: 8 },
  pairDesktop: { flexDirection: 'row', alignItems: 'stretch' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  measureRow: { flexDirection: 'row', alignItems: 'center' },
  unavailableValue: { color: passportTheme.colors.muted, fontFamily: passportTheme.fontFamily },
  matchEmpty: { alignItems: 'center', justifyContent: 'center', borderTopColor: passportTheme.colors.divider, borderTopWidth: 1, borderBottomColor: passportTheme.colors.divider, borderBottomWidth: 1 },
  mediaEmpty: { backgroundColor: 'rgba(0, 24, 20, 0.7)', borderWidth: 1, borderColor: passportTheme.colors.divider, justifyContent: 'center' },
  moment: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: passportTheme.colors.divider },
  momentCategory: { color: passportTheme.colors.lime, fontFamily: passportTheme.fontFamily, fontWeight: '600' },
});
