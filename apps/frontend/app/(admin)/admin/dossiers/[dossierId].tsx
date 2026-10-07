import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { createAdministratorApi, type DossierDetail } from '../../../../src/administrator/administrator-api';
import { AdminDossierDetail } from '../../../../src/administrator/dossiers/admin-dossier-detail';
import { AdminDossiersState, type DossierViewState } from '../../../../src/administrator/dossiers/admin-dossiers-state';
import { dossierLinkedRoute } from '../../../../src/administrator/navigation/dossier-linked-navigation';
import { AdministratorShell, type AdministratorDestination } from '../../../../src/administrator/shell/administrator-shell';
import { useAuthentication } from '../../../../src/authentication/authentication-provider';

const previewDetail: DossierDetail = { dossierId: '20000000-0000-4000-8000-000000000001', dossierName: 'Expediente Valentina P. — registro inicial', maskedReference: 'EXP-••••-418', displayLabel: 'Expediente Valentina P. — registro inicial', status: 'APPROVED', confirmedAt: '2026-09-29T16:42:00.000Z', requestType: 'ACADEMY_MINOR_PLAYER', originRequest: { id: '30000000-0000-4000-8000-000000000001', maskedReference: 'SOL-••••-018', status: 'APPROVED', available: true }, linkedPassport: { id: '40000000-0000-4000-8000-000000000001', maskedReference: 'PAS-••••-091', status: 'ACTIVO BÁSICO', available: true }, confirmationHistory: [{ at: '2026-09-29T16:42:00.000Z', action: 'DOSSIER_CONFIRMED', actorLabel: 'ADMINISTRATOR' }, { at: '2026-09-29T16:52:00.000Z', action: 'EVIDENCE_DELETION_VERIFIED', actorLabel: 'SYSTEM' }, { at: '2026-09-29T17:00:00.000Z', action: 'APPROVAL_FINALIZED', actorLabel: 'SYSTEM' }] };
export default function AdminDossierDetailScreen() {
  const params = useLocalSearchParams<{ dossierId?: string; preview?: string }>(); const previewMode = params.preview === 'desktop' || params.preview === 'mobile' ? params.preview : undefined; const router = useRouter(); const authentication = useAuthentication();
  const api = useMemo(() => createAdministratorApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const state = useRef(new AdminDossiersState(previewMode ? { listDossiers: async () => ({ kind: 'restricted' }), getDossierDetail: async () => ({ kind: 'success', value: previewDetail }) } : api)).current;
  const [detailState, setDetailState] = useState<DossierViewState>(previewMode ? 'ready' : 'loading'); const [detail, setDetail] = useState<DossierDetail | undefined>(previewMode ? previewDetail : undefined);
  const load = useCallback(async () => { if (!params.dossierId) { setDetailState('missing'); return; } await state.openDetail(params.dossierId); setDetailState(state.snapshot.detail.state); setDetail(state.snapshot.detail.value); }, [params.dossierId, state]); useEffect(() => { void load(); return () => state.closeDetail(); }, [load, state]);
  const navigate = (destination: AdministratorDestination) => router.push((destination === 'home' ? '/admin' : destination === 'requests' ? '/admin/registration' : destination === 'dossiers' ? '/admin/dossiers' : '/admin/custody') as never);
  const logout = () => { void authentication.logout('current').then(() => router.replace('/(auth)/login' as never)); };
  return <AdministratorShell active="dossiers" onNavigate={navigate} onLogout={logout} previewMode={previewMode}><AdminDossierDetail state={detailState} detail={detail} previewMode={previewMode} onBack={() => router.canGoBack() ? router.back() : router.replace({ pathname: '/(admin)/admin/dossiers' as never, params: previewMode ? { preview: previewMode } : {} })} onRetry={() => { void load(); }} onOpenRequest={(requestId) => params.dossierId && router.push(dossierLinkedRoute('request', requestId, params.dossierId) as never)} onOpenPassport={(passportId) => params.dossierId && router.push(dossierLinkedRoute('passport', passportId, params.dossierId) as never)} /></AdministratorShell>;
}
