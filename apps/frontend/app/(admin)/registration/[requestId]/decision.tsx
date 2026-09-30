import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuthentication } from '../../../../src/authentication/authentication-provider';
import { AdminCorrectionRejection } from '../../../../src/registration-requests/admin/admin-correction-rejection';
import { createRegistrationRequestApi, type AdminRegistrationReview } from '../../../../src/registration-requests/registration-request-api';

const previewReview: AdminRegistrationReview = { id: '11111111-1111-4111-8111-111111111111', type: 'PERSONAL_ADULT', status: 'SUBMITTED', version: 2, versionFresh: true, approvalExecutionStatus: 'NONE', createdAt: '2026-09-28T12:00:00.000Z', structuredData: { applicants: [{ legalName: 'Valentina Torres' }], players: [], representatives: [], detail: {} }, evidence: [{ id: 'a', category: 'IDENTITY_FRONT', status: 'CLEAN', sizeBytes: 100 }, { id: 'b', category: 'IDENTITY_BACK', status: 'CLEAN', sizeBytes: 100 }], consents: [], duplicateReview: { state: 'CLEAR', canApprove: true }, capabilities: ['registration.review.request-correction', 'registration.review.reject'], history: [] };
const key = () => globalThis.crypto?.randomUUID?.() ?? `00000000-0000-4000-8000-${Date.now().toString().padStart(12, '0').slice(-12)}`;

export default function AdminDecisionScreen() {
  const params = useLocalSearchParams<{ requestId?: string; preview?: string }>(); const router = useRouter(); const authentication = useAuthentication();
  const preview = params.preview === 'desktop' || params.preview === 'mobile'; const api = useMemo(() => createRegistrationRequestApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const [review, setReview] = useState<AdminRegistrationReview | null>(preview ? previewReview : null); const [busy, setBusy] = useState(false); const [error, setError] = useState<string>();
  useEffect(() => { if (preview || !params.requestId) return; let active = true; void api.readAdmin(params.requestId).then((result) => { if (!active) return; result.kind === 'success' ? setReview(result.value) : setError('No pudimos abrir esta solicitud.'); }); return () => { active = false; }; }, [api, params.requestId, preview]);
  if (error && !review) return <View accessibilityLiveRegion="assertive"><Text>{error}</Text></View>; if (!review) return <ActivityIndicator accessibilityLabel="Cargando decisión" />;
  const run = async (kind: 'correction' | 'reject', value: { safeReason: string; correctionTargets?: readonly string[] }) => { const method = kind === 'correction' ? api.requestAdminCorrection : api.rejectAdmin; if (!method) return setError('La operación no está disponible.'); setBusy(true); setError(undefined); const result = await method(review.id, { expectedVersion: review.version, idempotencyKey: key(), safeReason: value.safeReason, ...(value.correctionTargets ? { correctionTargets: value.correctionTargets } : {}) } as never); setBusy(false); if (result.kind === 'success') router.replace('/(admin)/admin/registration' as never); else setError(result.kind === 'version-conflict' ? 'La solicitud cambió. Recarga antes de decidir.' : 'No pudimos registrar la decisión.'); };
  return <AdminCorrectionRejection applicantLabel={String(review.structuredData.applicants[0]?.legalName ?? 'Persona solicitante')} evidenceCategories={review.evidence.map((item) => item.category)} busy={busy} error={error} previewMode={preview ? params.preview as 'desktop' | 'mobile' : undefined} onBack={() => router.back()} onCorrection={(value) => void run('correction', value)} onReject={(value) => void run('reject', value)} />;
}
