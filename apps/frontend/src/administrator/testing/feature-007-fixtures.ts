export const FEATURE_007_TEST_IDS = Object.freeze({
  administratorIdentityId: '70000000-0000-4000-8000-000000000001',
  analystIdentityId: '70000000-0000-4000-8000-000000000002',
  requestId: '70000000-0000-4000-8000-000000000003',
  dossierId: '70000000-0000-4000-8000-000000000004',
  passportId: '70000000-0000-4000-8000-000000000005',
});

export const FEATURE_007_FRONTEND_CANARIES = Object.freeze({
  civilDocument: 'F007-UI-CIVIL-DOCUMENT-CANARY',
  contact: 'f007-ui-contact-canary@example.test',
  credential: 'F007-UI-CREDENTIAL-CANARY',
  deletedEvidence: 'F007-UI-DELETED-EVIDENCE-CANARY',
  objectKey: 'feature-007/ui/private-object-key-canary',
  digest: 'f007-ui-digest-canary',
});

export function buildAdministratorAccessFixture() {
  return {
    identityId: FEATURE_007_TEST_IDS.administratorIdentityId,
    capabilities: [
      'registration.request.review',
      'registration.dossier.view',
      'passport.custody.view',
    ],
  } as const;
}

export function buildAnalystSummaryFixture(overrides: Partial<{
  identityId: string;
  displayLabel: string;
  activeCustodyCount: number;
}> = {}) {
  return {
    identityId: FEATURE_007_TEST_IDS.analystIdentityId,
    displayLabel: 'Analista Sintético A',
    activeCustodyCount: 2,
    ...overrides,
  };
}

export function buildApprovedRequestSummaryFixture(overrides: Partial<{
  requestId: string;
  maskedReference: string;
  displayLabel: string;
}> = {}) {
  return {
    requestId: FEATURE_007_TEST_IDS.requestId,
    maskedReference: 'SOL-•••0003',
    displayLabel: 'Solicitante Sintético',
    requestType: 'PERSONAL_ADULT' as const,
    status: 'APPROVED' as const,
    linkedPassportId: FEATURE_007_TEST_IDS.passportId,
    ...overrides,
  };
}

export function buildConfirmedDossierSummaryFixture(overrides: Partial<{
  dossierId: string;
  dossierName: string | null;
  maskedReference: string;
  displayLabel: string;
  status: 'CONFIRMED' | 'DELETION_PENDING' | 'RECOVERY_REQUIRED' | 'APPROVED';
}> = {}) {
  return {
    dossierId: FEATURE_007_TEST_IDS.dossierId,
    dossierName: 'Expediente Sintético',
    maskedReference: 'EXP-•••0004',
    displayLabel: 'Expediente Sintético',
    status: 'APPROVED' as const,
    confirmedAt: '2026-09-30T15:00:00.000Z',
    requestType: 'PERSONAL_ADULT' as const,
    originRequest: {
      id: FEATURE_007_TEST_IDS.requestId,
      maskedReference: 'SOL-•••0003',
      status: 'APPROVED',
      available: true,
    },
    linkedPassport: {
      id: FEATURE_007_TEST_IDS.passportId,
      maskedReference: 'PAS-•••0005',
      status: 'ACTIVE',
      available: true,
    },
    ...overrides,
  };
}

export function buildLinkedPassportSummaryFixture(overrides: Partial<{
  passportId: string;
  maskedReference: string;
  displayLabel: string;
  custodyVersion: number;
}> = {}) {
  return {
    passportId: FEATURE_007_TEST_IDS.passportId,
    maskedReference: 'PAS-•••0005',
    displayLabel: 'Jugador Sintético',
    lifecycleState: 'ACTIVE' as const,
    enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT' as const,
    custody: { state: 'UNASSIGNED' as const, version: 0 },
    capabilities: ['ASSIGN'] as const,
    ...overrides,
  };
}

export function buildFeature007FrontendPrivacyFixture() {
  return {
    safe: {
      administrator: buildAdministratorAccessFixture(),
      analyst: buildAnalystSummaryFixture(),
      request: buildApprovedRequestSummaryFixture(),
      dossier: buildConfirmedDossierSummaryFixture(),
      passport: buildLinkedPassportSummaryFixture(),
    },
    protectedValues: { ...FEATURE_007_FRONTEND_CANARIES },
  };
}
