import { type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../../src/main.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import {
  cleanupPassportTestData,
  createPassportAcademy,
  createPassportIdentity,
  createPassportMembership,
  createPassportSession,
  issuePassportBearer,
  type PassportTestIds,
} from '../passport-test-helpers.js';

describe('Feature 005 passport lifecycle integration', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let app: INestApplication;
  let prisma: PrismaService;
  let tutorIdentity: string;
  let tutorToken: string;
  let analystIdentity: string;
  let analystToken: string;
  let adminIdentity: string;
  let adminToken: string;
  let strangerIdentity: string;
  let strangerToken: string;
  let academyUserIdentity: string;
  let academyUserToken: string;
  let representativeToken: string;
  let academyId: string;
  let tutorPassportId: string;
  let tutorPlayerId: string;
  let academyPassportId: string;
  let academyPlayerId: string;
  const ids: PassportTestIds = { identities: [], academyIds: [], playerIds: [], passportIds: [], sessions: [] };

  const uniqueDocumentNumber = `DOC-${randomUUID()}`;
  const uniqueLegalName = `Nombre ${randomUUID()}`;
  const academyDocumentNumber = `DOC-${randomUUID()}`;
  const academyLegalName = `Nombre ${randomUUID()}`;

  beforeAll(async () => {
    app = await createApplication({ logger: false });
    await app.init();
    prisma = app.get(PrismaService);

    tutorIdentity = await createPassportIdentity(prisma, 'TUTOR');
    analystIdentity = await createPassportIdentity(prisma, 'ANALYST');
    adminIdentity = await createPassportIdentity(prisma, 'ADMINISTRATOR');
    strangerIdentity = await createPassportIdentity(prisma, 'TUTOR');
    academyUserIdentity = await createPassportIdentity(prisma, 'ACADEMY_USER');
    const representativeIdentity = await createPassportIdentity(prisma, 'USER');
    ids.identities.push(tutorIdentity, analystIdentity, adminIdentity, strangerIdentity, academyUserIdentity, representativeIdentity);

    const tutorSession = await createPassportSession(prisma, tutorIdentity);
    const analystSession = await createPassportSession(prisma, analystIdentity);
    const adminSession = await createPassportSession(prisma, adminIdentity);
    const strangerSession = await createPassportSession(prisma, strangerIdentity);
    const academyUserSession = await createPassportSession(prisma, academyUserIdentity);
    const representativeSession = await createPassportSession(prisma, representativeIdentity);
    ids.sessions.push(tutorSession, analystSession, adminSession, strangerSession, academyUserSession, representativeSession);

    tutorToken = await issuePassportBearer(app, tutorIdentity, tutorSession);
    analystToken = await issuePassportBearer(app, analystIdentity, analystSession);
    adminToken = await issuePassportBearer(app, adminIdentity, adminSession);
    strangerToken = await issuePassportBearer(app, strangerIdentity, strangerSession);
    academyUserToken = await issuePassportBearer(app, academyUserIdentity, academyUserSession);
    representativeToken = await issuePassportBearer(app, representativeIdentity, representativeSession);

    academyId = await createPassportAcademy(prisma);
    ids.academyIds.push(academyId);
    await createPassportMembership(prisma, academyUserIdentity, academyId);
  });

  afterAll(async () => {
    await cleanupPassportTestData(pool, ids);
    await app.close();
    await pool.end();
  });

  it('returns empty-list collection creation capability for Tutor and active Academy User', async () => {
    const tutorList = await request(app.getHttpServer())
      .get('/passports?context=PARTICULAR')
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(200)
      .expect('Cache-Control', 'no-store');

    expect(tutorList.body.passports).toEqual([]);
    expect(tutorList.body.collectionActions).toEqual(['VIEW_PARTICULAR_SELECTOR', 'CREATE_SELF', 'CREATE_REPRESENTED_MINOR']);

    const academyList = await request(app.getHttpServer())
      .get(`/passports?context=ACADEMY&academyId=${academyId}`)
      .set('Authorization', `Bearer ${academyUserToken}`)
      .expect(200)
      .expect('Cache-Control', 'no-store');

    expect(academyList.body.passports).toEqual([]);
    expect(academyList.body.collectionActions).toEqual(['VIEW_ACADEMY_PORTFOLIO', 'CREATE_ACADEMY']);
  });

  it('persists a Tutor draft with profile fields and no photograph or media columns', async () => {
    const response = await request(app.getHttpServer())
      .post('/passports/drafts')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({
        legalName: uniqueLegalName,
        dateOfBirth: '2011-05-04',
        documentType: 'CC',
        documentNumber: uniqueDocumentNumber,
        position: 'Delantero',
        ageCategory: 'Sub-15',
        city: 'Medellín',
        country: 'Colombia',
        dominantFoot: 'Izquierda',
      })
      .expect(201)
      .expect('Cache-Control', 'no-store');

    tutorPassportId = response.body.passportId;
    ids.passportIds.push(tutorPassportId);

    const stored = await prisma.playerPassport.findUniqueOrThrow({
      where: { id: tutorPassportId },
      select: {
        playerId: true,
        state: true,
        originKind: true,
        position: true,
        ageCategory: true,
        city: true,
        country: true,
        dominantFoot: true,
      },
    });
    tutorPlayerId = stored.playerId;
    ids.playerIds.push(tutorPlayerId);

    expect(stored).toMatchObject({
      state: 'DRAFT',
      originKind: 'TUTOR',
      position: 'Delantero',
      ageCategory: 'Sub-15',
      city: 'Medellín',
      country: 'Colombia',
      dominantFoot: 'LEFT',
    });

    const columns = await pool.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlayerPassport'",
    );
    const columnNames = columns.rows.map((row) => row.column_name);
    expect(columnNames.some((column) => column.toLowerCase().includes('photo'))).toBe(false);
    expect(columnNames.some((column) => column.toLowerCase().includes('media'))).toBe(false);
  });

  it('rolls back a confirmed duplicate document attempt without creating a second player or passport', async () => {
    const before = await prisma.playerPassport.count({ where: { createdByIdentityId: tutorIdentity } });

    await request(app.getHttpServer())
      .post('/passports/drafts')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({
        legalName: `Otro ${randomUUID()}`,
        dateOfBirth: '2011-05-04',
        documentType: 'CC',
        documentNumber: uniqueDocumentNumber,
        position: 'Defensa',
        ageCategory: 'Sub-15',
        city: 'Bogotá',
        country: 'Colombia',
        dominantFoot: 'Derecha',
      })
      .expect(409)
      .expect((response) => expect(response.body).toMatchObject({ code: 'duplicate_passport' }));

    expect(await prisma.playerPassport.count({ where: { createdByIdentityId: tutorIdentity } })).toBe(before);
  });

  it('enforces role-specific lifecycle authorization and non-disclosing lookups', async () => {
    await request(app.getHttpServer())
      .post(`/passports/${tutorPassportId}/activate`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({})
      .expect(403)
      .expect((response) => expect(response.body).toMatchObject({ code: 'forbidden' }));

    await request(app.getHttpServer())
      .get(`/passports/${tutorPassportId}`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(404)
      .expect((response) => expect(response.body).toMatchObject({ code: 'passport_not_found' }));
  });

  it('completes the lifecycle from submission through activation and returns redacted history', async () => {
    await request(app.getHttpServer())
      .post(`/passports/${tutorPassportId}/submit`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({})
      .expect(200);

    await prisma.passportPossibleDuplicateSignal.create({ data: { passportId: tutorPassportId } });

    await request(app.getHttpServer())
      .post(`/passports/${tutorPassportId}/approve`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({})
      .expect(409)
      .expect((response) => expect(response.body).toMatchObject({ code: 'unresolved_duplicate_signal' }));

    await request(app.getHttpServer())
      .post(`/passports/${tutorPassportId}/possible-duplicate/resolve`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ resolution: 'DIFFERENT_PLAYERS' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/passports/${tutorPassportId}/approve`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .post(`/passports/${tutorPassportId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200)
      .expect((response) => expect(response.body.lifecycleState).toBe('ACTIVE'));

    const history = await request(app.getHttpServer())
      .get(`/passports/${tutorPassportId}/history`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(200)
      .expect('Cache-Control', 'no-store');

    expect(history.body.events.length).toBeGreaterThan(0);
    expect(JSON.stringify(history.body)).not.toContain(uniqueDocumentNumber);
    expect(JSON.stringify(history.body)).not.toContain('documentFingerprint');
  });

  it('projects academy origin as unavailable without inventing an academy name or photograph reference', async () => {
    const confirmation = await request(app.getHttpServer())
      .post('/passport-representation-confirmations')
      .set('Authorization', `Bearer ${representativeToken}`)
      .send({
        playerDocument: { documentType: 'TI', documentNumber: academyDocumentNumber },
        representative: { legalName: 'Representante', documentType: 'CC', documentNumber: `REP-${randomUUID()}`, relationship: 'MOTHER', authorityConfirmed: true },
      })
      .expect(201);
    const created = await request(app.getHttpServer())
      .post('/passports/drafts')
      .set('Authorization', `Bearer ${academyUserToken}`)
      .send({
        managementContext: 'ACADEMY',
        academyId,
        representativeConfirmationId: confirmation.body.confirmationId,
        playerLegalName: academyLegalName,
        dateOfBirth: '2012-07-08',
        playerDocument: { documentType: 'TI', documentNumber: academyDocumentNumber },
        footballProfile: { primaryPosition: 'Volante', declaredAgeCategory: 'Sub-13', city: 'Cali', country: 'Colombia', dominantFoot: 'BOTH' },
      })
      .expect(201);

    academyPassportId = created.body.passportId;
    ids.passportIds.push(academyPassportId);

    const stored = await prisma.playerPassport.findUniqueOrThrow({ where: { id: academyPassportId }, select: { playerId: true } });
    academyPlayerId = stored.playerId;
    ids.playerIds.push(academyPlayerId);

    const presentation = await request(app.getHttpServer())
      .get(`/passports/${academyPassportId}/presentation`)
      .set('Authorization', `Bearer ${academyUserToken}`)
      .expect(200)
      .expect('Cache-Control', 'no-store');

    expect(presentation.body.identity).toMatchObject({
      academyOrigin: { availability: 'UNAVAILABLE', value: null },
      photograph: { state: 'NEUTRAL_LOCAL_PLACEHOLDER' },
      primaryPosition: { availability: 'AVAILABLE', value: 'Volante' },
      declaredAgeCategory: { availability: 'AVAILABLE', value: 'Sub-13' },
      city: { availability: 'AVAILABLE', value: 'Cali' },
      country: { availability: 'AVAILABLE', value: 'Colombia' },
      dominantFoot: { availability: 'AVAILABLE', value: 'Ambos' },
    });
    expect(JSON.stringify(presentation.body)).not.toContain(academyDocumentNumber);
    expect(JSON.stringify(presentation.body)).not.toContain('documentFingerprint');
  });
});
