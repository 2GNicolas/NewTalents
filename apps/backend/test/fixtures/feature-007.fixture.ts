import { randomUUID } from 'node:crypto';

export const FEATURE_007_CANARIES = Object.freeze({
  civilDocument: 'F007-CIVIL-DOCUMENT-CANARY',
  contact: 'f007-contact-canary@example.test',
  credential: 'F007-CREDENTIAL-CANARY',
  deletedEvidence: 'F007-DELETED-EVIDENCE-CANARY',
  objectKey: 'feature-007/private/object-key-canary',
  digest: 'f007-digest-canary',
});

export type Feature007FixtureIds = Readonly<{
  administratorIdentityId: string;
  analystIdentityId: string;
  ownerIdentityId: string;
  requestId: string;
  requestPlayerId: string;
  dossierId: string;
  playerId: string;
  passportId: string;
}>;

export function createFeature007FixtureIds(): Feature007FixtureIds {
  return {
    administratorIdentityId: randomUUID(),
    analystIdentityId: randomUUID(),
    ownerIdentityId: randomUUID(),
    requestId: randomUUID(),
    requestPlayerId: randomUUID(),
    dossierId: randomUUID(),
    playerId: randomUUID(),
    passportId: randomUUID(),
  };
}

export function buildAdministratorFixture(ids = createFeature007FixtureIds()) {
  return {
    identity: { id: ids.administratorIdentityId, status: 'ACTIVE' as const },
    roleAssignment: {
      id: randomUUID(),
      identityId: ids.administratorIdentityId,
      assignedByIdentityId: ids.administratorIdentityId,
      role: 'ADMINISTRATOR' as const,
      status: 'ACTIVE' as const,
    },
  };
}

export function buildAnalystProfileFixture(
  ids = createFeature007FixtureIds(),
  displayLabel = 'Analista Sintético A',
) {
  return {
    identity: { id: ids.analystIdentityId, status: 'ACTIVE' as const },
    roleAssignment: {
      id: randomUUID(),
      identityId: ids.analystIdentityId,
      assignedByIdentityId: ids.administratorIdentityId,
      role: 'ANALYST' as const,
      status: 'ACTIVE' as const,
    },
    profile: {
      identityId: ids.analystIdentityId,
      displayLabel,
      normalizedLabel: displayLabel.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase(),
    },
  };
}

export function buildApprovedRequestFixture(ids = createFeature007FixtureIds()) {
  return {
    request: {
      id: ids.requestId,
      type: 'PERSONAL_ADULT' as const,
      status: 'APPROVED' as const,
      ownerIdentityId: ids.ownerIdentityId,
      version: 1,
      approvalExecutionStatus: 'FINALIZED' as const,
    },
    requestPlayer: {
      id: ids.requestPlayerId,
      requestId: ids.requestId,
      linkedPlayerId: ids.playerId,
      encryptedLegalName: 'synthetic-ciphertext',
      encryptedDateOfBirth: 'synthetic-ciphertext',
      encryptedDocumentType: 'synthetic-ciphertext',
      encryptedDocumentNumber: 'synthetic-ciphertext',
      documentFingerprint: `synthetic-document-${ids.requestId}`,
      nameDobFingerprint: `synthetic-name-dob-${ids.requestId}`,
      encryptedCountry: 'synthetic-ciphertext',
      encryptedCity: 'synthetic-ciphertext',
      derivedAdult: true,
    },
  };
}

export function buildConfirmedDossierFixture(ids = createFeature007FixtureIds()) {
  return {
    id: ids.dossierId,
    requestId: ids.requestId,
    requestVersion: 1,
    administratorIdentityId: ids.administratorIdentityId,
    transferredCategories: ['IDENTITY_FRONT'] as const,
    declarationVersion: 'synthetic-dossier-v1',
    confirmedAt: new Date('2026-09-30T15:00:00.000Z'),
  };
}

export function buildLinkedPassportFixture(ids = createFeature007FixtureIds()) {
  return {
    player: { id: ids.playerId },
    passport: {
      id: ids.passportId,
      playerId: ids.playerId,
      state: 'ACTIVE' as const,
      enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT' as const,
      originKind: 'PARTICULAR' as const,
      position: 'UNSPECIFIED',
      ageCategory: 'ADULT',
      city: 'Synthetic City',
      country: 'CO',
      dominantFoot: 'UNDECLARED' as const,
      createdByIdentityId: ids.ownerIdentityId,
      version: 0,
    },
    requestPlayerLink: {
      requestPlayerId: ids.requestPlayerId,
      linkedPlayerId: ids.playerId,
    },
  };
}

export function buildFeature007PrivacyCanaryFixture(ids = createFeature007FixtureIds()) {
  return {
    ids,
    safeProjection: {
      maskedReference: `NT-${ids.passportId.slice(0, 8).toUpperCase()}`,
      displayLabel: 'Jugador Sintético',
      analystLabel: 'Analista Sintético A',
    },
    protectedValues: { ...FEATURE_007_CANARIES },
  };
}
