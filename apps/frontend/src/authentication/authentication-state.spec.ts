import { AuthenticationStateMachine } from './authentication-state';

describe('AuthenticationStateMachine', () => {
  it('uses explicit restoration, authentication, and safe fallback transitions without exposing form secrets', () => {
    const machine = new AuthenticationStateMachine();
    expect(machine.state.phase).toBe('restoring');

    machine.completeRestorationWithoutSession();
    machine.recordLoginSecret('test-password-not-usable');
    expect(machine.beginLogin()).toBe(true);
    expect(machine.beginLogin()).toBe(false);
    machine.completeAuthenticated();

    expect(machine.state.phase).toBe('authenticated');
    expect(machine.hasSensitiveFormState).toBe(false);
    expect(JSON.stringify(machine.state)).not.toContain('test-password-not-usable');
  });

  it('clears activation secrets and distinguishes confirmed expiry from retryable failures', () => {
    const machine = new AuthenticationStateMachine();
    machine.completeRestorationWithoutSession();
    machine.recordActivationSecrets('test-temporary-not-usable', 'test-password-not-usable');
    expect(machine.beginActivation()).toBe(true);
    machine.completeSessionExpired();

    expect(machine.state.phase).toBe('session-expired');
    expect(machine.hasSensitiveFormState).toBe(false);
    machine.beginRestorationRetry();
    machine.completeConnectivityFailure();
    expect(machine.state.phase).toBe('connectivity-failure');
  });

  it('does not allow logout, activation, or refresh transitions from incompatible states', () => {
    const machine = new AuthenticationStateMachine();
    expect(machine.beginLogout('all')).toBe(false);
    expect(machine.beginRefresh()).toBe(false);
    expect(machine.beginActivation()).toBe(false);
  });
});
