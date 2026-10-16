import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AnalystWorkspaceAccess } from '../../src/analyst-workspace/application/analyst-workspace-access.js';
import { AnalystWorkContact } from '../../src/analyst-workspace/application/analyst-work-contact.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { decryptPassportValue } from '../../src/player-passport/player-private-identity/passport-crypto.js';
import { addApprovedApplicant, addSyntheticCredential } from '../analyst-passport-fixtures.js';
import { createAnalystWorkspaceFixture } from '../analyst-workspace-test-helpers.js';
import { TEST_PASSPORT_KEYS } from './registration-personal-test-fixture.js';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const access = new AnalystWorkspaceAccess(prisma as never);
const contact = new AnalystWorkContact({ decrypt: (value: string) => decryptPassportValue(TEST_PASSPORT_KEYS.privateEncryptionKey, value) });

describe('Feature 010 attributable work contact on isolated PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createAnalystWorkspaceFixture>>;
  beforeAll(async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature010_test_[a-f0-9]{12}$/);
    const client = await pool.connect();
    try {
      fixture = await createAnalystWorkspaceFixture(client);
      await addSyntheticCredential(client, fixture.ownerId, 'adult@example.test');
      await addApprovedApplicant(client, { identityId: fixture.ownerId, type: 'PERSONAL_ADULT', playerId: fixture.playerId, phone: '+570000000001' });
      await addSyntheticCredential(client, fixture.personalMinor.responsibleId, 'representative@example.test');
      await addApprovedApplicant(client, { identityId: fixture.personalMinor.responsibleId, type: 'REPRESENTED_MINOR',
        playerId: fixture.personalMinor.playerId, phone: '+570000000002' });
      await addSyntheticCredential(client, fixture.academyAdult.responsibleId, 'academy@example.test');
      await addApprovedApplicant(client, { identityId: fixture.academyAdult.responsibleId,
        type: 'NATURAL_PERSON_ACADEMY', academyId: fixture.academyAdult.academyId!, phone: '+570000000003' });
      await addApprovedApplicant(client, { identityId: fixture.academyMinor.responsibleId,
        type: 'NATURAL_PERSON_ACADEMY', academyId: fixture.academyMinor.academyId!, phone: '+570000000004' });
      const academyMinorRepresentative = randomUUID();
      await client.query('INSERT INTO "Identity" (id,"updatedAt") VALUES ($1,now())', [academyMinorRepresentative]);
      await client.query(`INSERT INTO "PassportResponsibility" (id,"passportId","identityId",kind)
        VALUES ($1,$2,$3,'LEGAL_REPRESENTATIVE')`, [randomUUID(), fixture.academyMinor.passportId, academyMinorRepresentative]);
      await addSyntheticCredential(client, academyMinorRepresentative, 'not-the-academy-contact@example.test');
      const extra = randomUUID();
      await client.query('INSERT INTO "Identity" (id,"updatedAt") VALUES ($1,now())', [extra]);
      await addSyntheticCredential(client, extra, 'additional@example.test');
      await client.query(`INSERT INTO "AcademyMembership" (id,"identityId","academyId","assignedByIdentityId")
        VALUES ($1,$2,$3,$4)`, [randomUUID(), extra, fixture.academyAdult.academyId, fixture.ownerId]);
    } finally { client.release(); }
  });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });

  const read = (actorId: string, passportId: string) => access.readPassport(actorId, passportId, (scope) => contact.forPassport(scope));

  it('projects both channels for adult SELF and personal minor representative, not the minor', async () => {
    expect(await read(fixture.analystId, fixture.passportId)).toEqual({ availability: 'AVAILABLE', kind: 'SELF',
      phone: '+570000000001', email: 'adult@example.test' });
    expect(await read(fixture.analystId, fixture.personalMinor.passportId)).toEqual({ availability: 'AVAILABLE', kind: 'LEGAL_REPRESENTATIVE',
      phone: '+570000000002', email: 'representative@example.test' });
  });

  it('uses only the academy creation responsible with current membership; one channel may suffice', async () => {
    expect(await read(fixture.analystId, fixture.academyAdult.passportId)).toEqual({ availability: 'AVAILABLE',
      kind: 'ACADEMY_RESPONSIBLE', phone: '+570000000003', email: 'academy@example.test' });
    expect(await read(fixture.analystId, fixture.academyMinor.passportId)).toEqual({ availability: 'AVAILABLE',
      kind: 'ACADEMY_RESPONSIBLE', phone: '+570000000004' });
  });

  it('does not substitute another account or historical phone when responsible relationship ends', async () => {
    await prisma.academyMembership.updateMany({ where: { academyId: fixture.academyAdult.academyId!, identityId: fixture.academyAdult.responsibleId },
      data: { status: 'ENDED', endedAt: new Date() } });
    expect(await read(fixture.analystId, fixture.academyAdult.passportId)).toEqual({ availability: 'UNAVAILABLE' });
    await prisma.academyMembership.updateMany({ where: { academyId: fixture.academyAdult.academyId!, identityId: fixture.academyAdult.responsibleId },
      data: { status: 'ACTIVE', endedAt: null } });
  });

  it('returns unavailable for ambiguous personal responsibility or missing channels, without exposing a third party', async () => {
    const extra = randomUUID();
    const client = await pool.connect();
    try {
      await client.query('INSERT INTO "Identity" (id,"updatedAt") VALUES ($1,now())', [extra]);
      await client.query(`INSERT INTO "PassportResponsibility" (id,"passportId","identityId",kind)
        VALUES ($1,$2,$3,'LEGAL_REPRESENTATIVE')`, [randomUUID(), fixture.personalMinor.passportId, extra]);
    } finally { client.release(); }
    expect(await read(fixture.analystId, fixture.personalMinor.passportId)).toEqual({ availability: 'UNAVAILABLE' });
    expect(await read(fixture.analystId, fixture.academyAdult.passportId)).toMatchObject({ email: 'academy@example.test' });
  });

  it('keeps an available email when phone attribution is absent and rejects a person with no channels', async () => {
    const client = await pool.connect();
    try {
      await addApprovedApplicant(client, { identityId: fixture.ownerId, type: 'PERSONAL_ADULT',
        playerId: fixture.nonActive.playerId, phone: '+570000000099' });
    } finally { client.release(); }
    await prisma.registrationRequestApplicant.updateMany({ where: { identityId: fixture.ownerId,
      request: { players: { some: { linkedPlayerId: fixture.playerId } } } }, data: { encryptedPhone: null, phoneFingerprint: null } });
    expect(await read(fixture.analystId, fixture.passportId)).toEqual({ availability: 'AVAILABLE', kind: 'SELF', email: 'adult@example.test' });
    await prisma.registrationRequestApplicant.updateMany({ where: { identityId: fixture.academyMinor.responsibleId }, data: { encryptedPhone: null, phoneFingerprint: null } });
    expect(await read(fixture.analystId, fixture.academyMinor.passportId)).toEqual({ availability: 'UNAVAILABLE' });
  });
});
