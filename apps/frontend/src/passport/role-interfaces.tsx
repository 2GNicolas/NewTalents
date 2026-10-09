import { StyleSheet, View } from 'react-native';

import { authTokens } from '../design/tokens';
import { AuthButton } from '../design/components/auth-primitives';
import type { PassportAction } from './passport-types';

type PassportActionsProps = Readonly<{
  capabilities: readonly PassportAction[];
  onEdit?: () => void;
  onSubmit?: () => void;
  onReturn?: () => void;
  onResolveDuplicate?: () => void;
  onApprove?: () => void;
  onActivate?: () => void;
  onViewHistory?: () => void;
}>;

/**
 * Role-visible actions are rendered exclusively from backend-derived capabilities.
 * No JWT role, local role state, or route visibility is used to decide availability.
 */
export function PassportActions({
  capabilities,
  onEdit,
  onSubmit,
  onReturn,
  onResolveDuplicate,
  onApprove,
  onActivate,
  onViewHistory,
}: PassportActionsProps) {
  return (
    <View style={styles.actions}>
      {capabilities.includes('EDIT') && onEdit ? <AuthButton label="Editar" onPress={onEdit} variant="secondary" /> : null}
      {capabilities.includes('SUBMIT') && onSubmit ? <AuthButton label="Presentar" onPress={onSubmit} /> : null}
      {capabilities.includes('RETURN') && onReturn ? <AuthButton label={'Devolver para correcci\u00f3n'} onPress={onReturn} variant="secondary" /> : null}
      {capabilities.includes('RESOLVE_DUPLICATE') && onResolveDuplicate ? <AuthButton label="Resolver posible duplicado" onPress={onResolveDuplicate} variant="secondary" /> : null}
      {capabilities.includes('APPROVE') && onApprove ? <AuthButton label="Aprobar" onPress={onApprove} /> : null}
      {capabilities.includes('ACTIVATE') && onActivate ? <AuthButton label="Activar" onPress={onActivate} /> : null}
      {capabilities.includes('VIEW_HISTORY') && onViewHistory ? <AuthButton label="Ver historial" onPress={onViewHistory} variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: authTokens.spacing.xs, width: '100%' },
});
