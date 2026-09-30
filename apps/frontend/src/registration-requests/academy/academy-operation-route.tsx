import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useAuthentication } from '../../authentication/authentication-provider';
import { createRegistrationRequestApi } from '../registration-request-api';
import { RegistrationFlowRoute, type FlowOperations } from '../flows/registration-flow-route';
import type { AcademyContext } from './academy-operation-shared';

export function AcademyOperationRoute({ academyId, children, preview = false }: Readonly<{ academyId: string; preview?: boolean; children: (academy: AcademyContext, operations: FlowOperations) => ReactNode }>) {
  const authentication = useAuthentication();
  const effectiveAcademyId = academyId || authentication.sessionAccess?.academyId || '';
  const api = useMemo(() => createRegistrationRequestApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const [academy, setAcademy] = useState<AcademyContext | null>(preview ? { id: effectiveAcademyId || '11111111-1111-4111-8111-111111111111', name: 'Academia Horizonte Deportivo S.A.S.', location: 'Bogotá D.C., Colombia', approved: true } : null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (preview) return;
    let active = true;
    void api.listAcademy(effectiveAcademyId).then((result) => {
      if (!active) return;
      if (result.kind === 'success') setAcademy({ id: effectiveAcademyId, name: result.value.items[0]?.academyLabel ?? 'Academia aprobada', location: 'Contexto autorizado por el servidor', approved: true });
      else setError(result.kind === 'session-expired' ? 'Tu sesión expiró. Inicia sesión para continuar.' : 'No pudimos confirmar el acceso a esta academia.');
    });
    return () => { active = false; };
  }, [api, effectiveAcademyId, preview]);

  if (error) return <View accessibilityLiveRegion="assertive"><Text>{error}</Text></View>;
  if (!academy) return <ActivityIndicator accessibilityLabel="Cargando academia autorizada" />;
  return <RegistrationFlowRoute readOnly={preview}>{(operations) => children(academy, operations)}</RegistrationFlowRoute>;
}
