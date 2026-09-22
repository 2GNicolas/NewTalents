import type { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/database/prisma.service.js';
import { createApplication } from '../../src/main.js';
import { PassportController } from '../../src/player-passport/http/passport.controller.js';
import { PassportAuthorizationAdapter } from '../../src/player-passport/passport-authorization/passport-authorization.adapter.js';
import { PASSPORT_KEY_MATERIAL } from '../../src/player-passport/passport-key.token.js';
import { PassportAgePolicyService } from '../../src/player-passport/age-policy/passport-age-policy.service.js';
import { PassportTraceService } from '../../src/player-passport/passport-lifecycle/passport-trace.service.js';
import { PassportTransactionRunner } from '../../src/player-passport/passport-lifecycle/transaction-runner.js';
import { PlayerPassportService, type CorrectiveDraftInput, type CorrectiveDraftResult } from '../../src/player-passport/player-passport.service.js';
import { decryptPassportValue } from '../../src/player-passport/player-private-identity/passport-crypto.js';
import type { PassportKeyMaterial } from '../../src/player-passport/player-private-identity/passport-keys.js';
import { PrivateIdentityService } from '../../src/player-passport/player-private-identity/private-identity.service.js';
import { RepresentativeConfirmationService } from '../../src/player-passport/representation/representative-confirmation.service.js';
import {
  cleanupPassportTestData,
  createCorrectivePassportFixtureSet,
  createPassportAcademy,
  createPassportIdentity,
  createPassportMembership,
  type CorrectivePassportFixtureSet,
} from '../passport-test-helpers.js';

const response = () => ({ setHeader: () => response(), status: () => response() });

describe('T104 sequential corrective PostgreSQL integration', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let app: INestApplication;
  let secondApp: INestApplication;
  let prisma: PrismaService;
  let fixture: CorrectivePassportFixtureSet;
  let passports: PlayerPassportService;
  let confirmations: RepresentativeConfirmationService;
  let authorization: PassportAuthorizationAdapter;
  let controller: PassportController;
  let privateIdentities: PrivateIdentityService;
  let keys: PassportKeyMaterial;
  let concurrentPassportId: string;
  let concurrentOwnerId: string;

  const trackCreated = async (result: CorrectiveDraftResult) => {
    if (result.outcome !== 'created') return;
    fixture.ids.passportIds.push(result.passportId);
    const passport = await prisma.playerPassport.findUniqueOrThrow({ where: { id: result.passportId }, select: { playerId: true, createdByIdentityId: true } });
    fixture.ids.playerIds.push(passport.playerId);
  };

  const selfInput = (actorIdentityId: string, documentNumber: string): CorrectiveDraftInput => ({
    actorIdentityId,
    managementContext: 'SELF',
    privateIdentity: { legalName: 'Adulto Sintetico T104', dateOfBirth: '1990-01-15', documentType: 'CC', documentNumber },
    profile: { position: 'Defensa', ageCategory: 'Mayores', city: 'Bogota', country: 'Colombia', dominantFoot: 'RIGHT' },
  });

  beforeAll(async () => {
    app = await createApplication({ logger: false });
    secondApp = await createApplication({ logger: false });
    await app.init();
    await secondApp.init();
    prisma = app.get(PrismaService);
    fixture = await createCorrectivePassportFixtureSet(prisma, pool);
    passports = app.get(PlayerPassportService);
    confirmations = app.get(RepresentativeConfirmationService);
    authorization = app.get(PassportAuthorizationAdapter);
    controller = app.get(PassportController);
    privateIdentities = app.get(PrivateIdentityService);
    keys = app.get<PassportKeyMaterial>(PASSPORT_KEY_MATERIAL);
  });

  afterAll(async () => {
    if (fixture) await cleanupPassportTestData(pool, fixture.ids);
    await secondApp?.close();
    await app?.close();
    await pool.end();
  });

  it('serializes concurrent SELF creation for one normalized document across separate database sessions', async () => {
    const leftIdentity = await createPassportIdentity(prisma, 'USER');
    const rightIdentity = await createPassportIdentity(prisma, 'USER');
    fixture.ids.identities.push(leftIdentity, rightIdentity);
    const left = app.get(PlayerPassportService);
    const right = secondApp.get(PlayerPassportService);

    const results = await Promise.all([
      left.createDraft(selfInput(leftIdentity, ' t104-doc-001 ')),
      right.createDraft(selfInput(rightIdentity, 'T104-DOC-001')),
    ]);
    for (const result of results) await trackCreated(result);
    expect(results.filter((result) => result.outcome === 'created')).toHaveLength(1);
    expect(results.filter((result) => result.outcome === 'duplicate-document')).toHaveLength(1);

    const winner = results.find((result): result is Extract<CorrectiveDraftResult, { outcome: 'created' }> => result.outcome === 'created');
    expect(winner).toBeDefined();
    concurrentPassportId = winner!.passportId;
    const passport = await prisma.playerPassport.findUniqueOrThrow({ where: { id: concurrentPassportId }, select: { playerId: true, createdByIdentityId: true } });
    concurrentOwnerId = passport.createdByIdentityId;
    const identity = await prisma.playerPrivateIdentity.findUniqueOrThrow({ where: { playerId: passport.playerId }, select: { documentFingerprint: true } });
    expect(await prisma.playerPrivateIdentity.count({ where: { documentFingerprint: identity.documentFingerprint } })).toBe(1);
    expect(await prisma.passportResponsibility.count({ where: { passportId: concurrentPassportId, kind: 'SELF' } })).toBe(1);
    expect(await prisma.passportLifecycleEvent.count({ where: { passportId: concurrentPassportId, action: 'CREATED' } })).toBe(1);
  });

  it('follows current academy membership plus explicit academy responsibility, never creator identity', async () => {
    const currentColleague = await createPassportIdentity(prisma, 'ACADEMY_USER');
    fixture.ids.identities.push(currentColleague);
    await createPassportMembership(prisma, currentColleague, fixture.academyId);
    await expect(authorization.authorize({ identityId: currentColleague, permission: 'passport.academy.manage', passportId: fixture.passports.academyMinor })).resolves.toMatchObject({ allowed: true });

    await prisma.academyMembership.updateMany({ where: { identityId: fixture.identities.mixedUser, status: 'ACTIVE' }, data: { status: 'ENDED', endedAt: new Date('2026-09-21T12:00:00Z') } });
    await expect(authorization.authorize({ identityId: fixture.identities.mixedUser, permission: 'passport.academy.manage', passportId: fixture.passports.academyMinor })).resolves.toMatchObject({ allowed: false });

    const unrelatedAcademy = await createPassportAcademy(prisma);
    fixture.ids.academyIds.push(unrelatedAcademy);
    await createPassportMembership(prisma, fixture.identities.mixedUser, unrelatedAcademy);
    await expect(authorization.authorize({ identityId: fixture.identities.mixedUser, permission: 'passport.academy.manage', passportId: fixture.passports.academyMinor })).resolves.toMatchObject({ allowed: false });
  });

  it('rolls representative-confirmation consumption back with passport creation and consumes exactly once on success', async () => {
    const academyUser = await createPassportIdentity(prisma, 'ACADEMY_USER');
    const representative = await createPassportIdentity(prisma, 'USER');
    const academyId = await createPassportAcademy(prisma);
    fixture.ids.identities.push(academyUser, representative);
    fixture.ids.academyIds.push(academyId);
    await createPassportMembership(prisma, academyUser, academyId);
    const playerDocumentNumber = 'T104-ACADEMY-MINOR-001';
    const confirmation = await confirmations.createForPlayerDocument({ representativeIdentityId: representative, legalName: 'Representante Sintetico', documentType: 'CC', documentNumber: 'T104-REP-001', relationship: 'MOTHER', playerDocumentType: 'TI', playerDocumentNumber });
    const input: CorrectiveDraftInput = {
      actorIdentityId: academyUser, managementContext: 'ACADEMY', academyId, representativeConfirmationId: confirmation.id,
      privateIdentity: { legalName: 'Menor Sintetico T104', dateOfBirth: '2012-01-15', documentType: 'TI', documentNumber: playerDocumentNumber },
      profile: { position: 'Volante', ageCategory: 'Sub-15', city: 'Bogota', country: 'Colombia', dominantFoot: 'LEFT' },
    };
    const failing = new PlayerPassportService(
      prisma,
      app.get(PassportTransactionRunner),
      privateIdentities,
      app.get(PassportAgePolicyService),
      { createSignal: async () => ({ outcome: 'invalid' as const }) } as never,
      app.get(PassportTraceService),
      keys,
    );
    await expect(failing.createDraft(input)).resolves.toEqual({ outcome: 'unavailable' });
    await expect(prisma.representativeConfirmation.findUniqueOrThrow({ where: { id: confirmation.id }, select: { status: true, passportId: true, consumedAt: true } })).resolves.toEqual({ status: 'PENDING', passportId: null, consumedAt: null });
    expect(await prisma.playerPassport.count({ where: { createdByIdentityId: academyUser } })).toBe(0);
    expect(await prisma.passportLifecycleEvent.count({ where: { actorIdentityId: academyUser } })).toBe(0);

    const created = await passports.createDraft(input);
    await trackCreated(created);
    expect(created.outcome).toBe('created');
    await expect(prisma.representativeConfirmation.findUniqueOrThrow({ where: { id: confirmation.id }, select: { status: true, passportId: true } })).resolves.toEqual({ status: 'CONSUMED', passportId: created.outcome === 'created' ? created.passportId : undefined });
    await expect(passports.createDraft(input)).resolves.toEqual({ outcome: 'forbidden' });
    expect(await prisma.representativeConfirmation.count({ where: { id: confirmation.id, status: 'CONSUMED' } })).toBe(1);
  });

  it('updates encrypted birth date and age eligibility atomically only in editable state with expected version', async () => {
    const passport = await prisma.playerPassport.findUniqueOrThrow({ where: { id: concurrentPassportId }, include: { player: { include: { privateIdentity: true } } } });
    const beforeCiphertext = passport.player.privateIdentity!.encryptedDateOfBirth;
    await expect(passports.updateDraft(concurrentPassportId, { actorIdentityId: concurrentOwnerId, expectedVersion: 1, privateIdentity: { dateOfBirth: '1991-02-16' } })).resolves.toEqual({ outcome: 'applied' });
    const updated = await prisma.playerPassport.findUniqueOrThrow({ where: { id: concurrentPassportId }, include: { player: { include: { privateIdentity: true } } } });
    expect(updated.version).toBe(2);
    expect(updated.player.privateIdentity!.encryptedDateOfBirth).not.toBe(beforeCiphertext);
    expect(decryptPassportValue(keys.privateEncryptionKey, updated.player.privateIdentity!.encryptedDateOfBirth)).toBe('1991-02-16');
    await expect(passports.ageAuthorityCompatible(concurrentPassportId)).resolves.toBe(true);

    const stableCiphertext = updated.player.privateIdentity!.encryptedDateOfBirth;
    await expect(passports.updateDraft(concurrentPassportId, { actorIdentityId: concurrentOwnerId, expectedVersion: 1, privateIdentity: { dateOfBirth: '1992-03-17' } })).resolves.toEqual({ outcome: 'conflict' });
    expect((await prisma.playerPrivateIdentity.findUniqueOrThrow({ where: { playerId: updated.playerId } })).encryptedDateOfBirth).toBe(stableCiphertext);
    await prisma.playerPassport.update({ where: { id: concurrentPassportId }, data: { state: 'IN_REVIEW' } });
    await expect(passports.updateDraft(concurrentPassportId, { actorIdentityId: concurrentOwnerId, expectedVersion: 2, privateIdentity: { dateOfBirth: '1993-04-18' } })).resolves.toEqual({ outcome: 'invalid-state' });
    expect((await prisma.playerPrivateIdentity.findUniqueOrThrow({ where: { playerId: updated.playerId } })).encryptedDateOfBirth).toBe(stableCiphertext);
  });

  it('reevaluates Colombia/18 on the operation date without granting SELF at the birthday transition', async () => {
    const passportId = fixture.passports.representedMinors[0];
    const passport = await prisma.playerPassport.findUniqueOrThrow({ where: { id: passportId }, select: { playerId: true, version: true } });
    await prisma.playerPrivateIdentity.create({ data: { playerId: passport.playerId, ...privateIdentities.createPrivateIdentity({ legalName: 'Menor Limite T104', dateOfBirth: fixture.birthdayBoundary.onMajority, documentType: 'TI', documentNumber: 'T104-BOUNDARY-001' }) } });
    expect(await passports.ageAuthorityCompatible(passportId, new Date('2026-09-20T17:00:00Z'))).toBe(true);
    expect(await passports.ageAuthorityCompatible(passportId, new Date('2026-09-21T17:00:00Z'))).toBe(false);
    expect(await passports.ageAuthorityCompatible(passportId, new Date('2026-09-22T17:00:00Z'))).toBe(false);

    await expect(passports.updateDraft(passportId, { actorIdentityId: fixture.identities.representativeUser, expectedVersion: passport.version, profile: { city: 'Tunja' }, operationDate: new Date('2026-09-20T17:00:00Z') })).resolves.toEqual({ outcome: 'applied' });
    await expect(passports.updateDraft(passportId, { actorIdentityId: fixture.identities.representativeUser, expectedVersion: passport.version + 1, profile: { city: 'Cali' }, operationDate: new Date('2026-09-21T17:00:00Z') })).resolves.toEqual({ outcome: 'conflict' });
    await expect(passports.updateDraft(passportId, { actorIdentityId: fixture.identities.representativeUser, expectedVersion: passport.version + 1, profile: { city: 'Pasto' }, operationDate: new Date('2026-09-22T17:00:00Z') })).resolves.toEqual({ outcome: 'conflict' });
    expect(await prisma.passportResponsibility.count({ where: { passportId, kind: 'SELF' } })).toBe(0);
    expect((await prisma.playerPassport.findUniqueOrThrow({ where: { id: passportId }, select: { city: true } })).city).toBe('Tunja');
  });

  it('keeps audit immutable and limits duplicate events and protected details to authorized internal history', async () => {
    const analyst = await createPassportIdentity(prisma, 'ANALYST');
    fixture.ids.identities.push(analyst);
    const protectedValues = ['T104-DOCUMENT-SECRET', 'T104-FINGERPRINT-SECRET', '75000000-0000-4000-8000-000000000099', 'T104-REPRESENTATIVE-SECRET'];
    const created = await prisma.passportLifecycleEvent.create({ data: { passportId: fixture.passports.adultSelf, actorIdentityId: fixture.identities.mixedUser, action: 'CREATED', outcome: 'APPLIED', resultingState: 'DRAFT', details: { documentNumber: protectedValues[0] } } });
    await prisma.passportPossibleDuplicateSignal.create({ data: { passportId: fixture.passports.adultSelf } });
    await prisma.passportPossibleDuplicateSignal.create({ data: { passportId: fixture.passports.adultSelf, status: 'RESOLVED', resolution: 'DIFFERENT_PLAYERS', resolvedByIdentityId: analyst, resolvedAt: new Date('2026-09-21T12:00:00Z') } });
    await prisma.passportLifecycleEvent.create({ data: { passportId: fixture.passports.adultSelf, actorIdentityId: analyst, action: 'POSSIBLE_DUPLICATE_RESOLVED', outcome: 'APPLIED', priorState: 'DRAFT', resultingState: 'DRAFT', details: { resolution: 'DIFFERENT_PLAYERS', documentFingerprint: protectedValues[1], candidateId: protectedValues[2], representativeSecret: protectedValues[3] } } });

    await expect(prisma.passportLifecycleEvent.update({ where: { id: created.id }, data: { outcome: 'FAILED' } })).rejects.toBeDefined();
    await expect(prisma.passportLifecycleEvent.delete({ where: { id: created.id } })).rejects.toBeDefined();
    const ordinaryStatus = await controller.status({ actor: { identityId: fixture.identities.mixedUser } } as never, fixture.passports.adultSelf, response() as never);
    const internalStatus = await controller.status({ actor: { identityId: analyst } } as never, fixture.passports.adultSelf, response() as never);
    const ordinary = await controller.history({ actor: { identityId: fixture.identities.mixedUser } } as never, fixture.passports.adultSelf, response() as never);
    const deniedInternal = await controller.internalHistory({ actor: { identityId: fixture.identities.mixedUser } } as never, fixture.passports.adultSelf, response() as never);
    const internal = await controller.internalHistory({ actor: { identityId: analyst } } as never, fixture.passports.adultSelf, response() as never);
    expect(ordinaryStatus).not.toHaveProperty('possibleDuplicate');
    expect(internalStatus).toMatchObject({ possibleDuplicate: 'UNRESOLVED' });
    expect(deniedInternal).toMatchObject({ code: 'passport_not_found' });
    expect('events' in ordinary && ordinary.events.map((event) => event.action)).toEqual(['CREATED']);
    expect('events' in internal && internal.events.map((event) => event.action)).toEqual(['CREATED', 'POSSIBLE_DUPLICATE_RESOLVED']);
    expect(JSON.stringify(internal)).toContain('DIFFERENT_PLAYERS');
    for (const protectedValue of protectedValues) {
      expect(JSON.stringify(ordinary)).not.toContain(protectedValue);
      expect(JSON.stringify(internal)).not.toContain(protectedValue);
    }
  });
});
