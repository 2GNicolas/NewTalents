import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuthentication } from '../../../../src/authentication/authentication-provider';
import { AdminDossierApproval, type ApprovalViewState } from '../../../../src/registration-requests/admin/admin-dossier-approval';
import { createRegistrationRequestApi, type AdminOperationResult, type AdminRegistrationReview,
  type RegistrationRequestApi } from '../../../../src/registration-requests/registration-request-api';

const previewReview: AdminRegistrationReview = { id: '11111111-1111-4111-8111-111111111111', type: 'PERSONAL_ADULT', status: 'SUBMITTED', version: 3, versionFresh: true, approvalExecutionStatus: 'RECOVERY_REQUIRED', createdAt: '2026-09-28T12:00:00.000Z', structuredData: { applicants: [{ legalName: 'Valentina Torres' }], players: [], representatives: [], detail: {} }, evidence: [{ id: 'a', category: 'IDENTITY_FRONT', status: 'DELETION_PENDING', sizeBytes: 100 }, { id: 'b', category: 'IDENTITY_BACK', status: 'DELETION_PENDING', sizeBytes: 100 }], consents: [], duplicateReview: { state: 'CLEAR', canApprove: true }, capabilities: ['registration.review.confirm-dossier', 'registration.review.retry-deletion'], history: [], deletion: { status: 'RECOVERY_REQUIRED', totalItems: 2, completedItems: 1 } };
const key = () => globalThis.crypto?.randomUUID?.() ?? `00000000-0000-4000-8000-${Date.now().toString().padStart(12, '0').slice(-12)}`;
const custodyDetailRoute = (passportId: string) => `/admin/custody/${encodeURIComponent(passportId)}`;
export function approvalViewState(review: AdminRegistrationReview): ApprovalViewState { if (review.status === 'APPROVED') return 'approved'; if (review.approvalExecutionStatus === 'RECOVERY_REQUIRED') return 'recovery-required'; if (review.approvalExecutionStatus === 'DELETING_EVIDENCE') return 'pending-deletion'; return 'ready'; }

export default function AdminApprovalScreen() {
  const params = useLocalSearchParams<{ requestId?: string; preview?: string }>(); const router = useRouter(); const authentication = useAuthentication(); const preview = params.preview === 'desktop' || params.preview === 'mobile';
  const api = useMemo(() => createRegistrationRequestApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]); const [review, setReview] = useState<AdminRegistrationReview | null>(preview ? previewReview : null); const [state, setState] = useState<ApprovalViewState>(preview ? 'recovery-required' : 'ready'); const [busy, setBusy] = useState(false); const [error, setError] = useState<string>(); const [approvedPassportId, setApprovedPassportId] = useState<string>(); const approvalKey = useRef(key());
  const approvalCommand = useRef<Parameters<NonNullable<RegistrationRequestApi['approveAdmin']>>[1] | null>(null);
  const resuming = useRef(false);
  const navigated = useRef(false);
  const continueToCustody = useCallback((result: AdminOperationResult) => {
    if (result.outcome !== 'approved' || result.requestStatus !== 'APPROVED'
      || result.passportState !== 'ACTIVE' || !result.passportId || navigated.current) return;
    navigated.current = true;
    setApprovedPassportId(result.passportId);
    router.replace(custodyDetailRoute(result.passportId) as never);
  }, [router]);
  const resumeFinalResult = useCallback(async () => {
    if (!api.approveAdmin || !approvalCommand.current || resuming.current || navigated.current || !review) return false;
    resuming.current = true;
    try {
      const result = await api.approveAdmin(review.id, approvalCommand.current);
      if (result.kind !== 'success') return false;
      if (result.value.outcome === 'approved') { setState('approved'); continueToCustody(result.value); return true; }
      if (result.value.outcome === 'recovery-required' || result.value.outcome === 'recoverable-failure') {
        setState('recovery-required'); return true;
      }
      return false;
    } finally { resuming.current = false; }
  }, [api, continueToCustody, review?.id]);
  useEffect(() => { if (preview || !params.requestId) return; let active = true; void api.readAdmin(params.requestId).then((result) => { if (!active) return; if (result.kind === 'success') { setReview(result.value); setState(approvalViewState(result.value)); } else setError('No pudimos abrir esta solicitud.'); }); return () => { active = false; }; }, [api, params.requestId, preview]);
  useEffect(() => {
    if (preview || !review || state !== 'pending-deletion') return;
    let active = true;
    const interval = setInterval(() => { void api.readAdmin(review.id).then(async (result) => {
      if (!active || result.kind !== 'success') return;
      setReview(result.value);
      const next = approvalViewState(result.value);
      if (next === 'approved' && approvalCommand.current) {
        if (!await resumeFinalResult() && active) setState('pending-deletion');
      } else setState(next);
    }); }, 2000);
    return () => { active = false; clearInterval(interval); };
  }, [api, preview, review?.id, state, resumeFinalResult]);
  if (error && !review) return <View accessibilityLiveRegion="assertive"><Text>{error}</Text></View>; if (!review) return <ActivityIndicator accessibilityLabel="Cargando aprobación" />;
  const approve = async (value: { dossierName: string; declarationVersion: string; categories: readonly string[] }) => {
    if (!api.approveAdmin) return setError('La operación no está disponible.');
    const command = { expectedVersion: review.version, idempotencyKey: approvalKey.current,
      manualDossierConfirmation: { confirmed: true as const, dossierName: value.dossierName,
        declarationVersion: value.declarationVersion, categories: value.categories } };
    approvalCommand.current = command;
    setBusy(true); setError(undefined);
    const result = await api.approveAdmin(review.id, command);
    setBusy(false);
    if (result.kind !== 'success') return setError(result.kind === 'version-conflict'
      ? 'La solicitud cambió. Recarga antes de aprobar.' : 'No pudimos continuar la aprobación.');
    setError(undefined);
    if (result.value.outcome === 'approved') {
      setState('approved');
      continueToCustody(result.value);
      return;
    }
    if (result.value.outcome === 'recovery-required' || result.value.outcome === 'recoverable-failure') {
      setState('recovery-required'); return;
    }
    setState('pending-deletion');
    const latest = await api.readAdmin(review.id);
    if (latest.kind === 'success') {
      setReview(latest.value);
      const next = approvalViewState(latest.value);
      if (next === 'approved') {
        if (!await resumeFinalResult()) setState('pending-deletion');
      } else if (next !== 'ready') setState(next);
    }
  };
  const retry = async () => { if (!api.retryAdminDeletion) return setError('El reintento no está disponible.'); setBusy(true); const result = await api.retryAdminDeletion(review.id, { expectedVersion: review.version, idempotencyKey: key() }); setBusy(false); result.kind === 'success' ? setState('pending-deletion') : setError('No pudimos reiniciar la eliminación segura.'); };
  return <AdminDossierApproval evidenceCategories={review.evidence.map((item) => item.category)} state={state} busy={busy} error={error} previewMode={preview ? params.preview as 'desktop' | 'mobile' : undefined} onBack={() => router.back()} onApprove={(value) => void approve(value)} onRetryDeletion={() => void retry()} onOpenCustody={approvedPassportId && state === 'approved' ? () => router.push(custodyDetailRoute(approvedPassportId) as never) : undefined} />;
}
