import { useRouter, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { authTokens } from '../../../../src/design/tokens';
import { AuthAlert, AuthLoading } from '../../../../src/design/components/auth-primitives';
import { usePassportState } from '../../../../src/passport/passport-state';
import { StatusView } from '../../../../src/passport/status-view';

export default function PassportStatusRoute() {
  const router = useRouter();
  const { passportId } = useLocalSearchParams<{ passportId?: string }>();
  const passport = usePassportState();

  if (!passportId) return null;

  const loading = passport.state.phase === 'loading' && !passport.state.status;

  if (loading) return <AuthLoading label="Cargando estado" />;

  if (passport.state.status && !passport.state.status.availableActions.some(action => action === 'VIEW_HISTORY' || action === 'VIEW_INTERNAL_HISTORY')) {
    return (
      <View style={styles.screen}>
        <AuthAlert
          variant="warning"
          message="No tienes autorización para ver el estado e historial."
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusView
        status={passport.state.status}
        history={passport.state.history}
        internalHistory={passport.state.internalHistory}
        loading={passport.state.phase === 'loading'}
        notice={passport.state.notice}
        onRetry={() => {
          void passport.selectPassport(passportId);
        }}
        onEdit={() => {
          router.push(`/passports/${passportId}/edit` as never);
        }}
        onSubmit={() => {
          void passport.submit(passportId);
        }}
        onReturn={() => {
          router.push(`/passports/${passportId}/review` as never);
        }}
        onResolveDuplicate={() => {
          router.push(`/passports/${passportId}/review` as never);
        }}
        onApprove={() => {
          router.push(`/passports/${passportId}/review` as never);
        }}
        onActivate={() => {
          router.push(`/passports/${passportId}/activate` as never);
        }}
        onViewHistory={() => {
          void passport.loadHistory(passportId);
        }}
        onViewInternalHistory={() => {
          void passport.loadInternalHistory(passportId);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: authTokens.spacing.lg, width: '100%' },
});
