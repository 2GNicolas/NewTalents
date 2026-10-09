import { Redirect, Slot, useLocalSearchParams } from 'expo-router';

import { useAuthentication } from '../../../../src/authentication/authentication-provider';
import { AUTHENTICATED_PRODUCT_ENTRY } from '../../../../src/authentication/authenticated-destination';
import { RegistrationRequestProvider } from '../../../../src/registration-requests/registration-request-state';

export default function PendingRegistrationLayout() {
  const { requestId } = useLocalSearchParams<{ requestId?: string | string[] }>();
  const authentication = useAuthentication();
  const routeRequestId = Array.isArray(requestId) ? requestId[0] : requestId;
  const access = authentication.sessionAccess;
  if (access?.classification === 'product') return <Redirect href={AUTHENTICATED_PRODUCT_ENTRY} />;
  const authorized = Boolean(routeRequestId && access?.classification === 'pending-onboarding' && access.requestId === routeRequestId && access.capabilities.includes('registration.request.own.view'));
  if (!authorized || !routeRequestId) return <Redirect href="/(auth)/login" />;
  return <RegistrationRequestProvider requestId={routeRequestId}><Slot /></RegistrationRequestProvider>;
}
