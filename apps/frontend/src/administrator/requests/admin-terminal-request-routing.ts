import type { RegistrationRequestStatus } from '../../registration-requests/registration-request-api';

export type AdminRequestPresentation = 'terminal-read-only' | 'actionable-review';

export function adminRequestPresentation(status: RegistrationRequestStatus): AdminRequestPresentation {
  return status === 'APPROVED' || status === 'REJECTED' ? 'terminal-read-only' : 'actionable-review';
}
