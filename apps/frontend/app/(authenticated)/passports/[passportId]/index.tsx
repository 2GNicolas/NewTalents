import { useEffect, useMemo, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { authTokens } from '../../../../src/design/tokens';
import { AuthAlert, AuthLoading } from '../../../../src/design/components/auth-primitives';
import { usePassportState } from '../../../../src/passport/passport-state';
import { StatusView } from '../../../../src/passport/status-view';
import { useAuthentication } from '../../../../src/authentication/authentication-provider';
import { createFirstMatchApi } from '../../../../src/first-match/first-match-api';

export default function PassportStatusRoute() {
  const router = useRouter();
  const { passportId } = useLocalSearchParams<{ passportId?: string }>();
  const passport = usePassportState();
  const authentication = useAuthentication();
  const firstMatchApi = useMemo(() => createFirstMatchApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const [checked, setChecked] = useState<string | null>(null);
  const active = passport.state.status?.passportId === passportId && passport.state.status?.lifecycleState === 'ACTIVE';
  useEffect(() => {
    if (!active || !passportId) return;
    let live = true;
    void firstMatchApi.flow(passportId).then((result) => {
      if (!live) return;
      if (result.kind === 'success' && (result.value.state === 'INVITATION' || result.value.state === 'WAITING'))
        router.replace(`/passports/${passportId}/first-match` as never);
      else if (result.kind === 'success' && result.value.state === 'LOADED')
        router.replace(`/passports/${passportId}/sections/resumen` as never);
      else setChecked(passportId);
    });
    return () => { live = false; };
  }, [active, firstMatchApi, passportId, router]);

  if (!passportId) return null;

  const loading = passport.state.phase === 'loading' && !passport.state.status;

  if (loading) return <AuthLoading label="Cargando estado" />;
  if (active && checked !== passportId) return <AuthLoading label="Cargando primer partido" />;

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
