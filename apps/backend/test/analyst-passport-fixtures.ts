import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';

import { encryptPassportValue } from '../src/player-passport/player-private-identity/passport-crypto.js';
import { TEST_PASSPORT_KEYS } from './integration/registration-personal-test-fixture.js';

export const syntheticEncrypt = (value: string) => encryptPassportValue(TEST_PASSPORT_KEYS.privateEncryptionKey, value);

export async function addSyntheticPlayerName(client: PoolClient, playerId: string, name: string) {
  await client.query(`INSERT INTO "PlayerPrivateIdentity" (id, "playerId", "encryptedLegalName", "encryptedDateOfBirth",
    "encryptedDocumentType", "encryptedDocumentNumber", "documentFingerprint", "nameDobFingerprint", "updatedAt")
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`, [randomUUID(), playerId, syntheticEncrypt(name),
    syntheticEncrypt('2000-01-01'), syntheticEncrypt('CC'), syntheticEncrypt('fictional'), randomUUID(), randomUUID()]);
}

export async function addSyntheticCredential(client: PoolClient, identityId: string, email: string) {
  await client.query(`INSERT INTO "AuthenticationCredential" (id,"identityId","normalizedEmail","passwordHash","updatedAt")
    VALUES ($1,$2,$3,'not-a-real-password',now())`, [randomUUID(), identityId, email]);
}

export async function addApprovedApplicant(client: PoolClient, input: {
  identityId: string; type: 'PERSONAL_ADULT' | 'REPRESENTED_MINOR' | 'NATURAL_PERSON_ACADEMY';
  phone?: string; playerId?: string; academyId?: string;
}) {
  await client.query('BEGIN');
  try {
  const requestId = randomUUID();
  const applicantId = randomUUID();
  await client.query(`INSERT INTO "RegistrationRequest" (id,type,status,"ownerIdentityId","academyContextId","updatedAt")
    VALUES ($1,$2,'DRAFT',$3,$4,now())`, [requestId, input.type, input.identityId, input.academyId ?? null]);
  await client.query(`INSERT INTO "RegistrationRequestApplicant" (id,"requestId","identityId","encryptedLegalName",
    "encryptedDateOfBirth","encryptedDocumentType","encryptedDocumentNumber","documentFingerprint","nameDobFingerprint",
    "encryptedPhone","derivedAdult","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,now())`,
  [applicantId, requestId, input.identityId, syntheticEncrypt('Persona sintética'), syntheticEncrypt('1990-01-01'),
    syntheticEncrypt('CC'), syntheticEncrypt('fake'), randomUUID(), randomUUID(), input.phone ? syntheticEncrypt(input.phone) : null]);
  if (input.playerId) {
    const playerRequestId = randomUUID();
    await client.query(`INSERT INTO "RegistrationRequestPlayer" (id,"requestId","linkedPlayerId","encryptedLegalName",
      "encryptedDateOfBirth","encryptedDocumentType","encryptedDocumentNumber","documentFingerprint","nameDobFingerprint",
      "encryptedCountry","encryptedCity","derivedAdult","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,now())`,
    [playerRequestId, requestId, input.playerId, syntheticEncrypt('Jugador sintético'), syntheticEncrypt('2000-01-01'),
      syntheticEncrypt('CC'), syntheticEncrypt('fake'), randomUUID(), randomUUID(), syntheticEncrypt('CO'), syntheticEncrypt('Bogota')]);
    if (input.type === 'PERSONAL_ADULT') await client.query(`INSERT INTO "PersonalAdultRequestDetail" (id,"requestId","applicantId","playerId","actingForSelf")
      VALUES ($1,$2,$3,$4,true)`, [randomUUID(), requestId, applicantId, playerRequestId]);
    if (input.type === 'REPRESENTED_MINOR') await client.query(`INSERT INTO "RepresentedMinorRequestDetail" (id,"requestId","applicantId","playerId",relationship,"authorityDeclared")
      VALUES ($1,$2,$3,$4,'MOTHER',true)`, [randomUUID(), requestId, applicantId, playerRequestId]);
  }
  if (input.type === 'NATURAL_PERSON_ACADEMY') await client.query(`INSERT INTO "NaturalPersonAcademyRequestDetail"
    (id,"requestId","responsibleApplicantId","encryptedAcademyName","academyNameFingerprint","encryptedCountry",
      "encryptedCity","operationDeclared") VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
    [randomUUID(), requestId, applicantId, syntheticEncrypt('Academia sintética'), randomUUID(), syntheticEncrypt('CO'), syntheticEncrypt('Bogota')]);
  await client.query(`UPDATE "RegistrationRequest" SET status = 'APPROVED', "decidedAt" = now(),
    "approvalExecutionStatus" = 'FINALIZED', "updatedAt" = now() WHERE id = $1`, [requestId]);
  await client.query('COMMIT');
  return { requestId, applicantId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
