import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { createAdministratorApi, type AdministratorApi, type CustodyPassportSummary, type DossierSummary, type EligibleAnalystSummary, type OperationalGroupView } from '../../../src/administrator/administrator-api';
import { AdminHome } from '../../../src/administrator/home/admin-home';
import { AdminHomeState, type AdminHomeView } from '../../../src/administrator/home/admin-home-state';
import { AdministratorShell, type AdministratorDestination } from '../../../src/administrator/shell/administrator-shell';
import { useAuthentication } from '../../../src/authentication/authentication-provider';

const previewAnalysts: readonly EligibleAnalystSummary[] = [
  { identityId: 'a', displayLabel: 'Laura M.', activeCustodyCount: 8 }, { identityId: 'b', displayLabel: 'Sebastián R.', activeCustodyCount: 6 }, { identityId: 'c', displayLabel: 'Natalia C.', activeCustodyCount: 5 },
];
const previewGroups: readonly OperationalGroupView[] = [4, 3, 2, 2, 1].map((total, index) => ({ group: ['NEW', 'CONTINUE_REVIEW', 'REQUIRES_CORRECTION', 'READY_FOR_DECISION', 'WAITING_EVIDENCE_DELETION'][index] as OperationalGroupView['group'], total, items: [] }));
const previewDossiers = Array.from({ length: 4 }, (_, index): DossierSummary => ({ dossierId: `dossier-${index}`, dossierName: `Expediente ${index}`, maskedReference: `EXP-••••-${index}`, displayLabel: `Expediente ${index}`, status: 'CONFIRMED', confirmedAt: '2026-09-30T16:00:00.000Z', requestType: 'PERSONAL_ADULT', originRequest: { id: `request-${index}`, maskedReference: `SOL-••••-${index}`, status: 'APPROVED', available: true }, linkedPassport: { notApplicable: true } }));
const previewPassport = (index: number, assigned: boolean): CustodyPassportSummary => ({ passportId: `passport-${assigned ? 'assigned' : 'unassigned'}-${index}`, maskedReference: `PAS-••••-${index}`, displayLabel: `Jugador ${index}`, lifecycleState: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT', custody: assigned ? { state: 'ASSIGNED', version: 1, analyst: previewAnalysts[index % previewAnalysts.length]!, assignedAt: '2026-09-30T16:00:00.000Z' } : { state: 'UNASSIGNED', version: 0 }, capabilities: assigned ? ['CHANGE', 'REMOVE'] : ['ASSIGN'] });

function previewApi(): Pick<AdministratorApi, 'getRequestOperations' | 'listDossiers' | 'listCustodyPassports' | 'listCustodyAnalysts'> { return {
  getRequestOperations: async () => ({ kind: 'success', value: { groups: previewGroups } }),
  listDossiers: async () => ({ kind: 'success', value: { items: previewDossiers } }),
  listCustodyPassports: async (filters) => ({ kind: 'success', value: { items: Array.from({ length: filters.assignment === 'UNASSIGNED' ? 7 : 19 }, (_, index) => previewPassport(index, filters.assignment === 'ASSIGNED')) } }),
  listCustodyAnalysts: async () => ({ kind: 'success', value: { items: previewAnalysts } }),
}; }

export default function AdministratorHomeScreen() {
  const params = useLocalSearchParams<{ preview?: string }>(); const previewMode = params.preview === 'desktop' || params.preview === 'mobile' ? params.preview : undefined; const router = useRouter(); const authentication = useAuthentication();
  const api = useMemo(() => previewMode ? previewApi() : createAdministratorApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken, previewMode]);
  const state = useRef(new AdminHomeState(api)).current; const [view, setView] = useState<AdminHomeView>(state.snapshot); const sync = useCallback(() => setView(state.snapshot), [state]); const load = useCallback(async () => { await state.load(); sync(); }, [state, sync]);
  useEffect(() => { void load(); }, [load]);
  const navigate = (destination: AdministratorDestination) => { const pathname = destination === 'home' ? '/admin' : destination === 'requests' ? '/admin/registration' : destination === 'dossiers' ? '/admin/dossiers' : '/admin/custody'; router.push(previewMode ? { pathname: pathname as never, params: { preview: previewMode } } : pathname as never); };
  const logout = () => { void authentication.logout('current').then(() => router.replace('/(auth)/login' as never)); };
  return <AdministratorShell active="home" onNavigate={navigate} onLogout={logout} previewMode={previewMode}><AdminHome view={view} previewMode={previewMode} onNavigate={navigate} onRetry={() => { void load(); }} /></AdministratorShell>;
}
