import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthorizationService } from '../../src/authorization/authorization.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { PassportAuthorizationAdapter } from '../../src/player-passport/passport-authorization/passport-authorization.adapter.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

describe('Feature 007 passport authorization compatibility', () => {
  const administratorId = randomUUID();
  const ownerId = randomUUID();
  const representativeId = randomUUID();
  const academyUserId = randomUUID();
  const analystId = randomUUID();
  const pendingId = randomUUID();
  const academyId = randomUUID();
  const playerId = randomUUID();
  const passportId = randomUUID();
  const identities = [administratorId, ownerId, representativeId, academyUserId, analystId, pendingId];

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.identity.createMany({ data: identities.map((id) => ({ id })) });
    await prisma.roleAssignment.createMany({ data: [
      { identityId: administratorId, assignedByIdentityId: administratorId, role: 'ADMINISTRATOR', status: 'ACTIVE' },
      { identityId: ownerId, assignedByIdentityId: administratorId, role: 'USER', status: 'ACTIVE' },
      { identityId: representativeId, assignedByIdentityId: administratorId, role: 'USER', status: 'ACTIVE' },
      { identityId: academyUserId, assignedByIdentityId: administratorId, role: 'ACADEMY_USER', status: 'ACTIVE' },
      { identityId: analystId, assignedByIdentityId: administratorId, role: 'ANALYST', status: 'ACTIVE' },
    ] });
    await prisma.analystOperationalProfile.create({ data: { identityId: analystId, displayLabel: 'Analista Compatibilidad', normalizedLabel: 'analista compatibilidad' } });
    await prisma.academy.create({ data: { id: academyId, displayName: 'Academia Compatibilidad' } });
    await prisma.academyMembership.create({ data: { identityId: academyUserId, academyId, assignedByIdentityId: administratorId, status: 'ACTIVE' } });
    await prisma.player.create({ data: { id: playerId } });
    await prisma.playerPassport.create({ data: { id: passportId, playerId, state: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT', originKind: 'ACADEMY', position: 'MIDFIELDER', ageCategory: 'SENIOR', city: 'Bogota', country: 'CO', dominantFoot: 'RIGHT', createdByIdentityId: ownerId, originAcademyId: academyId } });
    await prisma.passportResponsibility.createMany({ data: [
      { passportId, identityId: ownerId, kind: 'SELF' },
      { passportId, identityId: representativeId, kind: 'LEGAL_REPRESENTATIVE' },
      { passportId, academyId, kind: 'ACADEMY' },
    ] });
    await prisma.passportCustody.create({ data: { passportId, currentAnalystIdentityId: analystId, version: 1, assignedAt: new Date() } });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`);
      await tx.passportCustody.deleteMany({ where: { passportId } });
      await tx.passportResponsibility.deleteMany({ where: { passportId } });
      await tx.playerPassport.deleteMany({ where: { id: passportId } });
      await tx.player.deleteMany({ where: { id: playerId } });
      await tx.academyMembership.deleteMany({ where: { academyId } });
      await tx.academy.deleteMany({ where: { id: academyId } });
      await tx.analystOperationalProfile.deleteMany({ where: { identityId: analystId } });
      await tx.roleAssignment.deleteMany({ where: { identityId: { in: identities } } });
      await tx.identity.deleteMany({ where: { id: { in: identities } } });
    });
    await prisma.$disconnect();
  });

  it('preserves SELF, representative, academy, Administrator and pending-applicant decisions while custody-scoping Analyst', async () => {
    const adapter = new PassportAuthorizationAdapter(prisma as never, new AuthorizationService());
    await expect(adapter.authorize({ identityId: ownerId, permission: 'passport.particular.manage', passportId })).resolves.toMatchObject({ allowed: true });
    await expect(adapter.authorize({ identityId: representativeId, permission: 'passport.particular.manage', passportId })).resolves.toMatchObject({ allowed: true });
    await expect(adapter.authorize({ identityId: academyUserId, permission: 'passport.academy.manage', passportId })).resolves.toMatchObject({ allowed: true });
    await expect(adapter.authorize({ identityId: administratorId, permission: 'passport.activate', passportId })).resolves.toMatchObject({ allowed: true });
    await expect(adapter.authorize({ identityId: administratorId, permission: 'passport.history.internal', passportId })).resolves.toMatchObject({ allowed: true });
    await expect(adapter.authorize({ identityId: analystId, permission: 'passport.review', passportId })).resolves.toMatchObject({ allowed: true });
    await expect(adapter.authorize({ identityId: pendingId, permission: 'passport.particular.manage', passportId })).resolves.toMatchObject({ allowed: false });
  });
});
