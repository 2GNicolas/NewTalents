import { authTokens, createAuthMotionTokens } from './tokens';

describe('authTokens', () => {
  it('defines the approved dark palette and accessible interactive treatment', () => {
    expect(authTokens.colors.canvas).toBe('#07110D');
    expect(authTokens.colors.surfaceElevated).toBe('#10251B');
    expect(authTokens.colors.primary).toBe('#C7FF2E');
    expect(authTokens.colors.textPrimary).toBe('#F4F6EB');
    expect(authTokens.focus.webOutlineColor).toBe(authTokens.colors.primary);
    expect(authTokens.focus.webOutlineWidth).toBeGreaterThanOrEqual(2);
  });

  it('keeps interactive targets and loading geometry stable', () => {
    expect(authTokens.sizing.minInteractiveSize).toBe(44);
    expect(authTokens.sizing.buttonHeight).toBeGreaterThanOrEqual(authTokens.sizing.minInteractiveSize);
    expect(authTokens.sizing.loadingBlockHeight).toBeGreaterThan(0);
    expect(authTokens.breakpoints.desktop).toBeGreaterThan(authTokens.breakpoints.mobile);
  });

  it('removes decorative motion when reduced motion is requested', () => {
    expect(createAuthMotionTokens(false).durationMs).toBeGreaterThan(0);
    expect(createAuthMotionTokens(true)).toEqual({ durationMs: 0, decorativeOpacity: 1 });
  });
});
