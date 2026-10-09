import { describe, expect, it, vi } from 'vitest';

import { encryptPassportValue } from '../../player-passport/player-private-identity/passport-crypto.js';
import { AdminRegistrationReviewService } from './admin-registration-review.service.js';

const adminId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const keys = { documentHmacKey: Buffer.alloc(32, 1), nameDobHmacKey: Buffer.alloc(32, 2), privateEncryptionKey: Buffer.alloc(32, 3) };
const enc = (value: string) => encryptPassportValue(keys.privateEncryptionKey, value);

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: requestId, type: 'REPRESENTED_MINOR', status: 'SUBMITTED', version: 3, approvalExecutionStatus: 'NONE', createdAt: new Date('2026-09-28T10:00:00Z'), submittedAt: new Date('2026-09-28T10:10:00Z'), latestSafeReason: null,
    academyContext: null,
    applicants: [{ id: 'applicant', encryptedLegalName: enc('Representante Sintético'), encryptedDateOfBirth: enc('1985-01-01'), encryptedDocumentType: enc('CC'), encryptedDocumentNumber: enc('SYN-100'), encryptedEmail: enc('synthetic@example.test'), encryptedPhone: enc('3000000000'), derivedAdult: true, documentFingerprint: 'SECRET-FINGERPRINT', nameDobFingerprint: 'SECRET-NAME-DOB' }],
    players: [{ id: 'player', encryptedLegalName: enc('Menor Sintético'), encryptedDateOfBirth: enc('2015-01-01'), encryptedDocumentType: enc('TI'), encryptedDocumentNumber: enc('SYN-200'), encryptedCountry: enc('Colombia'), encryptedCity: enc('Bogotá'), derivedAdult: false, documentFingerprint: 'SECRET-PLAYER-FINGERPRINT', nameDobFingerprint: 'SECRET-PLAYER-NAME-DOB' }],
    representatives: [],
    representedMinorDetail: { relationship: 'MOTHER', authorityDeclared: true }, personalAdultDetail: null, formalAcademyDetail: null, naturalPersonAcademyDetail: null, additionalAcademyAccountDetail: null, academyAdultPlayerDetail: null, academyMinorPlayerDetail: null,
    evidenceItems: [{ id: 'evidence', category: 'MINOR_CIVIL_IDENTITY', status: 'CLEAN', sizeBytes: 120, objectKey: 'SECRET-OBJECT-KEY', contentDigest: 'SECRET-DIGEST', scannerResultCode: 'SECRET-SCANNER' }],
    consents: [{ type: 'PRIVACY', textVersion: 'privacy-v1', requestVersion: 3, acceptedAt: new Date('2026-09-28T10:05:00Z'), actorIdentityId: adminId, scopeCategory: 'REPRESENTED_MINOR' }],
    corrections: [], dossierConfirmations: [], deletionRecords: [],
    duplicateSignals: [{ status: 'OPEN', signalType: 'NAME_DOB_SIMILARITY', encryptedCandidateReference: 'SECRET-CANDIDATE' }],
    ...overrides,
  };
}

describe('AdminRegistrationReviewService', () => {
  it('returns minimum structured data, current evidence, consent versions, history and safe duplicate risk', async () => {
    const prisma = { registrationRequest: { findUnique: vi.fn().mockResolvedValue(request()) } };
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }), projectCapabilities: vi.fn().mockResolvedValue(['registration.review.view', 'registration.review.request-correction']) };
    const history = { administratorHistory: vi.fn().mockResolvedValue([{ actor: adminId, at: '2026-09-28T10:10:00.000Z', action: 'SUBMIT', result: 'APPLIED' }]) };
    const typed = { readiness: vi.fn().mockResolvedValue({ ageRouteCompatible: true, representationComplete: true }) };
    const service = new AdminRegistrationReviewService(prisma as never, authorization as never, history as never, typed as never, keys);

    const result = await service.detail(adminId, requestId, 3);

    expect(result).toMatchObject({ outcome: 'found', request: {
      id: requestId, type: 'REPRESENTED_MINOR', version: 3, versionFresh: true,
      structuredData: { applicants: [{ legalName: 'Representante Sintético', document: { type: 'CC', number: 'SYN-100' } }], players: [{ legalName: 'Menor Sintético', country: 'Colombia', city: 'Bogotá' }], detail: { relationship: 'MOTHER', authorityDeclared: true } },
      evidence: [{ id: 'evidence', category: 'MINOR_CIVIL_IDENTITY', status: 'CLEAN', sizeBytes: 120 }],
      consents: [{ type: 'PRIVACY', version: 'privacy-v1', acceptedAt: '2026-09-28T10:05:00.000Z' }],
      duplicateReview: { state: 'REVIEW_REQUIRED', canApprove: false },
      capabilities: ['registration.review.view', 'registration.review.request-correction'],
    } });
    const json = JSON.stringify(result);
    for (const secret of ['SECRET-FINGERPRINT', 'SECRET-OBJECT-KEY', 'SECRET-DIGEST', 'SECRET-SCANNER', 'SECRET-CANDIDATE', 'NAME_DOB_SIMILARITY']) expect(json).not.toContain(secret);
  });

  it.each([
    [[], { state: 'CLEAR', canApprove: true }],
    [[{ status: 'DISTINCT', encryptedCandidateReference: 'PRIVATE' }], { state: 'RESOLVED_DISTINCT', canApprove: true }],
    [[{ status: 'CONFIRMED_CONFLICT', encryptedCandidateReference: 'PRIVATE' }], { state: 'CONFLICT', canApprove: false }],
  ] as const)('projects duplicate signals safely', async (duplicateSignals, expected) => {
    const service = new AdminRegistrationReviewService({ registrationRequest: { findUnique: vi.fn().mockResolvedValue(request({ duplicateSignals })) } } as never, { authorize: vi.fn().mockResolvedValue({ allowed: true }), projectCapabilities: vi.fn().mockResolvedValue([]) } as never, { administratorHistory: vi.fn().mockResolvedValue([]) } as never, { readiness: vi.fn().mockResolvedValue({ ageRouteCompatible: true, representationComplete: true }) } as never, keys);
    const result = await service.detail(adminId, requestId, 3);
    expect(result).toMatchObject({ outcome: 'found', request: { duplicateReview: expected } });
  });

  it('marks stale review versions and passes all current facts to action projection', async () => {
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }), projectCapabilities: vi.fn().mockResolvedValue([]) };
    const typed = { readiness: vi.fn().mockResolvedValue({ ageRouteCompatible: false, representationComplete: true }) };
    const service = new AdminRegistrationReviewService({ registrationRequest: { findUnique: vi.fn().mockResolvedValue(request({ dossierConfirmations: [{ requestVersion: 3, declarationVersion: 'dossier-v1', transferredCategories: ['MINOR_CIVIL_IDENTITY'], confirmedAt: new Date() }], deletionRecords: [{ status: 'COMPLETED', updatedAt: new Date() }] })) } } as never, authorization as never, { administratorHistory: vi.fn().mockResolvedValue([]) } as never, typed as never, keys);
    const result = await service.detail(adminId, requestId, 2);
    expect(result).toMatchObject({ outcome: 'found', request: { versionFresh: false } });
    expect(authorization.projectCapabilities).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 2, evidenceCompleteAndClean: true, duplicateConflictAbsent: false, manualDossierConfirmed: true, deletionState: 'COMPLETED', ageRouteCompatible: false, representationComplete: true }), expect.any(Array));
  });

  it.each([
    ['PERSONAL_ADULT', { personalAdultDetail: { actingForSelf: true } }],
    ['REPRESENTED_MINOR', { representedMinorDetail: { relationship: 'MOTHER', authorityDeclared: true } }],
    ['FORMAL_ACADEMY', { formalAcademyDetail: { encryptedAcademyName: enc('Academia Formal'), encryptedCountry: enc('Colombia'), encryptedCity: enc('Bogotá'), encryptedOrganizationType: enc('SAS'), encryptedNit: enc('SYN-NIT'), authorityDeclared: true } }],
    ['NATURAL_PERSON_ACADEMY', { naturalPersonAcademyDetail: { encryptedAcademyName: enc('Academia Natural'), encryptedCountry: enc('Colombia'), encryptedCity: enc('Cali'), encryptedTrainingPlace: null, operationDeclared: true, proofCategories: ['PLACE_USE_AUTHORIZATION'] } }],
    ['ADDITIONAL_ACADEMY_ACCOUNT', { additionalAcademyAccountDetail: { encryptedFunction: enc('Entrenador'), responsibleAuthorization: true } }],
    ['ACADEMY_ADULT_PLAYER', { academyAdultPlayerDetail: { adultAuthorization: true } }],
    ['ACADEMY_MINOR_PLAYER', { academyMinorPlayerDetail: { authorityDeclared: true } }],
  ] as const)('projects authorized actions and an explicit typed detail for %s', async (type, detail) => {
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }), projectCapabilities: vi.fn().mockResolvedValue(['registration.review.view', 'registration.review.reject']) };
    const service = new AdminRegistrationReviewService({ registrationRequest: { findUnique: vi.fn().mockResolvedValue(request({ type, ...detail })) } } as never, authorization as never, { administratorHistory: vi.fn().mockResolvedValue([]) } as never, { readiness: vi.fn().mockResolvedValue({ ageRouteCompatible: true, representationComplete: true }) } as never, keys);
    const result = await service.detail(adminId, requestId);
    expect(result).toMatchObject({ outcome: 'found', request: { type, capabilities: ['registration.review.view', 'registration.review.reject'], structuredData: { detail: expect.any(Object) } } });
  });

  it('denies safely without loading or disclosing the request', async () => {
    const prisma = { registrationRequest: { findUnique: vi.fn() } };
    const service = new AdminRegistrationReviewService(prisma as never, { authorize: vi.fn().mockResolvedValue({ allowed: false }) } as never, {} as never, {} as never, keys);
    await expect(service.detail(adminId, requestId)).resolves.toEqual({ outcome: 'not-found' });
    expect(prisma.registrationRequest.findUnique).not.toHaveBeenCalled();
  });
});
