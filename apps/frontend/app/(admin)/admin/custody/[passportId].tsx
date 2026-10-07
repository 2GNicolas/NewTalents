import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createAdministratorApi, type CustodyPassportDetail, type EligibleAnalystSummary } from '../../../../src/administrator/administrator-api';
import { CustodyConfirmation } from '../../../../src/administrator/custody/custody-confirmation';
import { CustodyConfirmationState, type CustodyConfirmationSnapshot } from '../../../../src/administrator/custody/custody-confirmation-state';
import { PassportCustodyDetail, type CustodyDetailState } from '../../../../src/administrator/custody/passport-custody-detail';
import { dossierReturnTarget } from '../../../../src/administrator/navigation/dossier-linked-navigation';
import { AdministratorShell, type AdministratorDestination } from '../../../../src/administrator/shell/administrator-shell';
import { LiquidGlassPanel } from '../../../../src/design/components/liquid-glass-panel';
import { useAuthentication } from '../../../../src/authentication/authentication-provider';

const previewAnalysts: readonly EligibleAnalystSummary[] = [
  { identityId: '70000000-0000-4000-8000-000000000002', displayLabel: 'Laura M.', activeCustodyCount: 8 },
  { identityId: '70000000-0000-4000-8000-000000000006', displayLabel: 'Sofía R.', activeCustodyCount: 6 },
];
const previewDetail: CustodyPassportDetail = {
  passportId: '70000000-0000-4000-8000-000000000005', maskedReference: 'PAS-••••-0005', displayLabel: 'Valentina Pérez', lifecycleState: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT', academyLabel: 'Academia Horizonte',
  custody: { state: 'ASSIGNED', version: 3, analyst: previewAnalysts[0]!, assignedAt: '2026-09-30T16:00:00.000Z' }, capabilities: ['CHANGE', 'REMOVE'],
  originRequest: { id: '70000000-0000-4000-8000-000000000003', maskedReference: 'SOL-••••-0003', status: 'APPROVED', available: true },
  linkedDossier: { id: '70000000-0000-4000-8000-000000000004', maskedReference: 'EXP-••••-0004', status: 'APPROVED', available: true },
  history: [
    { eventId: '70000000-0000-4000-8000-000000000011', at: '2026-09-30T16:00:00.000Z', action: 'ASSIGNED', actorLabel: 'Administrador', nextAnalystLabel: 'Laura M.' },
    { eventId: '70000000-0000-4000-8000-000000000012', at: '2026-10-01T08:30:00.000Z', action: 'CHANGED', actorLabel: 'Administrador', previousAnalystLabel: 'Sofía R.', nextAnalystLabel: 'Laura M.', reason: 'Continuidad operativa' },
  ],
};

export default function AdministratorCustodyDetailScreen() {
  const params = useLocalSearchParams<{ passportId?: string; preview?: string; returnDossierId?: string }>();
  const previewMode = params.preview === 'desktop' || params.preview === 'mobile' ? params.preview : undefined;
  const router = useRouter(); const authentication = useAuthentication();
  const api = useMemo(() => createAdministratorApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const [state, setState] = useState<CustodyDetailState>(previewMode ? 'ready' : 'loading');
  const [detail, setDetail] = useState<CustodyPassportDetail | undefined>(previewMode ? previewDetail : undefined);
  const [analysts, setAnalysts] = useState<readonly EligibleAnalystSummary[]>(previewMode ? previewAnalysts : []);
  const confirmation = useRef(new CustodyConfirmationState(async (input) => {
    const result = input.action === 'ASSIGN'
      ? await api.assignPassportCustody(input.passportId, { expectedVersion: input.expectedVersion, idempotencyKey: input.idempotencyKey, analystIdentityId: input.analystIdentityId })
      : input.action === 'CHANGE'
        ? await api.changePassportCustody(input.passportId, { expectedVersion: input.expectedVersion, idempotencyKey: input.idempotencyKey, reason: input.reason, analystIdentityId: input.analystIdentityId })
        : await api.removePassportCustody(input.passportId, { expectedVersion: input.expectedVersion, idempotencyKey: input.idempotencyKey, reason: input.reason });
    return result.kind === 'success' ? 'applied' : result.kind === 'custody-conflict' || result.kind === 'version-conflict' ? 'conflict' : result.kind === 'idempotency-conflict' ? 'idempotency-conflict' : result.kind === 'restricted' || result.kind === 'session-expired' ? 'denied' : 'failed';
  })).current;
  const [confirmationView, setConfirmationView] = useState<CustodyConfirmationSnapshot>(confirmation.snapshot);
  const load = useCallback(async () => {
    if (previewMode) { setState('ready'); setDetail(previewDetail); setAnalysts(previewAnalysts); return; }
    if (!params.passportId) { setState('missing'); return; }
    setState('loading');
    const [detailResult, analystResult] = await Promise.all([api.getCustodyPassportDetail(params.passportId), api.listCustodyAnalysts({ limit: 50 })]);
    if (detailResult.kind === 'success') { setDetail(detailResult.value); setState('ready'); if (analystResult.kind === 'success') setAnalysts(analystResult.value.items); return; }
    setDetail(undefined); setState(detailResult.kind === 'restricted' || detailResult.kind === 'session-expired' ? 'restricted' : detailResult.kind === 'connectivity-failure' || detailResult.kind === 'unavailable' ? 'unavailable' : detailResult.kind === 'invalid-response' ? 'error' : 'missing');
  }, [api, params.passportId, previewMode]);
  useEffect(() => { void load(); return () => confirmation.dispose(); }, [confirmation, load]);
  const syncConfirmation = () => setConfirmationView(confirmation.snapshot);
  const choose = (analyst: EligibleAnalystSummary) => { confirmation.selectAnalyst(analyst); syncConfirmation(); };
  const beginAssign = (value: CustodyPassportDetail) => { confirmation.beginAssignment(value); syncConfirmation(); };
  const beginChange = (value: CustodyPassportDetail) => { confirmation.beginChange(value); syncConfirmation(); };
  const beginRemove = (value: CustodyPassportDetail) => { confirmation.beginRemoval(value); syncConfirmation(); };
  const confirm = async () => { const pending = confirmation.confirm(); syncConfirmation(); const result = await pending; syncConfirmation(); if (result === 'applied' || result === 'conflict') await load(); };
  const returnFocus = () => {
    if (typeof document === 'undefined' || !('action' in confirmationView)) return;
    const label = confirmationView.action === 'REMOVE' ? 'Retirar custodia' : confirmationView.action === 'CHANGE' ? 'Cambiar Analista' : 'Asignar Analista';
    (document.querySelector(`[aria-label="${label}"]`) as HTMLElement | null)?.focus();
  };
  const navigate = (destination: AdministratorDestination) => router.push((destination === 'home' ? '/admin' : destination === 'requests' ? '/admin/registration' : destination === 'dossiers' ? '/admin/dossiers' : '/admin/custody') as never);
  const selecting = confirmationView.stage === 'selecting';
  const currentAnalystId = selecting && confirmationView.action === 'CHANGE' && confirmationView.passport.custody.state === 'ASSIGNED' ? confirmationView.passport.custody.analyst.identityId : undefined;
  const candidates = currentAnalystId ? analysts.filter((item) => item.identityId !== currentAnalystId) : analysts;
  const logout = () => { void authentication.logout('current').then(() => router.replace('/(auth)/login' as never)); };
  const dossierReturn = dossierReturnTarget(params.returnDossierId);
  return <AdministratorShell active="custody" onNavigate={navigate} onLogout={logout} previewMode={previewMode}>
    <PassportCustodyDetail state={state} detail={detail} previewMode={previewMode} backLabel={dossierReturn ? 'Volver al expediente' : undefined} onRetry={() => { void load(); }} onBack={() => dossierReturn ? router.replace(dossierReturn as never) : router.replace('/admin/custody' as never)} onOpenRequest={(id) => router.push({ pathname: '/(admin)/admin/registration/[requestId]' as never, params: { requestId: id } })} onOpenDossier={(id) => router.push(`/admin/dossiers/${id}` as never)} onAssign={beginAssign} onChange={beginChange} onRemove={beginRemove} />
    {selecting ? <View style={styles.selectorBackdrop}><LiquidGlassPanel style={styles.selector}><Text accessibilityRole="header" style={styles.selectorTitle}>Seleccionar Analista</Text>{candidates.map((analyst) => <Pressable key={analyst.identityId} accessibilityRole="button" accessibilityLabel={`Seleccionar ${analyst.displayLabel}`} onPress={() => choose(analyst)} style={styles.analyst}><Text style={styles.analystName}>{analyst.displayLabel}</Text><Text style={styles.load}>{analyst.activeCustodyCount} custodias activas</Text></Pressable>)}<Pressable accessibilityRole="button" accessibilityLabel="Cancelar selección" onPress={() => { confirmation.cancel(); syncConfirmation(); }} style={styles.cancel}><Text style={styles.cancelText}>Cancelar</Text></Pressable></LiquidGlassPanel></View> : null}
    <CustodyConfirmation snapshot={confirmationView} mobile={previewMode === 'mobile'} onReason={(reason) => { confirmation.setReason(reason); syncConfirmation(); }} onCancel={() => { confirmation.cancel(); syncConfirmation(); }} onReturnFocus={returnFocus} onConfirm={() => { void confirm(); }} />
  </AdministratorShell>;
}

const styles = StyleSheet.create({ selectorBackdrop: { ...StyleSheet.absoluteFill, alignItems: 'center', backgroundColor: 'rgba(0,10,7,.55)', justifyContent: 'center', padding: 20, zIndex: 15 }, selector: { gap: 8, maxWidth: 430, padding: 20, width: '100%' }, selectorTitle: { color: '#f7f8f2', fontSize: 22, fontWeight: '900' }, analyst: { borderColor: 'rgba(125,255,170,.38)', borderRadius: 8, borderWidth: 1, minHeight: 52, padding: 10 }, analystName: { color: '#f7f8f2', fontWeight: '900' }, load: { color: '#b7c8be', fontSize: 11 }, cancel: { alignItems: 'center', justifyContent: 'center', minHeight: 44 }, cancelText: { color: '#d6ff19', fontWeight: '800' } });
