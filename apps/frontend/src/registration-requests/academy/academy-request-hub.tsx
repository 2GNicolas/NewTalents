import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { LiquidGlassPanel } from '../../design/components/liquid-glass-panel';
import { authTokens } from '../../design/tokens';
import { Brand } from '../components/registration-journey';
import type { RegistrationRequestStatus, RegistrationRequestType } from '../registration-request-api';
import type { AcademyContext } from './academy-operation-shared';

type AcademyOperationType = Extract<RegistrationRequestType, 'ADDITIONAL_ACADEMY_ACCOUNT' | 'ACADEMY_ADULT_PLAYER' | 'ACADEMY_MINOR_PLAYER'>;
type HubRequest = Readonly<{ id: string; label: string; type: AcademyOperationType; status: RegistrationRequestStatus }>;

const choices = [
  { type: 'ADDITIONAL_ACADEMY_ACCOUNT', capability: 'registration.request.academy.create-additional-account', title: 'Solicitar cuenta de academia', copy: 'Registra una cuenta para un nuevo miembro de tu academia.' },
  { type: 'ACADEMY_ADULT_PLAYER', capability: 'registration.request.academy.create-adult-player', title: 'Registrar jugador adulto', copy: 'Registra un jugador mayor de 18 años en tu academia.' },
  { type: 'ACADEMY_MINOR_PLAYER', capability: 'registration.request.academy.create-minor-player', title: 'Registrar jugador menor', copy: 'Registra un jugador menor de 18 años en tu academia.' },
] as const;

const typeLabels: Record<AcademyOperationType, string> = { ADDITIONAL_ACADEMY_ACCOUNT: 'Cuenta de academia', ACADEMY_ADULT_PLAYER: 'Jugador adulto', ACADEMY_MINOR_PLAYER: 'Jugador menor' };
const statusLabels: Record<RegistrationRequestStatus, string> = { DRAFT: 'Borrador', SUBMITTED: 'En revisión', REQUIRES_CORRECTION: 'Requiere corrección', APPROVED: 'Aprobada', REJECTED: 'Rechazada' };

export function AcademyRequestHub({ academy, capabilities, requests, onSelectType }: Readonly<{ academy: AcademyContext; capabilities: readonly string[]; requests: readonly HubRequest[]; onSelectType: (type: AcademyOperationType) => void }>) {
  const desktop = useWindowDimensions().width >= authTokens.breakpoints.desktop;
  return <ImageBackground source={require('../../../assets/authentication/liquid-emerald-abstract-v1.png')} style={styles.background} resizeMode="cover">
    <View style={styles.scrim} />
    <ScrollView contentContainerStyle={[styles.page, desktop && styles.desktopPage]}>
      <Brand />
      <LiquidGlassPanel style={styles.academy}><Text style={styles.eyebrow}>Academia activa</Text><Text style={styles.academyName}>{academy.name}</Text><Text style={styles.approved}>✓ Aprobada　|　{academy.location}</Text></LiquidGlassPanel>
      <Text accessibilityRole="header" style={[styles.title, desktop && styles.titleDesktop]}>Solicitudes de la academia</Text>
      <Text style={styles.subtitle}>Gestiona aquí las solicitudes de tu academia. Todas son enviadas a revisión por un Administrador de New Talents.</Text>
      <View style={[styles.choices, desktop && styles.choicesDesktop]}>{choices.filter((choice) => capabilities.includes(choice.capability)).map((choice) => <Pressable accessibilityRole="button" accessibilityLabel={choice.title} key={choice.type} onPress={() => onSelectType(choice.type)} style={styles.choice}><Text style={styles.choiceTitle}>{choice.title}</Text><Text style={styles.copy}>{choice.copy}</Text><Text style={styles.arrow}>→</Text></Pressable>)}</View>
      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Mis solicitudes</Text><Text style={styles.copy}>Consulta el estado de las solicitudes registradas por tu academia.</Text>
      <LiquidGlassPanel style={styles.list}>{requests.length ? requests.map((request) => <View key={request.id} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{request.label}</Text><Text style={styles.copy}>{typeLabels[request.type]}</Text></View><Text style={styles.status}>{statusLabels[request.status]}</Text><Text style={styles.arrow}>›</Text></View>) : <Text style={styles.copy}>Aún no hay solicitudes para esta academia.</Text>}</LiquidGlassPanel>
      <Text style={styles.footnote}>ⓘ Las acciones disponibles varían según el acceso autorizado de tu academia.</Text>
    </ScrollView>
  </ImageBackground>;
}

const styles = StyleSheet.create({
  background: { backgroundColor: '#03130d', flex: 1, minHeight: '100%' }, scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,12,8,.4)' },
  page: { gap: 16, padding: 30 }, desktopPage: { alignSelf: 'center', maxWidth: 1180, paddingVertical: 54, width: '100%' }, academy: { padding: 24 },
  eyebrow: { color: '#d1ded6', fontSize: 15 }, academyName: { color: '#f5f7ef', fontSize: 29, fontWeight: '900' }, approved: { color: authTokens.colors.primary, fontSize: 17, marginTop: 8 },
  title: { color: '#f5f7ef', fontSize: 38, fontWeight: '900', letterSpacing: -1.2, lineHeight: 43, marginTop: 10 }, titleDesktop: { fontSize: 52, letterSpacing: -1.5, lineHeight: 58 },
  subtitle: { color: '#d1ded6', fontSize: 20, lineHeight: 29, maxWidth: 900 }, choices: { gap: 14 }, choicesDesktop: { flexDirection: 'row' },
  choice: { backgroundColor: 'rgba(4,43,30,.66)', borderColor: '#75e7a7', borderRadius: 12, borderWidth: 1, flex: 1, minHeight: 142, padding: 22, position: 'relative' }, choiceTitle: { color: '#f5f7ef', fontSize: 20, fontWeight: '900', maxWidth: '80%' },
  copy: { color: '#c7d3cc', fontSize: 15, lineHeight: 22 }, arrow: { color: '#f5f7ef', fontSize: 30 }, divider: { backgroundColor: 'rgba(210,255,226,.25)', height: 1, marginTop: 8 }, sectionTitle: { color: '#f5f7ef', fontSize: 28, fontWeight: '900' },
  list: { marginTop: 4, padding: 0 }, row: { alignItems: 'center', borderBottomColor: 'rgba(210,255,226,.2)', borderBottomWidth: 1, flexDirection: 'row', gap: 14, minHeight: 82, padding: 18 }, rowTitle: { color: '#f5f7ef', fontSize: 18, fontWeight: '800' },
  status: { borderColor: authTokens.colors.primary, borderRadius: 16, borderWidth: 1, color: authTokens.colors.primary, paddingHorizontal: 12, paddingVertical: 6 }, footnote: { color: '#d1ded6', fontSize: 14, marginTop: 10 },
});
