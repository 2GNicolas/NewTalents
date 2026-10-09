import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuthentication } from '../../../src/authentication/authentication-provider';
import { AcademyRequestHub } from '../../../src/registration-requests/academy/academy-request-hub';
import type { AcademyContext } from '../../../src/registration-requests/academy/academy-operation-shared';
import { createRegistrationRequestApi, type RegistrationRequestSnapshot } from '../../../src/registration-requests/registration-request-api';

export default function AcademyRegistrationHubScreen() {
  const params = useLocalSearchParams<{ academyId?: string; preview?: string }>();
  const router = useRouter();
  const authentication = useAuthentication();
  const academyId = params.academyId ?? authentication.sessionAccess?.academyId ?? '';
  const preview = params.preview === 'desktop' || params.preview === 'mobile';
  const api = useMemo(() => createRegistrationRequestApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const [academy, setAcademy] = useState<AcademyContext | null>(preview ? { id: academyId || '11111111-1111-4111-8111-111111111111', name: 'Academia Horizonte Deportivo S.A.S.', location: 'Bogotá D.C., Colombia', approved: true } : null);
  const [requests, setRequests] = useState<readonly RegistrationRequestSnapshot[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (preview) return;
    let active = true;
    void api.listAcademy(academyId).then((result) => {
      if (!active) return;
      if (result.kind === 'success') { setAcademy({ id: academyId, name: result.value.items[0]?.academyLabel ?? 'Academia aprobada', location: 'Contexto autorizado por el servidor', approved: true }); setRequests(result.value.items); }
      else {
        setError(result.kind === 'session-expired' ? 'Tu sesión expiró. Inicia sesión para continuar.' : 'No pudimos cargar las solicitudes de esta academia.');
      }
    });
    return () => { active = false; };
  }, [academyId, api, preview]);
  if (error) return <View accessibilityLiveRegion="assertive"><Text>{error}</Text></View>;
  if (!academy) return <ActivityIndicator accessibilityLabel="Cargando solicitudes de academia" />;
  const capabilities = preview ? ['registration.request.academy.create-additional-account', 'registration.request.academy.create-adult-player', 'registration.request.academy.create-minor-player'] : authentication.sessionAccess?.capabilities ?? [];
  return <AcademyRequestHub academy={academy} capabilities={capabilities} requests={requests.filter((request): request is RegistrationRequestSnapshot & { type: 'ADDITIONAL_ACADEMY_ACCOUNT' | 'ACADEMY_ADULT_PLAYER' | 'ACADEMY_MINOR_PLAYER' } => ['ADDITIONAL_ACADEMY_ACCOUNT', 'ACADEMY_ADULT_PLAYER', 'ACADEMY_MINOR_PLAYER'].includes(request.type)) .map((request) => ({ id: request.id, label: request.safeApplicantLabel ?? 'Solicitud de academia', type: request.type, status: request.status }))} onSelectType={(type) => { const route = type === 'ADDITIONAL_ACADEMY_ACCOUNT' ? 'additional-account' : type === 'ACADEMY_ADULT_PLAYER' ? 'player-adult' : 'player-minor'; router.push({ pathname: `/(academy)/registration/${route}` as never, params: { academyId: academy.id } }); }} />;
}
