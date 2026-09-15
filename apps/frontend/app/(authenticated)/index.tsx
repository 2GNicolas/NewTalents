import { useState } from 'react';
import { Text, View } from 'react-native';

import { useAuthentication } from '../../src/authentication/authentication-provider';
import { SessionStatus } from '../../src/authentication/components/session-status';
import { AuthButton, AuthConfirmationSurface } from '../../src/design/components/auth-primitives';
import { AuthLayout } from '../../src/design/components/auth-layout';
import { AuthenticationBrand } from '../../src/design/components/authentication-brand';
import { authTokens } from '../../src/design/tokens';

/** Deliberately neutral authenticated boundary: it exposes session actions only, not product data. */
export default function AuthenticatedRouteShell() {
  const authentication = useAuthentication();
  const [confirmAll, setConfirmAll] = useState(false);
  const busy = authentication.state.phase === 'logout-current' || authentication.state.phase === 'logout-all';
  const statusOnly = authentication.state.phase === 'session-expired' || authentication.state.phase === 'refreshing';

  return (
    <AuthLayout>
      <View style={{ gap: authTokens.spacing.lg }}>
        <AuthenticationBrand variant="form" style={{ alignSelf: 'center' }} />
        <View style={{ gap: authTokens.spacing.sm }}>
          <Text accessibilityRole="header" style={{ color: authTokens.colors.textPrimary, textAlign: 'center', ...authTokens.typography.display }}>Acceso activo</Text>
          <Text style={{ color: authTokens.colors.textSecondary, textAlign: 'center', ...authTokens.typography.body }}>Tu sesión de New Talents está activa.</Text>
        </View>
        <SessionStatus state={authentication.state} onRetry={() => { void authentication.refresh(); }} onReturnToLogin={() => { void authentication.clearLocalSession(); }} />
        {!statusOnly ? <View style={{ gap: authTokens.spacing.sm }}>
          <AuthButton label="Cerrar sesión" disabled={busy} loading={authentication.state.phase === 'logout-current'} onPress={() => { void authentication.logout('current'); }} />
          <AuthButton label="Cerrar todas las sesiones" disabled={busy} variant="secondary" onPress={() => setConfirmAll(true)} />
        </View> : null}
        <Text style={{ color: authTokens.colors.textMuted, textAlign: 'center', ...authTokens.typography.caption }}>Los próximos módulos estarán disponibles aquí.</Text>
        <AuthConfirmationSurface visible={confirmAll} title="Cerrar todas las sesiones" message="Tu acceso se cerrará también en los demás dispositivos." confirmLabel="Cerrar todas las sesiones" onCancel={() => setConfirmAll(false)} onConfirm={() => { setConfirmAll(false); void authentication.logout('all'); }} />
      </View>
    </AuthLayout>
  );
}
