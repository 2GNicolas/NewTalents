import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuthentication } from '../../../../src/authentication/authentication-provider';
import { useRegistrationRequest } from '../../../../src/registration-requests/registration-request-state';
import { ApplicantCorrectionCoordinator, ApplicantStatusFlow } from '../../../../src/registration-requests/flows/applicant-status-flow';

export default function ApplicantRequestStatusScreen() {
  const params = useLocalSearchParams<{ requestId?: string | string[] }>();
  const router = useRouter();
  const requestId = Array.isArray(params.requestId) ? params.requestId[0] : params.requestId;
  const authentication = useAuthentication();
  const { machine, state, uploadQueue } = useRegistrationRequest();
  const corrections = useMemo(
    () => new ApplicantCorrectionCoordinator(machine, uploadQueue, authentication.getAccessToken),
    [authentication.getAccessToken, machine, uploadQueue],
  );

  return <ApplicantStatusFlow
    authenticationNotice={authentication.state.notice}
    correctionFailureMessage={() => corrections.safeFailureMessage()}
    onLogout={async () => { uploadQueue.clearEphemeralReferences('logout'); await authentication.logout('current'); router.replace('/(public)/registration' as never); }}
    onReturnToEntry={async () => { uploadQueue.clearEphemeralReferences('abandonment'); await authentication.logout('current'); router.replace('/(public)/registration' as never); }}
    onRefreshCapabilities={authentication.refreshCapabilities}
    onResubmit={() => corrections.resubmit()}
    onRetryRestore={() => { if (requestId) void machine.restore(requestId); }}
    state={state}
    uploadQueue={uploadQueue}
  />;
}
