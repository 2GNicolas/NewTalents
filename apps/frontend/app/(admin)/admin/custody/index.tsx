import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { createAdministratorApi, type CustodyPassportSummary, type EligibleAnalystSummary } from '../../../../src/administrator/administrator-api';
import { CustodyConfirmation } from '../../../../src/administrator/custody/custody-confirmation';
import { CustodyConfirmationState, type CustodyConfirmationSnapshot } from '../../../../src/administrator/custody/custody-confirmation-state';
import { PassportCustodyState, type PassportCustodyView } from '../../../../src/administrator/custody/passport-custody-state';
import { PassportCustodyWorkspace } from '../../../../src/administrator/custody/passport-custody-workspace';
import { AdministratorShell, type AdministratorDestination } from '../../../../src/administrator/shell/administrator-shell';
import { useAuthentication } from '../../../../src/authentication/authentication-provider';

const previewAnalysts: readonly EligibleAnalystSummary[] = [
  { identityId: '70000000-0000-4000-8000-000000000002', displayLabel: 'Laura M.', activeCustodyCount: 8 },
  { identityId: '70000000-0000-4000-8000-000000000006', displayLabel: 'Sebastián R.', activeCustodyCount: 6 },
  { identityId: '70000000-0000-4000-8000-000000000007', displayLabel: 'Natalia C.', activeCustodyCount: 5 },
];
const previewUnassigned: readonly CustodyPassportSummary[] = ['Valentina P.', 'Andrés F.', 'Samuel A.'].map((displayLabel, index) => ({
  passportId: `70000000-0000-4000-8000-00000000000${index + 5}`,
  maskedReference: `PAS-••••-${['091', '418', '276'][index]}`,
  displayLabel,
  lifecycleState: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT', academyLabel: 'Academia Horizonte',
  custody: { state: 'UNASSIGNED', version: 0 }, capabilities: ['ASSIGN'],
}));
const previewAssigned: readonly CustodyPassportSummary[] = previewAnalysts.map((analyst, index) => ({
  passportId: `71000000-0000-4000-8000-00000000000${index + 1}`,
  maskedReference: `PAS-••••-${['983', '440', '768'][index]}`,
  displayLabel: ['Mateo L.', 'Sofía D.', 'Juan P.'][index]!, lifecycleState: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT', academyLabel: 'Academia Horizonte',
  custody: { state: 'ASSIGNED', version: 1, analyst, assignedAt: '2026-09-30T16:00:00.000Z' }, capabilities: ['CHANGE', 'REMOVE'],
}));

export default function AdministratorCustodyScreen() {
  const params = useLocalSearchParams<{ preview?: string; passportId?: string; confirmation?: string }>();
  const previewMode = params.preview === 'desktop' || params.preview === 'mobile' ? params.preview : undefined;
  const router = useRouter();
  const authentication = useAuthentication();
  const api = useMemo(() => createAdministratorApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const state = useRef(new PassportCustodyState(previewMode ? {
    listCustodyPassports: async (filters) => ({ kind: 'success', value: { items: filters.assignment === 'UNASSIGNED' ? previewUnassigned : previewAssigned } }),
    listCustodyAnalysts: async () => ({ kind: 'success', value: { items: previewAnalysts } }),
    assignPassportCustody: async (passportId, command) => ({ kind: 'success', value: { data: { passportId, eventId: '72000000-0000-4000-8000-000000000001', custody: { state: 'ASSIGNED', version: command.expectedVersion + 1, analystIdentityId: command.analystIdentityId, assignedAt: '2026-09-30T17:00:00.000Z' } }, idempotent: false } }),
    changePassportCustody: async (passportId, command) => ({ kind: 'success', value: { data: { passportId, eventId: '72000000-0000-4000-8000-000000000002', custody: { state: 'ASSIGNED', version: command.expectedVersion + 1, analystIdentityId: command.analystIdentityId, assignedAt: '2026-09-30T17:00:00.000Z' } }, idempotent: false } }),
    removePassportCustody: async (passportId, command) => ({ kind: 'success', value: { data: { passportId, eventId: '72000000-0000-4000-8000-000000000003', custody: { state: 'UNASSIGNED', version: command.expectedVersion + 1 } }, idempotent: false } }),
  } : api)).current;
  const confirmation = useRef(new CustodyConfirmationState((input) => state.applyConfirmedTransition(input))).current;
  const previewConfirmationOpened = useRef(false);
  const [view, setView] = useState<PassportCustodyView>(state.snapshot);
  const [confirmationView, setConfirmationView] = useState<CustodyConfirmationSnapshot>(confirmation.snapshot);
  const sync = useCallback(() => setView(state.snapshot), [state]);
  const load = useCallback(async () => { await state.load(); sync(); }, [state, sync]);
  useEffect(() => { void load(); return () => confirmation.dispose(); }, [confirmation, load]);
  const navigate = (destination: AdministratorDestination) => router.push((destination === 'home' ? '/admin' : destination === 'requests' ? '/admin/registration' : destination === 'dossiers' ? '/admin/dossiers' : destination === 'passports' ? '/admin/passports' : '/admin/custody') as never);
  const search = async (query: string) => { state.setSearch(query); sync(); await load(); };
  const syncConfirmation = () => setConfirmationView(confirmation.snapshot);
  const openConfirmation = (passportId: string, analystIdentityId: string) => {
    const passport = view.unassigned.items.find((item) => item.passportId === passportId);
    const analyst = view.analysts.find((item) => item.identityId === analystIdentityId);
    if (!passport || !analyst) return;
    state.selectDestination(passportId, analystIdentityId); sync();
    confirmation.beginAssignment(passport); confirmation.selectAnalyst(analyst); syncConfirmation();
  };
  const openChange = (passport: CustodyPassportSummary, analyst: EligibleAnalystSummary) => {
    confirmation.beginChange(passport); confirmation.selectAnalyst(analyst); syncConfirmation();
  };
  const openRemoval = (passport: CustodyPassportSummary) => {
    confirmation.beginRemoval(passport); syncConfirmation();
  };
  useEffect(() => {
    if (!previewMode || params.confirmation !== '1' || previewConfirmationOpened.current || view.state !== 'ready') return;
    const passport = view.unassigned.items[0];
    const analyst = view.analysts[0];
    if (!passport || !analyst) return;
    previewConfirmationOpened.current = true;
    openConfirmation(passport.passportId, analyst.identityId);
  }, [params.confirmation, previewMode, view]);
  const cancelConfirmation = () => { confirmation.cancel(); state.clearSelection(); sync(); syncConfirmation(); };
  const confirmTransition = async () => { const pending = confirmation.confirm(); syncConfirmation(); await pending; sync(); syncConfirmation(); };
  const returnFocus = () => {
    if (!('passport' in confirmationView) || typeof document === 'undefined') return;
    const assign = document.querySelector(`[data-testid="assign-passport-${confirmationView.passport.passportId}"]`);
    const change = document.querySelector(`[data-testid="change-custody-${confirmationView.passport.passportId}"]`);
    const remove = document.querySelector(`[data-testid="remove-custody-${confirmationView.passport.passportId}"]`);
    const destination = 'analyst' in confirmationView ? document.querySelector(`[aria-label="Seleccionar ${confirmationView.analyst.displayLabel} para ${confirmationView.passport.displayLabel}"]`) : null;
    ((assign ?? change ?? remove ?? destination) as HTMLElement | null)?.focus();
  };
  const logout = () => { void authentication.logout('current').then(() => router.replace('/(auth)/login' as never)); };
  return <AdministratorShell active="custody" onNavigate={navigate} onLogout={logout} previewMode={previewMode}>
    <PassportCustodyWorkspace view={view} previewMode={previewMode} onSearch={(query) => { void search(query); }} onRetry={() => { void load(); }} onSelectDestination={openConfirmation} onChangeCustody={openChange} onRemoveCustody={openRemoval} />
    <CustodyConfirmation snapshot={confirmationView} mobile={previewMode === 'mobile'} onReason={(reason) => { confirmation.setReason(reason); syncConfirmation(); }} onCancel={cancelConfirmation} onReturnFocus={returnFocus} onConfirm={() => { void confirmTransition(); }} />
  </AdministratorShell>;
}
