import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { createAdministratorApi, type DossierSummary } from '../../../../src/administrator/administrator-api';
import { AdminDossiersList } from '../../../../src/administrator/dossiers/admin-dossiers-list';
import { AdminDossiersState, type AdminDossiersView } from '../../../../src/administrator/dossiers/admin-dossiers-state';
import { AdministratorShell, type AdministratorDestination } from '../../../../src/administrator/shell/administrator-shell';
import { useAuthentication } from '../../../../src/authentication/authentication-provider';

const previewItems: readonly DossierSummary[] = [
  ['418', 'Valentina P.', 'APPROVED', '091'], ['362', 'Andrés F.', 'CONFIRMED', null], ['305', 'Samuel A.', 'APPROVED', '774'], ['244', 'Academia Horizonte', 'DELETION_PENDING', null],
].map(([suffix, displayLabel, status, passport], index) => ({ dossierId: `20000000-0000-4000-8000-000000000${index + 1}`, dossierName: String(displayLabel), maskedReference: `EXP-••••-${suffix}`, displayLabel: String(displayLabel), status: status as DossierSummary['status'], confirmedAt: `2026-09-${29 - index}T16:42:00.000Z`, requestType: index === 3 ? 'FORMAL_ACADEMY' : 'ACADEMY_MINOR_PLAYER', originRequest: { id: `30000000-0000-4000-8000-00000000000${index + 1}`, maskedReference: `SOL-••••-${suffix}`, status: 'APPROVED', available: true }, linkedPassport: passport ? { id: `40000000-0000-4000-8000-00000000000${index + 1}`, maskedReference: `PAS-••••-${passport}`, status: 'ACTIVE', available: true } : { notApplicable: true } }));

export default function AdminDossiersScreen() {
  const params = useLocalSearchParams<{ preview?: string }>(); const previewMode = params.preview === 'desktop' || params.preview === 'mobile' ? params.preview : undefined; const router = useRouter(); const authentication = useAuthentication();
  const api = useMemo(() => createAdministratorApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const state = useRef(new AdminDossiersState(previewMode ? { listDossiers: async () => ({ kind: 'success', value: { items: previewItems, nextCursor: 'preview-next' } }), getDossierDetail: async () => ({ kind: 'restricted' }) } : api)).current;
  const [view, setView] = useState<AdminDossiersView>(state.snapshot); const sync = useCallback(() => setView(state.snapshot), [state]);
  const load = useCallback(async () => { await state.load(); sync(); }, [state, sync]); useEffect(() => { void load(); }, [load]);
  const navigate = (destination: AdministratorDestination) => router.push((destination === 'home' ? '/admin' : destination === 'requests' ? '/admin/registration' : destination === 'dossiers' ? '/admin/dossiers' : '/admin/custody') as never);
  const logout = () => { void authentication.logout('current').then(() => router.replace('/(auth)/login' as never)); };
  return <AdministratorShell active="dossiers" onNavigate={navigate} onLogout={logout} previewMode={previewMode}><AdminDossiersList {...view.list} filters={view.filters} canGoNext={Boolean(view.list.nextCursor)} previewMode={previewMode} onFilters={(filters) => { state.setFilters(filters); sync(); void state.load().then(sync); }} onRetry={() => { void load(); }} onOpen={(dossierId) => router.push({ pathname: '/(admin)/admin/dossiers/[dossierId]' as never, params: { dossierId, ...(previewMode ? { preview: previewMode } : {}) } })} onNext={() => { void state.nextPage().then(sync); }} onPrevious={() => { void state.previousPage().then(sync); }} onScroll={(offset) => { state.rememberScroll(offset); sync(); }} /></AdministratorShell>;
}
