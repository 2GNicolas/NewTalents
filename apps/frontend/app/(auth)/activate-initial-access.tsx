import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuthentication } from '../../src/authentication/authentication-provider';
import { AuthAlert, AuthButton, AuthTextField } from '../../src/design/components/auth-primitives';
import { AuthLayout } from '../../src/design/components/auth-layout';
import { AuthenticationBackground, AuthenticationVisualPanel } from '../../src/design/components/auth-visual-panel';
import { AuthenticationBrand } from '../../src/design/components/authentication-brand';
import { authTokens } from '../../src/design/tokens';

type ActivationErrors = Readonly<{ email?: string; temporaryCredential?: string; newPassword?: string; confirmation?: string }>;

function validate(email: string, temporaryCredential: string, newPassword: string, confirmation: string): ActivationErrors {
  const errors: { email?: string; temporaryCredential?: string; newPassword?: string; confirmation?: string } = {};
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Introduce un correo válido.';
  if (!temporaryCredential) errors.temporaryCredential = 'Introduce la credencial temporal.';
  if (newPassword.length < 12 || newPassword.length > 128) errors.newPassword = 'La nueva contraseña debe tener entre 12 y 128 caracteres.';
  if (confirmation !== newPassword) errors.confirmation = 'Confirma tu nueva contraseña.';
  return errors;
}

function activationNotice(notice?: string) {
  if (notice === 'connectivity-failure') return 'No pudimos conectar con New Talents. Revisa tu conexión e inténtalo de nuevo.';
  if (notice === 'backend-unavailable') return 'New Talents no está disponible ahora. Inténtalo de nuevo más tarde.';
  if (notice) return 'No pudimos activar el acceso con esos datos.';
  return undefined;
}

export function ActivationSuccess({ onContinue }: { onContinue: () => void }) {
  return (
    <AuthLayout background={<AuthenticationBackground />} visual={<AuthenticationVisualPanel journey="activation" />}>
      <View accessibilityLiveRegion="polite" style={{ gap: authTokens.spacing.lg }}>
        <AuthenticationBrand variant="form" style={{ alignSelf: 'flex-start' }} />
        <Text accessibilityRole="header" style={{ color: authTokens.colors.textPrimary, ...authTokens.typography.display }}>Acceso activado</Text>
        <Text style={{ color: authTokens.colors.textSecondary, ...authTokens.typography.body }}>Tu sesión está lista para continuar de forma segura.</Text>
        <AuthButton label="Continuar" onPress={onContinue} />
      </View>
    </AuthLayout>
  );
}

export default function ActivateInitialAccessScreen() {
  const router = useRouter();
  const authentication = useAuthentication();
  const [email, setEmail] = useState('');
  const [temporaryCredential, setTemporaryCredential] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<ActivationErrors>({});
  const submitting = authentication.state.phase === 'activation-submitting';
  const notice = activationNotice(authentication.state.notice);
  const clearSecrets = () => { setTemporaryCredential(''); setNewPassword(''); setConfirmation(''); };

  useEffect(() => {
    authentication.prepareActivation();
    return () => { setTemporaryCredential(''); setNewPassword(''); setConfirmation(''); };
  }, []);
  if (authentication.state.phase === 'activation-success') return <ActivationSuccess onContinue={() => authentication.continueAfterActivation()} />;

  const submit = () => {
    if (submitting) return;
    const nextErrors = validate(email, temporaryCredential, newPassword, confirmation);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    void authentication.activateInitialAccess({ email: email.trim(), temporaryCredential, newPassword });
  };

  return (
    <AuthLayout background={<AuthenticationBackground />} visual={<AuthenticationVisualPanel journey="activation" />}>
      <View style={{ gap: authTokens.spacing.md }} testID="activation-form-flow">
        <AuthenticationBrand variant="form" style={{ alignSelf: 'flex-start' }} />
        <View style={{ gap: authTokens.spacing.xs }}>
          <Text accessibilityRole="header" style={{ color: authTokens.colors.textPrimary, fontSize: 28, fontWeight: '500', letterSpacing: -0.45, lineHeight: 34 }}>Activar acceso inicial</Text>
          <Text style={{ color: authTokens.colors.textSecondary, ...authTokens.typography.caption }}>Usa la credencial temporal que New Talents te proporcionó por un canal externo para crear tu contraseña.</Text>
        </View>
        {notice ? <AuthAlert variant="danger" message={notice} /> : null}
        <View style={{ gap: authTokens.spacing.sm }}>
          <AuthTextField label="Correo electrónico" value={email} onChangeText={setEmail} error={errors.email} keyboardType="email-address" autoComplete="email" textContentType="username" />
          <AuthTextField label="Credencial temporal" value={temporaryCredential} onChangeText={setTemporaryCredential} error={errors.temporaryCredential} isPassword autoComplete="off" textContentType="none" />
          <Text style={{ color: authTokens.colors.textSecondary, ...authTokens.typography.caption }}>La nueva contraseña debe tener entre 12 y 128 caracteres.</Text>
          <AuthTextField label="Nueva contraseña" value={newPassword} onChangeText={setNewPassword} error={errors.newPassword} isPassword autoComplete="new-password" textContentType="newPassword" />
          <AuthTextField label="Confirmar nueva contraseña" value={confirmation} onChangeText={setConfirmation} error={errors.confirmation} isPassword autoComplete="new-password" textContentType="newPassword" />
          <AuthButton label="Activar acceso" loading={submitting} onPress={submit} />
          <AuthButton label="Volver al inicio de sesión" variant="secondary" onPress={() => { clearSecrets(); authentication.prepareLogin(); router.replace('/(auth)/login'); }} />
        </View>
      </View>
    </AuthLayout>
  );
}
