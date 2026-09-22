import { StyleSheet, Text, View } from 'react-native';

import { authTokens } from '../design/tokens';
import { AuthAlert, AuthButton, AuthLoading } from '../design/components/auth-primitives';
import { PassportActions } from './role-interfaces';
import { PASSPORT_NOTICE_MESSAGES, type PassportStateNotice } from './passport-state';
import { LIFECYCLE_STATE_LABELS, type InternalPassportHistoryResponse, type PassportHistoryResponse, type PassportStatusResponse } from './passport-types';

type StatusViewProps = Readonly<{
  status: PassportStatusResponse | null;
  history: PassportHistoryResponse | null;
  internalHistory?: InternalPassportHistoryResponse | null;
  loading: boolean;
  notice?: PassportStateNotice | null;
  onRetry?: () => void;
  onEdit?: () => void;
  onSubmit?: () => void;
  onReturn?: () => void;
  onResolveDuplicate?: () => void;
  onApprove?: () => void;
  onActivate?: () => void;
  onViewHistory?: () => void;
  onViewInternalHistory?: () => void;
}>;

const ACTION_LABELS: Readonly<Record<string, string>> = Object.freeze({
  CREATED: 'Creaci\u00f3n',
  INITIAL_RESPONSIBILITY_ESTABLISHED: 'Responsabilidad inicial',
  EDITED: 'Edici\u00f3n',
  SUBMITTED: 'Presentaci\u00f3n',
  RETURNED: 'Devoluci\u00f3n para correcci\u00f3n',
  POSSIBLE_DUPLICATE_RESOLVED: 'Resoluci\u00f3n de posible duplicado',
  APPROVED: 'Aprobaci\u00f3n',
  ACTIVATED: 'Activaci\u00f3n',
});

export function StatusView({
  status,
  history,
  internalHistory,
  loading,
  notice,
  onRetry,
  onEdit,
  onSubmit,
  onReturn,
  onResolveDuplicate,
  onApprove,
  onActivate,
  onViewHistory,
  onViewInternalHistory,
}: StatusViewProps) {
  if (loading && !status) return <AuthLoading label="Cargando pasaporte" />;

  const noticeMessage = notice ? PASSPORT_NOTICE_MESSAGES[notice] : null;
  const capabilities = status?.availableActions ?? [];

  return (
    <View style={styles.container}>
      {noticeMessage ? <AuthAlert variant={notice === 'forbidden' ? 'warning' : 'danger'} message={noticeMessage} /> : null}
      {status ? (
        <View style={styles.statusBlock}>
          <Text accessibilityRole="header" style={styles.title}>Estado del pasaporte</Text>
          <Text style={styles.statusText}>{LIFECYCLE_STATE_LABELS[status.lifecycleState]}</Text>
          <Text style={styles.detail}>{status.displayName}</Text>
          <Text style={styles.detail}>{'Origen: '}{status.origin === 'ACADEMY' ? status.academyOriginName ?? 'Academia' : 'Particular'}</Text>
          {status.correctionReason ? <Text style={styles.detail}>{'Motivo de correcci\u00f3n: '}{status.correctionReason}</Text> : null}
        </View>
      ) : null}
      <PassportActions
        capabilities={capabilities}
        onEdit={onEdit}
        onSubmit={onSubmit}
        onReturn={onReturn}
        onResolveDuplicate={onResolveDuplicate}
        onApprove={onApprove}
        onActivate={onActivate}
        onViewHistory={onViewHistory}
      />
      {capabilities.includes('VIEW_INTERNAL_HISTORY') && onViewInternalHistory ? <AuthButton label="Ver auditoría interna" onPress={onViewInternalHistory} variant="secondary" /> : null}
      {history && history.events.length > 0 ? (
        <View style={styles.historyBlock}>
          <Text style={styles.subtitle}>Historial</Text>
          {history.events.map((event) => (
            <View key={event.eventId} style={styles.event}>
              <Text style={styles.eventAction}>{ACTION_LABELS[event.action] ?? event.action}</Text>
              <Text style={styles.eventDetail}>{event.occurredAt}</Text>
              {event.resultingState ? <Text style={styles.eventDetail}>{'Resultado: '}{LIFECYCLE_STATE_LABELS[event.resultingState]}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
      {internalHistory && internalHistory.events.length > 0 ? <View style={styles.historyBlock}><Text style={styles.subtitle}>Auditoría interna</Text>{internalHistory.events.map(event => <View key={event.eventId} style={styles.event}><Text style={styles.eventAction}>{event.action}</Text><Text style={styles.eventDetail}>{event.occurredAt}</Text></View>)}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: authTokens.spacing.md, width: '100%' },
  statusBlock: { gap: authTokens.spacing.xs },
  title: { color: authTokens.colors.textPrimary, ...authTokens.typography.title },
  subtitle: { color: authTokens.colors.textPrimary, ...authTokens.typography.label },
  statusText: { color: authTokens.colors.primary, ...authTokens.typography.body },
  detail: { color: authTokens.colors.textSecondary, ...authTokens.typography.body },
  historyBlock: { gap: authTokens.spacing.xs },
  event: { borderLeftColor: authTokens.colors.border, borderLeftWidth: 2, gap: 2, paddingLeft: authTokens.spacing.sm },
  eventAction: { color: authTokens.colors.textPrimary, ...authTokens.typography.label },
  eventDetail: { color: authTokens.colors.textMuted, ...authTokens.typography.caption },
});
