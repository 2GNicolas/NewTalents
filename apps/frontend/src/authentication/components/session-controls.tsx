import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthButton, AuthConfirmationSurface } from '../../design/components/auth-primitives';
import { authTokens } from '../../design/tokens';
import { useAuthentication } from '../authentication-provider';
import { SessionStatus } from './session-status';

export function SessionControls() {
  const authentication = useAuthentication();
  const [confirmAll, setConfirmAll] = useState(false);
  const busy = authentication.state.phase === 'logout-current' || authentication.state.phase === 'logout-all';
  const statusOnly = authentication.state.phase === 'session-expired' || authentication.state.phase === 'refreshing';

  return (
    <View style={styles.surface}>
      <Text accessibilityRole="header" style={styles.title}>Sesión</Text>
      <SessionStatus
        state={authentication.state}
        onRetry={() => { void authentication.refresh(); }}
        onReturnToLogin={() => { void authentication.clearLocalSession(); }}
      />
      {!statusOnly ? (
        <View style={styles.actions}>
          <AuthButton
            label="Cerrar sesión"
            disabled={busy}
            loading={authentication.state.phase === 'logout-current'}
            onPress={() => { void authentication.logout('current'); }}
          />
          <AuthButton
            label="Cerrar todas las sesiones"
            disabled={busy}
            variant="secondary"
            onPress={() => { setConfirmAll(true); }}
          />
        </View>
      ) : null}
      <AuthConfirmationSurface
        visible={confirmAll}
        title="Cerrar todas las sesiones"
        message="Tu acceso se cerrará también en los demás dispositivos."
        confirmLabel="Cerrar todas las sesiones"
        onCancel={() => { setConfirmAll(false); }}
        onConfirm={() => {
          setConfirmAll(false);
          void authentication.logout('all');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    gap: authTokens.spacing.sm,
    paddingTop: authTokens.spacing.lg,
    width: '100%',
  },
  title: {
    color: authTokens.colors.textPrimary,
    ...authTokens.typography.label,
  },
  actions: {
    gap: authTokens.spacing.sm,
  },
});