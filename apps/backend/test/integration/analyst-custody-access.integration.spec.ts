import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthorizationService } from '../../src/authorization/authorization.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { AnalystPassportsQueryService } from '../../src/passport-custody/application/analyst-passports-query.service.js';
import { PassportCustodyCommandService } from '../../src/passport-custody/application/passport-custody-command.service.js';
import { PassportCustodyQueryService } from '../../src/passport-custody/application/passport-custody-query.service.js';
import { PassportCustodyRepository } from '../../src/passport-custody/persistence/passport-custody.repository.js';
import { PassportCustodyTransactionRunner } from '../../src/passport-custody/persistence/passport-custody-transaction.runner.js';
import { PassportAuthorizationAdapter } from '../../src/player-passport/passport-authorization/passport-authorization.adapter.js';
import { encryptPassportValue } from '../../src/player-passport/player-private-identity/passport-crypto.js';
import { TEST_PASSPORT_KEYS } from './registration-personal-test-fixture.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

describe('Feature 007 Analyst current-custody access', () => {
  const administratorId = randomUUID();
  const analystA = randomUUID();
  const analystB = randomUUID();
  const playerId = randomUUID();
  const passportId = randomUUID();

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.identity.createMany({ data: [{ id: administratorId }, { id: analystA }, { id: analystB }] });
    await prisma.roleAssignment.createMany({ data: [
      { identityId: administratorId, assignedByIdentityId: administratorId, role: 'ADMINISTRATOR', status: 'ACTIVE' },
      { identityId: analystA, assignedByIdentityId: administratorId, role: 'ANALYST', status: 'ACTIVE' },
      { identityId: analystB, assignedByIdentityId: administratorId, role: 'ANALYST', status: 'ACTIVE' },
    ] });
    await prisma.analystOperationalProfile.createMany({ data: [
      { identityId: analystA, displayLabel: 'Analista A', normalizedLabel: 'analista a' },
      { identityId: analystB, displayLabel: 'Analista B', normalizedLabel: 'analista b' },
    ] });
    await prisma.player.create({ data: { id: playerId } });
    await prisma.playerPrivateIdentity.create({ data: {
      playerId,
      encryptedLegalName: encryptPassportValue(TEST_PASSPORT_KEYS.privateEncryptionKey, 'Jugador Custodia'),
      encryptedDateOfBirth: encryptPassportValue(TEST_PASSPORT_KEYS.privateEncryptionKey, '1990-01-15'),
      encryptedDocumentType: encryptPassportValue(TEST_PASSPORT_KEYS.privateEncryptionKey, 'CC'),
      encryptedDocumentNumber: encryptPassportValue(TEST_PASSPORT_KEYS.privateEncryptionKey, randomUUID()),
      documentFingerprint: randomUUID(), nameDobFingerprint: randomUUID(),
    } });
    await prisma.playerPassport.create({ data: { id: passportId, playerId, state: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT', originKind: 'PARTICULAR', position: 'MIDFIELDER', ageCategory: 'SENIOR', city: 'Medellin', country: 'CO', dominantFoot: 'RIGHT', createdByIdentityId: administratorId } });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`);
      await tx.passportCustodyEvent.deleteMany({ where: { passportId } });
      await tx.passportCustody.deleteMany({ where: { passportId } });
      await tx.playerPassport.deleteMany({ where: { id: passportId } });
      await tx.playerPrivateIdentity.deleteMany({ where: { playerId } });
      await tx.player.deleteMany({ where: { id: playerId } });
      await tx.analystOperationalProfile.deleteMany({ where: { identityId: { in: [analystA, analystB] } } });
      await tx.roleAssignment.deleteMany({ where: { identityId: { in: [administratorId, analystA, analystB] } } });
      await tx.identity.deleteMany({ where: { id: { in: [administratorId, analystA, analystB] } } });
    });
    await prisma.$disconnect();
  });

  it('grants after commit and revokes on change, removal, role revocation, and profile removal', async () => {
    const commands = new PassportCustodyCommandService(new PassportCustodyTransactionRunner(prisma as never, async () => undefined));
    const custody = new PassportCustodyQueryService(new PassportCustodyRepository(prisma as never), { decrypt: (value) => value && 'Jugador Custodia' });
    const collection = new AnalystPassportsQueryService(prisma as never, custody);
    const authorization = new PassportAuthorizationAdapter(prisma as never, new AuthorizationService());

    await commands.assign({ passportId, administratorIdentityId: administratorId, analystIdentityId: analystA, expectedVersion: 0, idempotencyKey: randomUUID() });
    await expect(collection.list({ identityId: analystA, limit: 20 })).resolves.toMatchObject({ items: [{ passportId }] });
    await expect(authorization.authorize({ identityId: analystA, permission: 'passport.review', passportId })).resolves.toMatchObject({ allowed: true });

    await commands.change({ passportId, administratorIdentityId: administratorId, analystIdentityId: analystB, expectedVersion: 1, idempotencyKey: randomUUID(), reason: 'Cambiar a B' });
    await expect(collection.list({ identityId: analystA, limit: 20 })).resolves.toMatchObject({ items: [] });
    await expect(authorization.authorize({ identityId: analystA, permission: 'passport.review', passportId })).resolves.toMatchObject({ allowed: false });
    await expect(authorization.authorize({ identityId: analystB, permission: 'passport.review', passportId })).resolves.toMatchObject({ allowed: true });

    await commands.remove({ passportId, administratorIdentityId: administratorId, expectedVersion: 2, idempotencyKey: randomUUID(), reason: 'Retirar B' });
    await expect(authorization.authorize({ identityId: analystB, permission: 'passport.review', passportId })).resolves.toMatchObject({ allowed: false });

    await commands.assign({ passportId, administratorIdentityId: administratorId, analystIdentityId: analystA, expectedVersion: 3, idempotencyKey: randomUUID() });
    await prisma.roleAssignment.updateMany({ where: { identityId: analystA, role: 'ANALYST' }, data: { status: 'REVOKED' } });
    await expect(collection.list({ identityId: analystA, limit: 20 })).resolves.toEqual({ outcome: 'forbidden' });
    await expect(authorization.authorize({ identityId: analystA, permission: 'passport.review', passportId })).resolves.toMatchObject({ allowed: false });
    await prisma.roleAssignment.updateMany({ where: { identityId: analystA, role: 'ANALYST' }, data: { status: 'ACTIVE' } });
    await prisma.analystOperationalProfile.delete({ where: { identityId: analystA } });
    await expect(authorization.authorize({ identityId: analystA, permission: 'passport.review', passportId })).resolves.toMatchObject({ allowed: false });
  });
});
