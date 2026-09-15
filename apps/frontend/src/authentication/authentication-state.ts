export type AuthenticationPhase =
  | 'restoring'
  | 'unauthenticated'
  | 'login-submitting'
  | 'activation-submitting'
  | 'activation-ready'
  | 'activation-success'
  | 'authenticated'
  | 'refreshing'
  | 'session-expired'
  | 'connectivity-failure'
  | 'backend-unavailable'
  | 'logout-current'
  | 'logout-all';

export type AuthenticationNotice = 'generic-authentication-failure' | 'throttled' | 'rejected-refresh' | 'invalid-request' | 'session-expired' | 'connectivity-failure' | 'backend-unavailable' | undefined;
export type AuthenticationState = Readonly<{ phase: AuthenticationPhase; notice?: AuthenticationNotice }>;

export class AuthenticationStateMachine {
  private _state: AuthenticationState = Object.freeze({ phase: 'restoring' });
  private loginSecret: string | null = null;
  private activationTemporarySecret: string | null = null;
  private activationNewSecret: string | null = null;

  get state(): AuthenticationState { return this._state; }
  get hasSensitiveFormState(): boolean { return Boolean(this.loginSecret || this.activationTemporarySecret || this.activationNewSecret); }

  completeRestorationWithoutSession() { if (this._state.phase === 'restoring') this.transition('unauthenticated'); }
  beginRestorationRefresh() { return this.transitionFrom(['restoring', 'connectivity-failure', 'backend-unavailable'], 'refreshing'); }
  beginRestorationRetry() { return this.transitionFrom(['session-expired', 'connectivity-failure', 'backend-unavailable'], 'restoring'); }
  beginLogin() { return this.transitionFrom(['unauthenticated', 'session-expired', 'connectivity-failure', 'backend-unavailable'], 'login-submitting'); }
  beginActivation() { return this.transitionFrom(['unauthenticated', 'activation-ready', 'session-expired', 'connectivity-failure', 'backend-unavailable'], 'activation-submitting'); }
  beginRefresh() { return this.transitionFrom(['authenticated'], 'refreshing'); }
  beginLogout(scope: 'current' | 'all') { return this.transitionFrom(['authenticated'], scope === 'current' ? 'logout-current' : 'logout-all'); }
  prepareLogin() { return this.transitionFrom(['unauthenticated', 'activation-ready'], 'unauthenticated'); }
  prepareActivation() { return this.transitionFrom(['unauthenticated', 'activation-ready'], 'activation-ready'); }
  completeAuthenticated(notice?: AuthenticationNotice) { this.clearSecrets(); this.transition('authenticated', notice); }
  completeRetryableSessionFailure(notice: Extract<AuthenticationNotice, 'connectivity-failure' | 'backend-unavailable'>) {
    this.clearSecrets();
    this.transition('authenticated', notice);
  }
  completeActivationSucceeded() { this.clearSecrets(); this.transition('activation-success'); }
  completeActivationFailure(notice: AuthenticationNotice) { this.clearSecrets(); this.transition('activation-ready', notice); }
  continueAfterActivation() { return this.transitionFrom(['activation-success'], 'authenticated'); }
  completeUnauthenticated(notice?: AuthenticationNotice) { this.clearSecrets(); this.transition('unauthenticated', notice); }
  completeSessionExpired() { this.clearSecrets(); this.transition('session-expired', 'session-expired'); }
  completeConnectivityFailure() { this.clearSecrets(); this.transition('connectivity-failure', 'connectivity-failure'); }
  completeBackendUnavailable() { this.clearSecrets(); this.transition('backend-unavailable', 'backend-unavailable'); }
  recordLoginSecret(value: string) { this.loginSecret = value; }
  recordActivationSecrets(temporaryCredential: string, newPassword: string) { this.activationTemporarySecret = temporaryCredential; this.activationNewSecret = newPassword; }
  clearSecrets() { this.loginSecret = null; this.activationTemporarySecret = null; this.activationNewSecret = null; }
  dispose() { this.clearSecrets(); }

  private transitionFrom(allowed: AuthenticationPhase[], phase: AuthenticationPhase) {
    if (!allowed.includes(this._state.phase)) return false;
    this.transition(phase);
    return true;
  }

  private transition(phase: AuthenticationPhase, notice?: AuthenticationNotice) { this._state = Object.freeze(notice ? { phase, notice } : { phase }); }
}
