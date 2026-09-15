import { type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { AuthButton, AuthLoading } from '../../design/components/auth-primitives';
import { AuthLayout } from '../../design/components/auth-layout';
import { BrandMark } from '../../design/brand';
import type { AuthenticationPhase } from '../authentication-state';

type RestorationGateProps = { phase: AuthenticationPhase; children: ReactNode; onRetry?: () => void };

/** Blocks route children until the initial authentication choice has a safe outcome. */
export function RestorationGate({ phase, children, onRetry }: RestorationGateProps) {
  if (phase === 'restoring' || phase === 'refreshing') {
    return <AuthLayout><View accessibilityLabel="Restaurando sesión"><BrandMark /><AuthLoading label="Restaurando sesión" /></View></AuthLayout>;
  }
  if (phase === 'connectivity-failure' || phase === 'backend-unavailable') {
    const message = phase === 'connectivity-failure' ? 'No pudimos conectar con New Talents.' : 'New Talents no está disponible ahora.';
    return (
      <AuthLayout>
        <View accessibilityLiveRegion="polite">
          <BrandMark />
          <Text>{message}</Text>
          {onRetry ? <AuthButton label="Reintentar" onPress={onRetry} variant="secondary" /> : null}
        </View>
      </AuthLayout>
    );
  }
  return <>{children}</>;
}
