import { type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/database/prisma.service.js';
import { createApplication } from '../../src/main.js';
import { PlayerPassportService, type CorrectiveDraftInput } from '../../src/player-passport/player-passport.service.js';
import { PrivateIdentityService } from '../../src/player-passport/player-private-identity/private-identity.service.js';
import { RepresentativeConfirmationService } from '../../src/player-passport/representation/representative-confirmation.service.js';
import { cleanupPassportTestData, createPassportAcademy, createPassportIdentity, createPassportMembership, type PassportTestIds } from '../passport-test-helpers.js';

describe('corrective passport responsibility persistence', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ids: PassportTestIds = { identities: [], academyIds: [], playerIds: [], passportIds: [], sessions: [] };
  let app: INestApplication;
  let prisma: PrismaService;
  let passports: PlayerPassportService;
  let confirmations: RepresentativeConfirmationService;
  let privateIdentities: PrivateIdentityService;
  let selfUser: string;
  let representative: string;
  let secondUser: string;
  let academyUser: string;
  let academyId: string;
  let selfPassportId: string;
  let representedPassportId: string;

  const input = (actorIdentityId: string, managementContext: CorrectiveDraftInput['managementContext'], dateOfBirth: string, documentNumber: string = randomUUID()): CorrectiveDraftInput => ({
    actorIdentityId,
    managementContext,
    privateIdentity: { legalName: `Jugador ${documentNumber}`, dateOfBirth, documentType: dateOfBirth < '2008-09-21' ? 'CC' : 'TI', documentNumber },
    profile: { position: 'Defensa', ageCategory: 'Sub-23', city: 'Bogotá', country: 'Colombia', dominantFoot: 'RIGHT' },
    ...(managementContext === 'LEGAL_REPRESENTATIVE' ? { representative: { legalName: 'Representante', documentType: 'CC', documentNumber: `REP-${documentNumber}`, relationship: 'MOTHER', authorityConfirmed: true } } : {}),
    ...(managementContext === 'ACADEMY' ? { academyId } : {}),
  });

  beforeAll(async () => {
    app = await createApplication({ logger: false }); await app.init();
    prisma = app.get(PrismaService); passports = app.get(PlayerPassportService); confirmations = app.get(RepresentativeConfirmationService); privateIdentities = app.get(PrivateIdentityService);
    selfUser = await createPassportIdentity(prisma, 'USER'); representative = await createPassportIdentity(prisma, 'USER'); secondUser = await createPassportIdentity(prisma, 'USER'); academyUser = await createPassportIdentity(prisma, 'ACADEMY_USER');
    academyId = await createPassportAcademy(prisma); await prisma.academy.update({ where: { id: academyId }, data: { displayName: 'Academia Prueba' } }); await createPassportMembership(prisma, academyUser, academyId);
    ids.identities.push(selfUser, representative, secondUser, academyUser); ids.academyIds.push(academyId);
  });

  afterAll(async () => { await cleanupPassportTestData(pool, ids); await app.close(); await pool.end(); });

  const track = async (result: Awaited<ReturnType<PlayerPassportService['createDraft']>>) => {
    if (result.outcome !== 'created') return;
    ids.passportIds.push(result.passportId);
    const passport = await prisma.playerPassport.findUniqueOrThrow({ where: { id: result.passportId }, select: { playerId: true } }); ids.playerIds.push(passport.playerId);
  };

  it('atomically creates adult SELF and represented-minor responsibilities with Colombia-derived age', async () => {
    const adult = await passports.createDraft(input(selfUser, 'SELF', '1990-01-01'));
    const minor = await passports.createDraft(input(representative, 'LEGAL_REPRESENTATIVE', '2012-01-01'));
    await track(adult); await track(minor);
    expect(adult.outcome).toBe('created'); expect(minor.outcome).toBe('created');
    if (adult.outcome !== 'created' || minor.outcome !== 'created') throw new Error('expected created passports');
    selfPassportId = adult.passportId; representedPassportId = minor.passportId;
    const responsibilities = await prisma.passportResponsibility.findMany({ where: { passportId: { in: ids.passportIds } }, select: { kind: true, identityId: true } });
    expect(responsibilities).toEqual(expect.arrayContaining([{ kind: 'SELF', identityId: selfUser }, { kind: 'LEGAL_REPRESENTATIVE', identityId: representative }]));
    expect(await prisma.representativeConfirmation.count({ where: { representativeIdentityId: representative, status: 'CONSUMED' } })).toBe(1);
  });

  it('requires matching, live, single-use representative confirmation for an academy minor', async () => {
    const playerDocumentNumber = `MINOR-${randomUUID()}`;
    const confirmation = await confirmations.createForPlayerDocument({ representativeIdentityId: representative, legalName: 'Representante', documentType: 'CC', documentNumber: '900000001', relationship: 'MOTHER', playerDocumentType: 'TI', playerDocumentNumber });
    const academyInput = input(academyUser, 'ACADEMY', '2012-01-01', playerDocumentNumber);
    const created = await passports.createDraft({ ...academyInput, representativeConfirmationId: confirmation.id });
    await track(created); expect(created.outcome).toBe('created');
    const consumed = await prisma.representativeConfirmation.findUniqueOrThrow({ where: { id: confirmation.id } });
    expect(consumed).toMatchObject({ status: 'CONSUMED', passportId: created.outcome === 'created' ? created.passportId : undefined });
    expect(consumed.encryptedRelationship).toBeTruthy();
    expect(consumed.encryptedRelationship).not.toBe('MOTHER');
    await expect(passports.createDraft({ ...input(academyUser, 'ACADEMY', '2012-01-01'), representativeConfirmationId: confirmation.id })).resolves.toMatchObject({ outcome: 'forbidden' });

    const mismatched = await confirmations.createForPlayerDocument({ representativeIdentityId: representative, legalName: 'Representante', documentType: 'CC', documentNumber: '900000002', relationship: 'MOTHER', playerDocumentType: 'TI', playerDocumentNumber: 'BOUND-DOCUMENT' });
    await expect(passports.createDraft({ ...input(academyUser, 'ACADEMY', '2012-01-01', 'OTHER-DOCUMENT'), representativeConfirmationId: mismatched.id })).resolves.toMatchObject({ outcome: 'forbidden' });
    const expired = await confirmations.createForPlayerDocument({ representativeIdentityId: representative, legalName: 'Representante', documentType: 'CC', documentNumber: '900000003', relationship: 'MOTHER', playerDocumentType: 'TI', playerDocumentNumber: 'EXPIRED-DOCUMENT', now: new Date('2020-01-01') });
    await expect(passports.createDraft({ ...input(academyUser, 'ACADEMY', '2012-01-01', 'EXPIRED-DOCUMENT'), representativeConfirmationId: expired.id })).resolves.toMatchObject({ outcome: 'forbidden' });
  });

  it('enforces one SELF passport per identity without partial rows', async () => {
    const second = await passports.createDraft(input(selfUser, 'SELF', '1991-01-01'));
    expect(second.outcome).toBe('duplicate-document');
    expect(await prisma.passportResponsibility.count({ where: { identityId: selfUser, kind: 'SELF' } })).toBe(1);
  });

  it('serializes exact-document concurrency to one passport', async () => {
    const documentNumber = `CONCURRENT-${randomUUID()}`;
    const results = await Promise.all([passports.createDraft(input(secondUser, 'SELF', '1990-01-01', documentNumber)), passports.createDraft(input(representative, 'SELF', '1990-01-01', documentNumber))]);
    for (const result of results) await track(result);
    expect(results.filter((result) => result.outcome === 'created')).toHaveLength(1);
    expect(results.filter((result) => result.outcome === 'duplicate-document')).toHaveLength(1);
  });

  it('protects editable private identity updates with version, duplicate and age-authority checks', async () => {
    const draft = await passports.editableDraft(selfPassportId);
    expect(draft).toMatchObject({ passportId: selfPassportId, dateOfBirth: '1990-01-01', lifecycleState: 'DRAFT', version: 1 });

    await expect(passports.updateDraft(representedPassportId, {
      actorIdentityId: representative,
      expectedVersion: 1,
      privateIdentity: { dateOfBirth: '2000-01-01' },
    })).resolves.toEqual({ outcome: 'conflict' });

    await expect(passports.updateDraft(selfPassportId, {
      actorIdentityId: selfUser,
      expectedVersion: 1,
      privateIdentity: { legalName: 'Jugador actualizado' },
      profile: { position: 'Volante' },
    })).resolves.toEqual({ outcome: 'applied' });
    await expect(passports.updateDraft(selfPassportId, {
      actorIdentityId: selfUser,
      expectedVersion: 1,
      profile: { position: 'Portero' },
    })).resolves.toEqual({ outcome: 'conflict' });
  });

  it('reevaluates current Colombia age authority from persisted birth date before submission', async () => {
    const represented = await prisma.playerPassport.findUniqueOrThrow({ where: { id: representedPassportId }, select: { playerId: true } });
    const current = await passports.editableDraft(representedPassportId);
    if (!current) throw new Error('expected editable represented passport');
    const adultIdentity = privateIdentities.createPrivateIdentity({
      legalName: current.playerLegalName,
      dateOfBirth: '2000-01-01',
      documentType: current.playerDocument.documentType,
      documentNumber: current.playerDocument.documentNumber,
    });
    await prisma.playerPrivateIdentity.update({ where: { playerId: represented.playerId }, data: adultIdentity });
    await expect(passports.ageAuthorityCompatible(representedPassportId)).resolves.toBe(false);
    expect(await prisma.passportResponsibility.count({ where: { passportId: representedPassportId, kind: 'SELF' } })).toBe(0);
  });
});
