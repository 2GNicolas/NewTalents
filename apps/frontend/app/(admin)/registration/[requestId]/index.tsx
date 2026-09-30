import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuthentication } from '../../../../src/authentication/authentication-provider';
import { AdminRequestReview } from '../../../../src/registration-requests/admin/admin-request-review';
import { createRegistrationRequestApi, type AdminRegistrationReview } from '../../../../src/registration-requests/registration-request-api';

const previewReview: AdminRegistrationReview = {
  id: '11111111-1111-4111-8111-111111111111', type: 'PERSONAL_ADULT', status: 'SUBMITTED', version: 2, versionFresh: true, approvalExecutionStatus: 'NONE', createdAt: '2026-09-28T12:00:00.000Z', submittedAt: '2026-09-28T12:05:00.000Z',
  structuredData: { applicants: [{ id: 'applicant', legalName: 'Valentina Torres', birthDate: '1996-05-14', document: { type: 'CC', number: 'Documento verificado' }, email: 'contacto@example.test' }], players: [], representatives: [], detail: { actingForSelf: true } },
  evidence: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', category: 'IDENTITY_FRONT', status: 'CLEAN', sizeBytes: 204800 }, { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', category: 'IDENTITY_BACK', status: 'CLEAN', sizeBytes: 198000 }],
  consents: [{ type: 'PRIVACY', version: 'privacy-v1', acceptedAt: '2026-09-28T12:04:00.000Z' }], duplicateReview: { state: 'CLEAR', canApprove: true }, capabilities: ['registration.review.view', 'registration.review.view-evidence', 'registration.review.request-correction', 'registration.review.confirm-dossier', 'registration.review.reject'], history: [{ at: '2026-09-28T12:05:00.000Z', action: 'SUBMIT', fromStatus: 'DRAFT', toStatus: 'SUBMITTED', result: 'APPLIED' }],
};

export default function AdminRegistrationReviewScreen() {
  const params = useLocalSearchParams<{ requestId?: string; preview?: string }>();
  const router = useRouter();
  const authentication = useAuthentication();
  const preview = params.preview === 'desktop' || params.preview === 'mobile';
  const api = useMemo(() => createRegistrationRequestApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const [review, setReview] = useState<AdminRegistrationReview | null>(preview ? previewReview : null);
  const [error, setError] = useState<string>();
  const [evidenceUrl, setEvidenceUrl] = useState<string>();
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const evidenceObjectUrl = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (preview || !params.requestId) return;
    let active = true;
    void api.readAdmin(params.requestId).then((result) => { if (!active) return; if (result.kind === 'success') setReview(result.value); else setError(result.kind === 'session-expired' ? 'Tu sesión expiró.' : 'No pudimos abrir esta solicitud.'); });
    return () => { active = false; };
  }, [api, params.requestId, preview]);
  useEffect(() => () => { if (evidenceObjectUrl.current && typeof URL !== 'undefined') URL.revokeObjectURL(evidenceObjectUrl.current); }, []);
  if (error) return <View accessibilityLiveRegion="assertive"><Text>{error}</Text></View>;
  if (!review) return <ActivityIndicator accessibilityLabel="Cargando revisión de solicitud" />;
  const decisionRoute = (mode: 'correction' | 'reject') => router.push({ pathname: '/(admin)/admin/registration/[requestId]/decision' as never, params: { requestId: review.id, mode } });
  return <AdminRequestReview review={review} evidenceLoading={evidenceLoading} evidenceUrl={evidenceUrl} previewMode={preview ? params.preview as 'desktop' | 'mobile' : undefined} onBack={() => router.replace('/(admin)/admin/registration' as never)} onLogout={() => { void authentication.logout('current').then(() => router.replace('/(auth)/login' as never)); }} onCorrection={() => decisionRoute('correction')} onReject={() => decisionRoute('reject')} onOpenEvidence={async (evidenceId) => {
    setEvidenceLoading(true);
    const result = await api.openAdminEvidence?.(review.id, evidenceId);
    setEvidenceLoading(false);
    if (result?.kind !== 'success' || typeof URL === 'undefined' || !URL.createObjectURL) return setError('No pudimos abrir este documento autorizado.');
    if (evidenceObjectUrl.current) URL.revokeObjectURL(evidenceObjectUrl.current);
    evidenceObjectUrl.current = URL.createObjectURL(result.value);
    setEvidenceUrl(evidenceObjectUrl.current);
  }} onContinue={() => router.push({ pathname: '/(admin)/admin/registration/[requestId]/approval' as never, params: { requestId: review.id } })} />;
}
