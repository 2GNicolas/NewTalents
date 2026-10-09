import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { authTokens } from '../../../../src/design/tokens';
import { AuthAlert, AuthLoading } from '../../../../src/design/components/auth-primitives';
import { DraftForm, type DraftSubmission } from '../../../../src/passport/forms/draft-form';
import { PASSPORT_NOTICE_MESSAGES, usePassportState, type PassportStateNotice } from '../../../../src/passport/passport-state';

export default function EditPassportRoute() {
  const router = useRouter();
  const { passportId } = useLocalSearchParams<{ passportId?: string }>();
  const passport = usePassportState();
  const [notice, setNotice] = useState<PassportStateNotice | null>(null);
  const canEdit = passport.hasCapability('EDIT');
  useEffect(() => { if (passportId && canEdit && !passport.state.editableDraft) void passport.loadEditableDraft(passportId); }, [canEdit, passport.loadEditableDraft, passport.state.editableDraft, passportId]);

  if (!passportId) return null;
  if (!canEdit) return <View style={styles.screen}><AuthAlert variant="warning" message="La edición no está disponible para este pasaporte." /></View>;
  if (!passport.state.editableDraft) return <AuthLoading label="Cargando borrador protegido" />;

  const handleSubmit = async (submission: DraftSubmission) => {
    if (submission.mode !== 'edit') return;
    setNotice(null);
    const result = await passport.editDraft(passportId, submission.input);
    if (result.kind === 'success') {
      router.replace(`/passports/${passportId}/sections/resumen` as never);
      return;
    }
    setNotice(result.kind);
  };

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>Editar pasaporte</Text>
      <DraftForm
        mode="edit"
        initial={passport.state.editableDraft ?? undefined}
        mutationAvailable={passport.state.status?.ageSensitiveMutationAvailability === 'AVAILABLE'}
        submitting={passport.state.phase === 'mutation'}
        notice={notice ? PASSPORT_NOTICE_MESSAGES[notice] : null}
        onSubmit={(submission) => { void handleSubmit(submission); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: authTokens.spacing.md, padding: authTokens.spacing.lg, width: '100%' },
  title: { color: authTokens.colors.textPrimary, ...authTokens.typography.title },
});
