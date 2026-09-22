import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { authTokens } from '../../design/tokens';
import { AuthAlert, AuthLoading } from '../../design/components/auth-primitives';
import { PASSPORT_NOTICE_MESSAGES, type PassportStateNotice } from '../passport-state';
import type {
  PassportSectionAvailability,
  PassportStatus,
  PossibleDuplicateSignalResponse,
} from '../passport-types';
import { LIFECYCLE_STATE_LABELS } from '../passport-types';

type PassportLifecycleStatusProps = Readonly<{
  status: PassportStatus | null;
  signals?: readonly PossibleDuplicateSignalResponse[] | null;
  notice?: PassportStateNotice | null;
  loading?: boolean;
}>;

type PassportSectionStateProps = Readonly<{
  title: string;
  availability: PassportSectionAvailability;
  message?: string | null;
  children?: ReactNode;
}>;

function hasConfirmedExistingPlayer(signals: readonly PossibleDuplicateSignalResponse[] | null | undefined): boolean {
  return Boolean(signals?.some((signal) => signal.resolution === 'CONFIRMED_EXISTING_PLAYER'));
}

export function PassportLifecycleStatus({
  status,
  signals,
  notice,
  loading = false,
}: PassportLifecycleStatusProps) {
  if (loading && !status) {
    return <AuthLoading label="Cargando estado del pasaporte" />;
  }

  const confirmedDuplicate = hasConfirmedExistingPlayer(signals);
  if (confirmedDuplicate) {
    return <AuthAlert variant="warning" message="No disponible" />;
  }

  if (!status) {
    return <AuthAlert variant="info" message="No disponible" />;
  }

  if (notice) {
    const variant = notice === 'validation' || notice === 'invalid-state' || notice === 'unresolved-signal' ? 'warning' : 'danger';
    return <AuthAlert variant={variant} message={PASSPORT_NOTICE_MESSAGES[notice]} />;
  }

  return (
    <View style={styles.statusCard} testID="passport-lifecycle-status">
      <Text accessibilityRole="header" style={styles.statusTitle}>Estado del pasaporte</Text>
      <Text style={styles.statusValue}>{LIFECYCLE_STATE_LABELS[status]}</Text>
    </View>
  );
}

export function PassportSectionState({
  title,
  availability,
  message,
  children,
}: PassportSectionStateProps) {
  return (
    <View style={styles.section} testID={`passport-section-${title}`}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      {availability === 'available' ? (
        children ?? <Text style={styles.availableFallback}>{message ?? 'Información disponible'}</Text>
      ) : (
        <AuthAlert
          variant={availability === 'restricted' ? 'warning' : 'info'}
          message={message ?? defaultSectionMessage(availability)}
        />
      )}
    </View>
  );
}

function defaultSectionMessage(availability: PassportSectionAvailability): string {
  switch (availability) {
    case 'empty': return 'No hay información para esta sección.';
    case 'unavailable': return 'Esta sección no está disponible.';
    case 'restricted': return 'No tienes autorización para ver esta sección.';
    default: return 'Información disponible';
  }
}

const styles = StyleSheet.create({
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: authTokens.spacing.xs },
  statusTitle: { color: authTokens.colors.textSecondary, ...authTokens.typography.caption },
  statusValue: { color: authTokens.colors.textSecondary, ...authTokens.typography.caption },
  section: { gap: authTokens.spacing.sm, width: '100%' },
  sectionTitle: { color: authTokens.colors.textPrimary, ...authTokens.typography.title },
  availableFallback: { color: authTokens.colors.textSecondary, ...authTokens.typography.body },
});
