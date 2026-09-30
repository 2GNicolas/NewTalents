import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrivateIdentityService } from '../../src/player-passport/player-private-identity/private-identity.service.js';
import type { PassportKeyMaterial } from '../../src/player-passport/player-private-identity/passport-keys.js';
import { RegistrationRequestRepository } from '../../src/registration-requests/persistence/registration-request.repository.js';

export const TEST_PASSPORT_KEYS: PassportKeyMaterial = Object.freeze({
  documentHmacKey: Buffer.alloc(32, 1), nameDobHmacKey: Buffer.alloc(32, 2), privateEncryptionKey: Buffer.alloc(32, 3),
});

export async function createSubmittedPersonalRequest(client: PrismaClient, input: Readonly<{
  type: 'PERSONAL_ADULT' | 'REPRESENTED_MINOR'; ownerIdentityId?: string; playerDocument: string; playerBirthDate: string;
}>) {
  const ownerIdentityId = input.ownerIdentityId ?? randomUUID();
  const requestId = randomUUID();
  if (!input.ownerIdentityId) await client.identity.create({ data: { id: ownerIdentityId } });
  const identities = new PrivateIdentityService(TEST_PASSPORT_KEYS);
  const representative = identities.createPrivateIdentity({ legalName: 'Representante Sintético', dateOfBirth: '1990-01-01', documentType: 'CC', documentNumber: `R-${ownerIdentityId}` });
  const player = identities.createPrivateIdentity({ legalName: 'Jugador Sintético', dateOfBirth: input.playerBirthDate, documentType: input.type === 'PERSONAL_ADULT' ? 'CC' : 'TI', documentNumber: input.playerDocument });
  const repository = new RegistrationRequestRepository(client as never);
  await repository.createTypedDraft(input.type === 'PERSONAL_ADULT' ? {
    requestId, ownerIdentityId, type: input.type,
    detail: {
      type: input.type,
      applicant: { ...player, identityId: ownerIdentityId, encryptedEmail: 'safe', emailFingerprint: `email-${ownerIdentityId}`, derivedAdult: true },
      player: { ...player, encryptedCountry: 'safe', encryptedCity: 'safe', derivedAdult: true }, actingForSelf: true,
    },
  } : {
    requestId, ownerIdentityId, type: input.type,
    detail: {
      type: input.type,
      applicant: { ...representative, identityId: ownerIdentityId, encryptedEmail: 'safe', emailFingerprint: `email-${ownerIdentityId}`, encryptedPhone: 'safe', phoneFingerprint: `phone-${ownerIdentityId}`, derivedAdult: true },
      player: { ...player, encryptedCountry: 'safe', encryptedCity: 'safe', derivedAdult: false }, relationship: 'MOTHER', authorityDeclared: true,
    },
  });
  await client.registrationApplicantAccess.create({ data: { requestId, identityId: ownerIdentityId, status: 'PENDING_ONBOARDING' } });
  if (!input.ownerIdentityId) await client.authenticationCredential.create({ data: { identityId: ownerIdentityId, normalizedEmail: `${ownerIdentityId}@example.test`, passwordHash: 'synthetic-hash' } });
  await client.registrationRequest.update({ where: { id: requestId }, data: { status: 'SUBMITTED' } });
  return { requestId, ownerIdentityId };
}

export async function cleanupPersonalFixtures(client: PrismaClient, requestIds: string[], identityIds: string[]) {
  await client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`);
    if (requestIds.length) {
      const links = await tx.registrationRequestPlayer.findMany({ where: { requestId: { in: requestIds } }, select: { linkedPlayerId: true } });
      const playerIds = links.flatMap((item) => item.linkedPlayerId ? [item.linkedPlayerId] : []);
      const passports = playerIds.length ? await tx.playerPassport.findMany({ where: { playerId: { in: playerIds } }, select: { id: true } }) : [];
      const passportIds = passports.map((item) => item.id);
      if (passportIds.length) await tx.passportResponsibility.deleteMany({ where: { passportId: { in: passportIds } } });
      if (playerIds.length) await tx.initialTutorResponsibility.deleteMany({ where: { playerId: { in: playerIds } } });
      if (passportIds.length) await tx.playerPassport.deleteMany({ where: { id: { in: passportIds } } });
      await tx.registrationApprovalExecution.deleteMany({ where: { requestId: { in: requestIds } } });
      await tx.registrationRequestEvent.deleteMany({ where: { requestId: { in: requestIds } } });
      await tx.registrationApplicantAccess.deleteMany({ where: { requestId: { in: requestIds } } });
      await tx.personalAdultRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } });
      await tx.representedMinorRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } });
      await tx.registrationRequestApplicant.deleteMany({ where: { requestId: { in: requestIds } } });
      await tx.registrationRequestPlayer.deleteMany({ where: { requestId: { in: requestIds } } });
      await tx.registrationRequest.deleteMany({ where: { id: { in: requestIds } } });
      if (playerIds.length) { await tx.playerPrivateIdentity.deleteMany({ where: { playerId: { in: playerIds } } }); await tx.player.deleteMany({ where: { id: { in: playerIds } } }); }
    }
    if (identityIds.length) {
      await tx.authenticationCredential.deleteMany({ where: { identityId: { in: identityIds } } });
      await tx.roleAssignment.deleteMany({ where: { OR: [{ identityId: { in: identityIds } }, { assignedByIdentityId: { in: identityIds } }] } });
      await tx.identity.deleteMany({ where: { id: { in: identityIds } } });
    }
  });
}
