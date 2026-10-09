import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuthentication } from '../../../src/authentication/authentication-provider';
import { AdminInbox } from '../../../src/registration-requests/admin/admin-inbox';
import { AdminInboxState, type AdminInboxFilters, type AdminInboxView } from '../../../src/registration-requests/admin/admin-inbox-state';
import { createRegistrationRequestApi, type RegistrationRequestSnapshot } from '../../../src/registration-requests/registration-request-api';

const previewRows: readonly RegistrationRequestSnapshot[] = [
  { id: '11111111-1111-4111-8111-111111111111', type: 'PERSONAL_ADULT', status: 'SUBMITTED', version: 2, capabilities: ['registration.review.view'], createdAt: '2026-09-28T12:00:00.000Z', submittedAt: '2026-09-28T12:00:00.000Z', safeApplicantLabel: 'Solicitud personal', evidenceComplete: true, evidence: [] },
  { id: '22222222-2222-4222-8222-222222222222', type: 'ACADEMY_MINOR_PLAYER', status: 'SUBMITTED', version: 1, capabilities: ['registration.review.view'], createdAt: '2026-09-28T11:00:00.000Z', safeApplicantLabel: 'Jugador menor', academyLabel: 'Academia Horizonte', evidenceComplete: true, evidence: [] },
];

export default function AdminRegistrationInboxScreen() {
  const params = useLocalSearchParams<{ preview?: string }>();
  const router = useRouter();
  const authentication = useAuthentication();
  const preview = params.preview === 'desktop' || params.preview === 'mobile';
  const api = useMemo(() => createRegistrationRequestApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const state = useRef(new AdminInboxState(preview ? { listAdmin: async () => ({ kind: 'success', value: { items: previewRows } }) } : api)).current;
  const [view, setView] = useState<AdminInboxView>(state.snapshot);
  const load = useCallback(async () => { await state.load(); setView(state.snapshot); }, [state]);
  useEffect(() => { void load(); }, [load]);
  const filters = async (next: AdminInboxFilters) => { state.setFilters(next); setView(state.snapshot); await load(); };
  return <AdminInbox view={view} previewMode={preview ? params.preview as 'desktop' | 'mobile' : undefined} onFilters={(next) => { void filters(next); }} onOpen={(request) => router.push({ pathname: '/(admin)/admin/registration/[requestId]' as never, params: { requestId: request.id, ...(preview ? { preview: params.preview } : {}) } })} onLoadNext={() => { void state.loadNext().then(() => setView(state.snapshot)); }} onRetry={() => { void load(); }} />;
}
