import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { createAdministratorApi } from '../../../../src/administrator/administrator-api';
import { AdminPassportsList } from '../../../../src/administrator/passports/admin-passports-list';
import { AdminPassportsState } from '../../../../src/administrator/passports/admin-passports-state';
import { AdministratorShell, administratorDestinationPath } from '../../../../src/administrator/shell/administrator-shell';
import { useAuthentication } from '../../../../src/authentication/authentication-provider';

export default function AdministratorPassportsScreen() {
  const router = useRouter(); const authentication = useAuthentication();
  const params = useLocalSearchParams<{ preview?: string }>();
  const previewMode = params.preview === 'desktop' || params.preview === 'mobile' ? params.preview : undefined;
  const api = useMemo(() => createAdministratorApi({ getAccessToken: authentication.getAccessToken }), [authentication.getAccessToken]);
  const state = useRef(new AdminPassportsState(api)).current;
  const [view, setView] = useState(state.snapshot);
  const load = useCallback(async () => { await state.load(); setView({ ...state.snapshot }); }, [state]);
  useEffect(() => { void load(); return () => state.dispose(); }, [load, state]);
  const advance = async (next: boolean) => { if (next) await state.nextPage(); else await state.previousPage(); setView({ ...state.snapshot }); };
  return <AdministratorShell active="passports" previewMode={previewMode} onNavigate={(destination) => router.push(administratorDestinationPath(destination) as never)} onLogout={() => { void authentication.logout('current').then(() => router.replace('/(auth)/login' as never)); }}>
    <AdminPassportsList items={view.list.items} state={view.list.state} page={view.list.page} canGoPrevious={view.list.page > 0} canGoNext={Boolean(view.list.nextCursor)} onRetry={() => { void load(); }} onNext={() => { void advance(true); }} onPrevious={() => { void advance(false); }} onOpen={(id) => router.push(`/admin/passports/${id}` as never)} previewMode={previewMode} />
  </AdministratorShell>;
}
