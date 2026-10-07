import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthorizationService } from '../../src/authorization/authorization.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { AdminDossierRepository } from '../../src/registration-requests/persistence/admin-dossier.repository.js';
import { RegistrationAuthorizationAdapter } from '../../src/registration-requests/authorization/registration-authorization.adapter.js';
import { AdminDossierQueryService } from '../../src/registration-requests/review/admin-dossier-query.service.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const types = ['PERSONAL_ADULT', 'REPRESENTED_MINOR', 'FORMAL_ACADEMY', 'NATURAL_PERSON_ACADEMY', 'ADDITIONAL_ACADEMY_ACCOUNT', 'ACADEMY_ADULT_PLAYER', 'ACADEMY_MINOR_PLAYER'] as const;

describe('Feature 007 confirmed dossier read model', () => {
  const adminId = randomUUID(); const requestIds: string[] = []; const dossierIds: string[] = [];
  const playerId = randomUUID(); const passportId = randomUUID(); const requestPlayerId = randomUUID();
  let service: AdminDossierQueryService;

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.identity.create({ data: { id: adminId, roleAssignments: { create: { assignedByIdentityId: adminId, role: 'ADMINISTRATOR', status: 'ACTIVE' } } } });
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`);
      for (let index = 0; index < types.length; index += 1) {
        const requestId = randomUUID(); const dossierId = randomUUID(); requestIds.push(requestId); dossierIds.push(dossierId);
        await transaction.registrationRequest.create({ data: { id: requestId, type: types[index]!, status: index === 0 ? 'APPROVED' : 'SUBMITTED', version: 2, approvalExecutionStatus: index === 0 ? 'FINALIZED' : 'NONE' } });
        await transaction.registrationManualDossierConfirmation.create({ data: { id: dossierId, requestId, requestVersion: 2, administratorIdentityId: adminId, transferredCategories: ['IDENTITY_FRONT'], declarationVersion: 'integration-v1', confirmedAt: new Date(`2026-09-${String(20 + index).padStart(2, '0')}T12:00:00.000Z`) } });
      }
      await transaction.player.create({ data: { id: playerId } });
      await transaction.playerPassport.create({ data: { id: passportId, playerId, state: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT', originKind: 'PARTICULAR', position: 'Defensa', ageCategory: 'Adulto', city: 'Medellín', country: 'Colombia', dominantFoot: 'RIGHT', createdByIdentityId: adminId } });
      await transaction.registrationRequestPlayer.create({ data: { id: requestPlayerId, requestId: requestIds[0]!, linkedPlayerId: playerId, encryptedLegalName: 'Jugadora enlace', encryptedDateOfBirth: '2000-01-01', encryptedDocumentType: 'CC', encryptedDocumentNumber: 'synthetic-document', documentFingerprint: `dossier-link-${requestPlayerId}`, nameDobFingerprint: `dossier-name-${requestPlayerId}`, encryptedCountry: 'Colombia', encryptedCity: 'Medellín', derivedAdult: true } });
    });
    service = new AdminDossierQueryService(new AdminDossierRepository(prisma as never), new RegistrationAuthorizationAdapter(prisma as never, new AuthorizationService()), { decrypt: (value) => value });
  });

  afterAll(async () => {
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`);
      await transaction.registrationManualDossierConfirmation.deleteMany({ where: { id: { in: dossierIds } } });
      await transaction.registrationRequestPlayer.deleteMany({ where: { id: requestPlayerId } });
      await transaction.playerPassport.deleteMany({ where: { id: passportId } });
      await transaction.player.deleteMany({ where: { id: playerId } });
      await transaction.registrationRequest.deleteMany({ where: { id: { in: requestIds } } });
      await transaction.roleAssignment.deleteMany({ where: { identityId: adminId } });
      await transaction.identity.deleteMany({ where: { id: adminId } });
    });
    await prisma.$disconnect();
  });

  it('walks stable pages without duplicates or omissions and includes all seven origin types', async () => {
    const seen: string[] = []; const seenTypes = new Set<string>(); let cursor: string | undefined;
    do {
      const page = await service.list(adminId, { limit: 3, ...(cursor ? { cursor } : {}) });
      expect(page.outcome).toBe('found'); if (page.outcome !== 'found') break;
      for (const item of page.items) if (dossierIds.includes(item.dossierId)) { seen.push(item.dossierId); seenTypes.add(item.requestType); }
      cursor = page.nextCursor;
    } while (cursor);
    expect(new Set(seen).size).toBe(seen.length);
    expect(new Set(seen)).toEqual(new Set(dossierIds));
    expect(seenTypes).toEqual(new Set(types));
  });

  it('refreshes current derived status and keeps non-passport origins explicitly notApplicable', async () => {
    const linked = await service.detail(adminId, dossierIds[0]!);
    expect(linked).toMatchObject({ outcome: 'found', detail: { linkedPassport: { id: passportId, status: 'ACTIVE:AWAITING_ANALYST_ENRICHMENT', available: true } } });
    const before = await service.detail(adminId, dossierIds[1]!);
    expect(before).toMatchObject({ outcome: 'found', detail: { status: 'CONFIRMED', linkedPassport: { notApplicable: true } } });
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`);
      await transaction.registrationRequest.update({ where: { id: requestIds[1]! }, data: { approvalExecutionStatus: 'RECOVERY_REQUIRED' } });
    });
    const after = await service.detail(adminId, dossierIds[1]!);
    expect(after).toMatchObject({ outcome: 'found', detail: { status: 'RECOVERY_REQUIRED' } });
  });

  it('does not mutate confirmation, approval or deletion records while reading', async () => {
    const before = await counts();
    await service.list(adminId, { limit: 50, status: 'CONFIRMED' });
    await service.detail(adminId, dossierIds[0]!);
    expect(await counts()).toEqual(before);
  });

  const counts = async () => ({ confirmations: await prisma.registrationManualDossierConfirmation.count({ where: { id: { in: dossierIds } } }), executions: await prisma.registrationApprovalExecution.count({ where: { requestId: { in: requestIds } } }), deletions: await prisma.registrationEvidenceDeletionRecord.count({ where: { requestId: { in: requestIds } } }) });
});
