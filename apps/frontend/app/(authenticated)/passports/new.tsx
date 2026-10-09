import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { authTokens } from '../../../src/design/tokens';
import { AuthLoading } from '../../../src/design/components/auth-primitives';
import { DraftForm, type DraftSubmission } from '../../../src/passport/forms/draft-form';
import { PASSPORT_NOTICE_MESSAGES, usePassportState, type PassportStateNotice } from '../../../src/passport/passport-state';
import type { ManagementContext, PassportCollectionAction } from '../../../src/passport/passport-types';

export default function NewPassportRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ managementContext?: string; academyId?: string }>();
  const passport = usePassportState();
  const [notice, setNotice] = useState<PassportStateNotice | null>(null);
  const managementContext: ManagementContext = params.managementContext === 'LEGAL_REPRESENTATIVE'
    ? 'LEGAL_REPRESENTATIVE'
    : params.managementContext === 'ACADEMY' ? 'ACADEMY' : 'SELF';
  const requiredAction: PassportCollectionAction = managementContext === 'SELF'
    ? 'CREATE_SELF'
    : managementContext === 'LEGAL_REPRESENTATIVE' ? 'CREATE_REPRESENTED_MINOR' : 'CREATE_ACADEMY';
  const canCreate = passport.hasCollectionAction(requiredAction);

  useEffect(() => {
    if (passport.state.collectionActions === null) {
      void passport.loadList(managementContext === 'ACADEMY'
        ? { context: 'ACADEMY', academyId: params.academyId }
        : { context: 'PARTICULAR' });
    }
  }, [managementContext, params.academyId, passport.loadList, passport.state.collectionActions]);

  const handleSubmit = async (submission: DraftSubmission) => {
    if (submission.mode !== 'create') return;
    setNotice(null);
    const result = await passport.createDraft(submission.input);
    if (result.kind === 'success') {
      router.replace(`/passports/${result.value.passportId}/edit` as never);
      return;
    }
    setNotice(result.kind);
  };

  if (passport.state.collectionActions === null) return <AuthLoading label="Verificando acceso" />;

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>Nuevo pasaporte</Text>
      {!canCreate ? (
        <Text style={styles.unavailable}>No tienes autorización para crear un pasaporte.</Text>
      ) : (
        <DraftForm
          mode="create"
          managementContext={managementContext}
          academyId={params.academyId}
          submitting={passport.state.phase === 'mutation'}
          notice={notice ? PASSPORT_NOTICE_MESSAGES[notice] : null}
          onSubmit={(submission) => { void handleSubmit(submission); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: authTokens.spacing.md, padding: authTokens.spacing.lg, width: '100%' },
  title: { color: authTokens.colors.textPrimary, ...authTokens.typography.title },
  unavailable: { color: authTokens.colors.textSecondary, ...authTokens.typography.body },
});
