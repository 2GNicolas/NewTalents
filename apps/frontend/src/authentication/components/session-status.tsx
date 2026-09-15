import { Text, View } from 'react-native';

import type { AuthenticationState } from '../authentication-state';
import { AuthAlert, AuthButton, AuthLoading } from '../../design/components/auth-primitives';
import { authTokens } from '../../design/tokens';

type SessionStatusProps = { state: AuthenticationState; onRetry: () => void; onReturnToLogin: () => void };

/** Presentation-only session status; it never accesses tokens, storage, or HTTP. */
export function SessionStatus({ state, onRetry, onReturnToLogin }: SessionStatusProps) {
  if (state.phase === 'refreshing') return <AuthLoading label="Comprobando tu sesión…" />;
  if (state.phase === 'session-expired') {
    return <View style={{ gap: authTokens.spacing.md }}><Text accessibilityRole="header" style={{ color: authTokens.colors.textPrimary, ...authTokens.typography.title }}>Tu sesión ha expirado</Text><Text style={{ color: authTokens.colors.textSecondary, ...authTokens.typography.body }}>Por seguridad, vuelve a iniciar sesión para continuar.</Text><AuthButton label="Volver al inicio de sesión" onPress={onReturnToLogin} /></View>;
  }
  if (state.notice === 'connectivity-failure') return <View style={{ gap: authTokens.spacing.sm }}><AuthAlert variant="info" message="Sin conexión. Tu sesión se conserva; inténtalo de nuevo cuando puedas." /><AuthButton label="Reintentar" variant="secondary" onPress={onRetry} /></View>;
  if (state.notice === 'backend-unavailable') return <View style={{ gap: authTokens.spacing.sm }}><AuthAlert variant="warning" message="El servicio no está disponible ahora. Tu sesión se conserva; inténtalo de nuevo." /><AuthButton label="Reintentar" variant="secondary" onPress={onRetry} /></View>;
  return null;
}
