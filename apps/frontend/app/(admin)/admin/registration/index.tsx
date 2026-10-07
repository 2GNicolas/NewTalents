import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { createAdministratorApi, OPERATIONAL_GROUPS, type OperationalGroup, type OperationalNextAction, type OperationalRequest } from '../../../../src/administrator/administrator-api';
import { AdminRequestsWorkspace } from '../../../../src/administrator/requests/admin-requests-workspace';
import { AdminRequestsState, type AdminRequestsView } from '../../../../src/administrator/requests/admin-requests-state';
import { existingFeature006ReviewRoute } from '../../../../src/administrator/requests/admin-request-routing';
import { AdministratorShell, type AdministratorDestination } from '../../../../src/administrator/shell/administrator-shell';
import { useAuthentication } from '../../../../src/authentication/authentication-provider';
import type { RegistrationRequestSnapshot, RegistrationRequestType } from '../../../../src/registration-requests/registration-request-api';

const groupAction: Readonly<Record<OperationalGroup, OperationalNextAction>> = { NEW: 'REVIEW', CONTINUE_REVIEW: 'CONTINUE', REQUIRES_CORRECTION: 'VIEW_CORRECTION', READY_FOR_DECISION: 'DECIDE', WAITING_EVIDENCE_DELETION: 'VIEW_DELETION' };
const previewCardInput: readonly (readonly [OperationalGroup, string, RegistrationRequestType, string])[] = [
  ['NEW', 'Camila R.', 'PERSONAL_ADULT', '0001'], ['NEW', 'Academia Horizonte Norte', 'FORMAL_ACADEMY', '0002'], ['NEW', 'Samuel A.', 'REPRESENTED_MINOR', '0003'],
  ['CONTINUE_REVIEW', 'Laura P.', 'PERSONAL_ADULT', '0004'], ['CONTINUE_REVIEW', 'Julián R.', 'ACADEMY_ADULT_PLAYER', '0005'],
  ['REQUIRES_CORRECTION', 'Solicitud en corrección', 'PERSONAL_ADULT', '0006'], ['READY_FOR_DECISION', 'Solicitud revisada', 'PERSONAL_ADULT', '0007'], ['WAITING_EVIDENCE_DELETION', 'Eliminación en curso', 'PERSONAL_ADULT', '0008'],
];
const previewCards: readonly OperationalRequest[] = previewCardInput.map(([operationalGroup, displayLabel, requestType, suffix]) => ({ requestId: `70000000-0000-4000-8000-00000000${suffix}`, requestVersion: 3, maskedReference: `SOL-••••-${suffix}`, displayLabel, requestType, operationalGroup, relevantAt: '2026-09-30T15:00:00.000Z', nextAction: groupAction[operationalGroup] }));
const previewGroups = OPERATIONAL_GROUPS.map((group) => ({ group, items: previewCards.filter((card) => card.operationalGroup === group), total: previewCards.filter((card) => card.operationalGroup === group).length }));
const previewRows: readonly RegistrationRequestSnapshot[] = previewCards.map((card) => ({ id: card.requestId, type: card.requestType, status: card.operationalGroup === 'REQUIRES_CORRECTION' ? 'REQUIRES_CORRECTION' : 'SUBMITTED', version: card.requestVersion, capabilities: ['registration.review.view'], createdAt: card.relevantAt, safeApplicantLabel: card.displayLabel, evidence: [] }));

export default function AdministratorRequestsScreen() {
  const params = useLocalSearchParams<{ preview?: string }>();
  const previewMode = params.preview === 'desktop' || params.preview === 'mobile' ? params.preview : undefined;
  const router = useRouter();
  const authentication = useAuthentication();
  const api = useMemo(() => createAdministratorApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const state = useRef(new AdminRequestsState(previewMode ? {
    getRequestOperations: async () => ({ kind: 'success', value: { groups: previewGroups } }),
    listCompleteRequests: async () => ({ kind: 'success', value: { items: previewRows } }),
    updateReviewProgress: async (requestId, command) => ({ kind: 'success', value: { ...previewCards.find((card) => card.requestId === requestId)!, operationalGroup: command.stage === 'REVIEWED' ? 'READY_FOR_DECISION' : 'CONTINUE_REVIEW', nextAction: command.stage === 'REVIEWED' ? 'DECIDE' : 'CONTINUE' } }),
  } : api)).current;
  const [view, setView] = useState<AdminRequestsView>(state.snapshot);
  const [complete, setComplete] = useState(false);
  const sync = useCallback(() => setView(state.snapshot), [state]);
  const loadOperations = useCallback(async () => { const pending = state.loadOperations(); sync(); await pending; sync(); }, [state, sync]);
  useEffect(() => { void loadOperations(); }, [loadOperations]);
  const navigate = (destination: AdministratorDestination) => {
    const href = destination === 'home' ? '/admin' : destination === 'requests' ? '/admin/registration' : destination === 'dossiers' ? '/admin/dossiers' : '/admin/custody';
    router.push(href as never);
  };
  const openOperational = async (request: OperationalRequest) => {
    const result = await state.updateProgress(request.requestId, request.requestVersion, 'OPENED'); sync();
    if (result === 'conflict') { await loadOperations(); return; }
    router.push(existingFeature006ReviewRoute(request, previewMode) as never);
  };
  const setSearch = async (query: string) => { state.setFilters({ ...state.snapshot.filters, ...(query.trim() ? { query } : { query: undefined }) }); sync(); await loadOperations(); };
  const setType = async (requestType?: RegistrationRequestType) => { state.setFilters({ ...state.snapshot.filters, requestType }); state.setCompleteFilters({ ...state.snapshot.completeFilters, type: requestType }); sync(); await loadOperations(); if (complete) { await state.loadCompleteList(); sync(); } };
  const logout = () => { void authentication.logout('current').then(() => router.replace('/(auth)/login' as never)); };
  return <AdministratorShell active="requests" onNavigate={navigate} onLogout={logout} previewMode={previewMode}>
    <AdminRequestsWorkspace view={view} previewMode={previewMode} showCompleteList={complete} onOperationalGroup={(group) => { state.setOperationalGroup(group); sync(); }} onSearch={(value) => { void setSearch(value); }} onRequestType={(value) => { void setType(value); }} onOpen={(request) => { void openOperational(request); }} onOpenAll={() => { setComplete(true); void state.loadCompleteList().then(sync); }} onBackToGroups={() => setComplete(false)} onOpenComplete={(request) => router.push(existingFeature006ReviewRoute({ requestId: request.id }, previewMode) as never)} onLoadNext={() => { void state.loadNextCompleteListPage().then(sync); }} onRetry={() => { void loadOperations(); }} />
  </AdministratorShell>;
}
