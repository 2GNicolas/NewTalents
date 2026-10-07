import { adminRequestPresentation } from './admin-terminal-request-routing';

describe('Administrator request presentation', () => {
  it.each(['APPROVED', 'REJECTED'] as const)('opens terminal %s requests as read-only information', (status) => {
    expect(adminRequestPresentation(status)).toBe('terminal-read-only');
  });

  it.each(['DRAFT', 'SUBMITTED', 'REQUIRES_CORRECTION'] as const)('preserves the Feature 006 review flow for %s requests', (status) => {
    expect(adminRequestPresentation(status)).toBe('actionable-review');
  });
});
