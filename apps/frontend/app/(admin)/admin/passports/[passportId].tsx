import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { createAdministratorApi, type AdminPassportDetail, type CustodyPassportDetail } from '../../../../src/administrator/administrator-api';
import { AdminPassportDetailView, type AdminPassportDetailState } from '../../../../src/administrator/passports/admin-passport-detail';
import { AllowanceUpdateState } from '../../../../src/administrator/passports/allowance-update-state';
import { AdministratorShell, administratorDestinationPath } from '../../../../src/administrator/shell/administrator-shell';
import { useAuthentication } from '../../../../src/authentication/authentication-provider';

export default function AdministratorPassportDetailScreen() {
  const params = useLocalSearchParams<{ passportId?: string; preview?: string }>();
  const previewMode = params.preview === 'desktop' || params.preview === 'mobile' ? params.preview : undefined;
  const router = useRouter(); const authentication = useAuthentication();
  const api = useMemo(() => createAdministratorApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const controller = useRef<AllowanceUpdateState | null>(null);
  const [updateView, setUpdateView] = useState<AllowanceUpdateState['snapshot']>();
  const [state, setState] = useState<AdminPassportDetailState>('loading');
  const [detail, setDetail] = useState<AdminPassportDetail>(); const [custody, setCustody] = useState<CustodyPassportDetail>();
  const load = useCallback(async () => {
    if (!params.passportId) { setState('missing'); return; }
    setState('loading'); setDetail(undefined); setCustody(undefined); setUpdateView(undefined);
    controller.current?.dispose(); controller.current = null;
    const result = await api.getAdminPassportDetail(params.passportId);
    if (result.kind !== 'success') { setState(result.kind === 'restricted' || result.kind === 'session-expired' ? 'restricted' : result.kind === 'unavailable' || result.kind === 'connectivity-failure' ? 'unavailable' : 'error'); return; }
    setDetail(result.value); setState('ready');
    const next = new AllowanceUpdateState(api, params.passportId, result.value.allowance);
    controller.current = next; setUpdateView(next.snapshot);
    const [custodyResult] = await Promise.all([api.getCustodyPassportDetail(params.passportId), next.loadHistory()]);
    if (custodyResult.kind === 'success') setCustody(custodyResult.value);
    setUpdateView(next.snapshot);
  }, [api, params.passportId]);
  useEffect(() => { void load(); return () => { controller.current?.dispose(); controller.current = null; }; }, [load]);
  const sync = () => { if (controller.current) setUpdateView(controller.current.snapshot); };
  const confirm = async (retry = false) => {
    const current = controller.current;
    if (!current || !detail?.passport.canConfigure) return;
    const pending = retry ? current.retry() : current.confirm(); sync(); await pending; sync();
    setDetail((previous) => previous ? { ...previous, allowance: current.snapshot.current } : previous);
  };
  return <AdministratorShell active="passports" previewMode={previewMode} onNavigate={(destination) => router.push(administratorDestinationPath(destination) as never)} onLogout={() => { void authentication.logout('current').then(() => router.replace('/(auth)/login' as never)); }}>
    <AdminPassportDetailView state={state} detail={detail} custody={custody} history={updateView?.history} hasMoreHistory={Boolean(updateView?.nextCursor)} onMoreHistory={() => { void controller.current?.nextHistoryPage().then(sync); }} message={updateView?.message} submitting={updateView?.stage === 'submitting'} recoverable={updateView?.stage === 'recoverable'} previewMode={previewMode} onRetry={() => { void load(); }} onBack={() => router.replace('/admin/passports' as never)} onOpenRequest={(id) => router.push(`/admin/registration/${id}` as never)} onOpenDossier={(id) => router.push(`/admin/dossiers/${id}` as never)} onOpenCustody={(id) => router.push(`/admin/custody/${id}` as never)} onPropose={(cadence, matchLimit) => { const allowed = controller.current?.begin(cadence, String(matchLimit)) ?? false; sync(); return allowed; }} onDiscard={() => { controller.current?.discard(); sync(); }} onConfirm={() => { void confirm(); }} onRetryConfirmation={() => { void confirm(true); }} />
  </AdministratorShell>;
}
