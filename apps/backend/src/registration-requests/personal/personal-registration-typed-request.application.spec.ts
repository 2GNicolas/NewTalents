import { describe, expect, it, vi } from 'vitest';

import { PersonalRegistrationTypedRequestApplication } from './personal-registration-typed-request.application.js';

describe('PersonalRegistrationTypedRequestApplication correction readiness', () => {
  it('keeps immutable prior-version consents valid for a document-only correction', async () => {
    const prisma = { registrationRequest: { findUnique: vi.fn().mockResolvedValue({
      type: 'PERSONAL_ADULT', version: 2,
      evidenceItems: [{ category: 'IDENTITY_FRONT' }, { category: 'IDENTITY_BACK' }],
      consents: [
        { type: 'PRIVACY', requestVersion: 1 },
        { type: 'TRUTHFULNESS', requestVersion: 1 },
        { type: 'SELF_ACTION', requestVersion: 1 },
      ],
      representedMinorDetail: null, additionalAcademyAccountDetail: null, academyAdultPlayerDetail: null, academyMinorPlayerDetail: null,
    }) } };
    const application = new PersonalRegistrationTypedRequestApplication(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    await expect(application.readiness('11111111-1111-4111-8111-111111111111')).resolves.toEqual({ ageRouteCompatible: true, representationComplete: true });
  });
});
