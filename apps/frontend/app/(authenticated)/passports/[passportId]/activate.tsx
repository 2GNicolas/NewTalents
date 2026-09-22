import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { authTokens } from '../../../../src/design/tokens';
import { AuthAlert, AuthButton } from '../../../../src/design/components/auth-primitives';
import { PASSPORT_NOTICE_MESSAGES, usePassportState, type PassportStateNotice } from '../../../../src/passport/passport-state';

export default function ActivatePassportRoute() {
  const { passportId } = useLocalSearchParams<{ passportId?: string }>();
  const passport = usePassportState();
  const [notice, setNotice] = useState<PassportStateNotice | null>(null);

  if (!passportId) return null;

  const capabilities = passport.state.status?.availableActions ?? [];
  const noticeMessage = notice ? PASSPORT_NOTICE_MESSAGES[notice] : null;

  const handleActivate = async () => {
    setNotice(null);
    const result = await passport.activate(passportId);
    if (result.kind !== 'success') setNotice(result.kind);
  };

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>{'Activaci\u00f3n de pasaporte'}</Text>
      {noticeMessage ? <AuthAlert variant="danger" message={noticeMessage} /> : null}
      {capabilities.includes('ACTIVATE') ? (
        <AuthButton label="Activar" onPress={() => { void handleActivate(); }} loading={passport.state.phase === 'mutation'} disabled={passport.state.phase === 'mutation'} />
      ) : (
        <Text style={styles.unavailable}>{'No tienes disponibilidad para activar este pasaporte.'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: authTokens.spacing.md, padding: authTokens.spacing.lg, width: '100%' },
  title: { color: authTokens.colors.textPrimary, ...authTokens.typography.title },
  unavailable: { color: authTokens.colors.textSecondary, ...authTokens.typography.body },
});
