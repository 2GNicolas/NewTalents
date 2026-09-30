import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { useAuthentication } from '../../src/authentication/authentication-provider';
import { AuthAlert, AuthButton, AuthTextField } from '../../src/design/components/auth-primitives';
import { AuthLayout } from '../../src/design/components/auth-layout';
import { AuthenticationBackground, AuthenticationVisualPanel } from '../../src/design/components/auth-visual-panel';
import { AuthenticationBrand } from '../../src/design/components/authentication-brand';
import { authTokens } from '../../src/design/tokens';
import { NavigationBackLink } from '../../src/design/components/navigation-back-link';

type FieldErrors = Readonly<{ email?: string; password?: string }>;

function validate(email: string, password: string): FieldErrors {
  const errors: { email?: string; password?: string } = {};
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Introduce un correo válido.';
  if (password.length < 12 || password.length > 128) errors.password = 'La contraseña debe tener entre 12 y 128 caracteres.';
  return errors;
}

function noticeMessage(notice?: string) {
  if (notice === 'throttled') return 'Demasiados intentos. Inténtalo de nuevo más tarde.';
  if (notice === 'connectivity-failure') return 'No pudimos conectar con New Talents. Revisa tu conexión e inténtalo de nuevo.';
  if (notice === 'backend-unavailable') return 'New Talents no está disponible ahora. Inténtalo de nuevo más tarde.';
  if (notice === 'invalid-request') return 'Revisa los datos e inténtalo nuevamente.';
  if (notice === 'generic-authentication-failure') return 'No pudimos iniciar sesión con esos datos.';
  return undefined;
}

export default function LoginScreen() {
  const router = useRouter();
  const authentication = useAuthentication();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const submitting = authentication.state.phase === 'login-submitting';
  const notice = noticeMessage(authentication.state.notice);

  useEffect(() => {
    authentication.prepareLogin();
    return () => { setPassword(''); };
  }, []);
  useEffect(() => { if (authentication.state.phase === 'authenticated') setPassword(''); }, [authentication.state.phase]);
  const fields = useMemo(() => ({ email: email.trim(), password }), [email, password]);

  const submit = () => {
    if (submitting) return;
    const nextErrors = validate(fields.email, fields.password);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    void authentication.login(fields);
  };

  return (
    <AuthLayout background={<AuthenticationBackground />} formHeader={<NavigationBackLink onPress={() => router.replace('/')} />} visual={<AuthenticationVisualPanel journey="login" />}>
      <View style={{ gap: authTokens.spacing.md }} testID="login-form-flow">
        <AuthenticationBrand variant="form" style={{ alignSelf: 'flex-start' }} />
        <View style={{ gap: authTokens.spacing.xxs }}>
          <Text accessibilityRole="header" style={{ color: authTokens.colors.textPrimary, fontSize: 28, fontWeight: '500', letterSpacing: -0.45, lineHeight: 34 }}>Iniciar sesión</Text>
          <Text style={{ color: authTokens.colors.textSecondary, ...authTokens.typography.caption }}>Continúa construyendo tu perfil deportivo.</Text>
        </View>
        {notice ? <AuthAlert variant={authentication.state.notice === 'generic-authentication-failure' ? 'danger' : 'warning'} message={notice} /> : null}
        <View style={{ gap: authTokens.spacing.sm }}>
          <AuthTextField label="Correo electrónico" value={email} onChangeText={setEmail} error={errors.email} keyboardType="email-address" autoComplete="email" textContentType="username" />
          <AuthTextField label="Contraseña" value={password} onChangeText={setPassword} error={errors.password} isPassword autoComplete="current-password" textContentType="password" />
          <AuthButton label="Iniciar sesión" loading={submitting} onPress={submit} testID="login-primary-action" />
        </View>
      </View>
    </AuthLayout>
  );
}
