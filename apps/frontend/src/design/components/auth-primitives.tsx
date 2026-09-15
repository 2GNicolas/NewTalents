import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
  type TextStyle,
  type TextInputProps,
} from 'react-native';

import { authTokens, type AuthAlertVariant, type AuthButtonVariant } from '../tokens';

const glassBlur = Platform.OS === 'web' ? ({ backdropFilter: 'blur(12px)' } as unknown as ViewStyle) : {};
const webInputReset = Platform.OS === 'web'
  ? ({ backgroundColor: 'transparent', borderWidth: 0, outlineColor: 'transparent', outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle)
  : {};

type AuthTextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
  isPassword?: boolean;
};

export function AuthTextField({ label, error, isPassword = false, ...inputProps }: AuthTextFieldProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const secureTextEntry = isPassword && !visible;

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        style={[styles.inputShell, glassBlur, hovered && !focused && styles.inputHovered, focused && styles.inputFocused, Boolean(error) && styles.inputError]}
        testID={`auth-field-${label}`}
      >
        <TextInput
          {...inputProps}
          accessibilityLabel={label}
          autoCapitalize={inputProps.autoCapitalize ?? 'none'}
          autoCorrect={false}
          onBlur={(event) => { setFocused(false); inputProps.onBlur?.(event); }}
          onFocus={(event) => { setFocused(true); inputProps.onFocus?.(event); }}
          placeholderTextColor={authTokens.colors.textMuted}
          secureTextEntry={secureTextEntry}
          style={[styles.input, webInputReset]}
        />
        {isPassword ? (
          <Pressable
            accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setVisible((current) => !current)}
            style={styles.visibilityButton}
          >
            <Text style={styles.visibilityText}>{visible ? 'Ocultar' : 'Mostrar'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text accessibilityLabel={error} accessibilityRole="alert" style={styles.fieldError}>Error: {error}</Text> : null}
    </View>
  );
}

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  variant?: AuthButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
};

export function AuthButton({ label, onPress, variant = 'primary', disabled = false, loading = false, testID }: AuthButtonProps) {
  const [focused, setFocused] = useState(false);
  const inactive = disabled || loading;
  const variantStyle = variant === 'primary' ? styles.primaryButton : variant === 'destructive' ? styles.destructiveButton : styles.secondaryButton;
  const textStyle = variant === 'primary' ? styles.primaryButtonText : styles.secondaryButtonText;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      testID={testID}
      style={[styles.button, variantStyle, focused && styles.buttonFocused, inactive && styles.buttonInactive]}
    >
      <Text style={[styles.buttonText, textStyle, loading && styles.loadingLabel]}>{label}</Text>
      {loading ? <ActivityIndicator accessibilityLabel="Procesando" color={variant === 'primary' ? authTokens.colors.canvasDeep : authTokens.colors.primary} style={styles.buttonSpinner} /> : null}
    </Pressable>
  );
}

export function AuthAlert({ variant, message }: { variant: AuthAlertVariant; message: string }) {
  const variantStyle = variant === 'danger' ? styles.alertDanger : variant === 'warning' ? styles.alertWarning : variant === 'success' ? styles.alertSuccess : styles.alertInfo;
  return <View accessibilityLabel={message} accessibilityRole="alert" style={[styles.alert, variantStyle]}><Text style={styles.alertText}>{message}</Text></View>;
}

export function AuthLoading({ label }: { label: string }) {
  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.loadingBlock}>
      <ActivityIndicator color={authTokens.colors.primary} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

type ConfirmationProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

/** Modal works on web; on native it is presented as a bottom-aligned confirmation surface. */
export function AuthConfirmationSurface({ visible, title, message, confirmLabel, onConfirm, onCancel, children }: ConfirmationProps) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={[styles.modalBackdrop, Platform.OS === 'web' ? styles.modalBackdropWeb : styles.modalBackdropNative]}>
        <View accessibilityLabel={title} accessibilityRole="alert" accessibilityViewIsModal style={styles.confirmationSurface}>
          <Text style={styles.confirmationTitle}>{title}</Text>
          <Text style={styles.confirmationMessage}>{message}</Text>
          {children}
          <View style={styles.confirmationActions}>
            <AuthButton label="Cancelar" onPress={onCancel} variant="secondary" />
            <AuthButton label={confirmLabel} onPress={onConfirm} variant="destructive" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fieldGroup: { gap: authTokens.spacing.xs },
  label: { color: authTokens.colors.textPrimary, ...authTokens.typography.label },
  inputShell: { alignItems: 'center', backgroundColor: 'rgba(30, 33, 31, 0.76)', borderColor: 'rgba(139, 162, 148, 0.34)', borderRadius: 7, borderWidth: 1, flexDirection: 'row', minHeight: authTokens.sizing.fieldHeight, overflow: 'hidden', position: 'relative' },
  inputHovered: { backgroundColor: 'rgba(39, 48, 42, 0.82)', borderColor: 'rgba(165, 196, 175, 0.56)' },
  inputFocused: { backgroundColor: 'rgba(29, 48, 37, 0.88)', borderColor: '#C7FF2E', shadowColor: '#9FEA47', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.46, shadowRadius: 10 },
  inputError: { borderColor: authTokens.colors.danger },
  input: { backgroundColor: 'transparent', borderWidth: 0, color: authTokens.colors.textPrimary, flex: 1, fontSize: 14, minHeight: authTokens.sizing.fieldHeight, paddingHorizontal: authTokens.spacing.sm },
  visibilityButton: { alignItems: 'center', backgroundColor: 'transparent', borderWidth: 0, justifyContent: 'center', minHeight: authTokens.sizing.minInteractiveSize, minWidth: authTokens.sizing.minInteractiveSize, paddingHorizontal: authTokens.spacing.sm },
  visibilityText: { color: '#C9CCC9', fontSize: 12, fontWeight: '500' },
  fieldError: { color: authTokens.colors.danger, ...authTokens.typography.caption },
  button: { alignItems: 'center', borderRadius: 6, justifyContent: 'center', minHeight: authTokens.sizing.buttonHeight, overflow: 'hidden', paddingHorizontal: authTokens.spacing.lg, position: 'relative' },
  primaryButton: { backgroundColor: '#F0F2EF' },
  secondaryButton: { backgroundColor: '#111111', borderColor: '#343434', borderWidth: 1 },
  destructiveButton: { backgroundColor: '#722D26' },
  buttonFocused: { borderColor: authTokens.focus.webOutlineColor, borderWidth: authTokens.focus.borderWidth },
  buttonInactive: { opacity: 0.7 },
  buttonText: { fontSize: 14, fontWeight: '800' },
  primaryButtonText: { color: '#151515' },
  secondaryButtonText: { color: authTokens.colors.textPrimary },
  loadingLabel: { opacity: 0 },
  buttonSpinner: { position: 'absolute' },
  alert: { borderLeftWidth: 3, borderRadius: authTokens.radius.sm, padding: authTokens.spacing.md },
  alertInfo: { backgroundColor: 'rgba(18, 43, 41, 0.92)', borderLeftColor: authTokens.colors.primary },
  alertSuccess: { backgroundColor: 'rgba(23, 51, 38, 0.92)', borderLeftColor: authTokens.colors.success },
  alertWarning: { backgroundColor: 'rgba(59, 50, 24, 0.94)', borderLeftColor: authTokens.colors.warning },
  alertDanger: { backgroundColor: 'rgba(60, 32, 29, 0.94)', borderLeftColor: authTokens.colors.danger },
  alertText: { color: authTokens.colors.textPrimary, ...authTokens.typography.body },
  loadingBlock: { alignItems: 'center', gap: authTokens.spacing.sm, justifyContent: 'center', minHeight: authTokens.sizing.loadingBlockHeight },
  loadingText: { color: authTokens.colors.textSecondary, ...authTokens.typography.body },
  modalBackdrop: { backgroundColor: authTokens.colors.overlay, flex: 1, padding: authTokens.spacing.md },
  modalBackdropWeb: { alignItems: 'center', justifyContent: 'center' },
  modalBackdropNative: { justifyContent: 'flex-end' },
  confirmationSurface: { backgroundColor: authTokens.colors.surfaceElevated, borderColor: authTokens.colors.border, borderRadius: authTokens.radius.lg, borderWidth: 1, gap: authTokens.spacing.md, padding: authTokens.spacing.lg },
  confirmationTitle: { color: authTokens.colors.textPrimary, ...authTokens.typography.title },
  confirmationMessage: { color: authTokens.colors.textSecondary, ...authTokens.typography.body },
  confirmationActions: { flexDirection: 'row', gap: authTokens.spacing.sm, justifyContent: 'space-between' },
});
