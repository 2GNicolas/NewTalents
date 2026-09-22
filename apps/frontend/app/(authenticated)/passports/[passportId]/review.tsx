import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { authTokens } from '../../../../src/design/tokens';
import { AuthAlert, AuthButton, AuthTextField } from '../../../../src/design/components/auth-primitives';
import { PASSPORT_NOTICE_MESSAGES, usePassportState, type PassportStateNotice } from '../../../../src/passport/passport-state';
import type { DuplicateResolution } from '../../../../src/passport/passport-types';

const RESOLUTION_OPTIONS: readonly DuplicateResolution[] = ['DIFFERENT_PLAYER', 'RETURN_FOR_CORRECTION', 'CONFIRMED_EXISTING'];
const RESOLUTION_LABELS: Readonly<Record<DuplicateResolution, string>> = Object.freeze({
  DIFFERENT_PLAYER: 'Jugadores diferentes',
  RETURN_FOR_CORRECTION: 'Corregible',
  CONFIRMED_EXISTING: 'Jugador existente confirmado',
});

export default function ReviewPassportRoute() {
  const { passportId } = useLocalSearchParams<{ passportId?: string }>();
  const passport = usePassportState();
  const [resolution, setResolution] = useState<DuplicateResolution | null>(null);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<PassportStateNotice | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  if (!passportId) return null;

  const capabilities = passport.state.status?.availableActions ?? [];
  const noticeMessage = notice ? PASSPORT_NOTICE_MESSAGES[notice] : null;

  const handleReturn = async () => {
    if (!reason.trim()) {
      setFieldError('Ingresa un motivo de correcci\u00f3n');
      return;
    }
    setNotice(null);
    setFieldError(null);
    const result = await passport.returnForCorrection(passportId, { reason: reason.trim() });
    if (result.kind !== 'success') setNotice(result.kind);
  };

  const handleResolve = async () => {
    if (!resolution) {
      setFieldError('Selecciona una resoluci\u00f3n');
      return;
    }
    if (resolution === 'RETURN_FOR_CORRECTION' && !reason.trim()) {
      setFieldError('Ingresa un motivo de correcci\u00f3n');
      return;
    }
    setNotice(null);
    setFieldError(null);
    const result = await passport.resolveDuplicate(passportId, {
      resolution,
      creatorSafeReason: resolution === 'RETURN_FOR_CORRECTION' ? reason.trim() : undefined,
    });
    if (result.kind !== 'success') setNotice(result.kind);
  };

  const handleApprove = async () => {
    setNotice(null);
    const result = await passport.approve(passportId);
    if (result.kind !== 'success') setNotice(result.kind);
  };

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>{'Revisi\u00f3n de pasaporte'}</Text>
      {noticeMessage ? <AuthAlert variant="danger" message={noticeMessage} /> : null}
      {fieldError ? <AuthAlert variant="warning" message={fieldError} /> : null}
      {capabilities.includes('RESOLVE_DUPLICATE') ? (
        <View style={styles.block}>
          <Text style={styles.subtitle}>Resolver posible duplicado</Text>
          <View style={styles.options}>
            {RESOLUTION_OPTIONS.map((option) => (
              <AuthButton
                key={option}
                label={RESOLUTION_LABELS[option]}
                variant={resolution === option ? 'primary' : 'secondary'}
                onPress={() => { setResolution(option); setFieldError(null); }}
              />
            ))}
          </View>
          {resolution === 'RETURN_FOR_CORRECTION' ? <AuthTextField label={'Motivo de correcci\u00f3n'} value={reason} onChangeText={setReason} /> : null}
          <AuthButton label="Resolver" onPress={() => { void handleResolve(); }} loading={passport.state.phase === 'mutation'} disabled={passport.state.phase === 'mutation'} />
        </View>
      ) : null}
      {capabilities.includes('RETURN') ? (
        <View style={styles.block}>
          <Text style={styles.subtitle}>{'Devolver para correcci\u00f3n'}</Text>
          <AuthTextField label={'Motivo de correcci\u00f3n'} value={reason} onChangeText={setReason} />
          <AuthButton label="Devolver" onPress={() => { void handleReturn(); }} loading={passport.state.phase === 'mutation'} disabled={passport.state.phase === 'mutation'} />
        </View>
      ) : null}
      {capabilities.includes('APPROVE') ? (
        <View style={styles.block}>
          <AuthButton label="Aprobar" onPress={() => { void handleApprove(); }} loading={passport.state.phase === 'mutation'} disabled={passport.state.phase === 'mutation'} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: authTokens.spacing.md, padding: authTokens.spacing.lg, width: '100%' },
  title: { color: authTokens.colors.textPrimary, ...authTokens.typography.title },
  subtitle: { color: authTokens.colors.textPrimary, ...authTokens.typography.label },
  block: { gap: authTokens.spacing.sm },
  signals: { gap: authTokens.spacing.xs },
  signal: { color: authTokens.colors.textSecondary, ...authTokens.typography.caption },
  options: { gap: authTokens.spacing.xs },
});
