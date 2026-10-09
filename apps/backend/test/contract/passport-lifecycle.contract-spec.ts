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

const passportIdForMissingLookup = '99999999-9999-4999-8999-999999999999';
const testDocumentNumber = `DOC-${randomUUID()}`;
const testLegalName = `Nombre ${randomUUID()}`;

describe('Feature 005 passport HTTP contract', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let app: INestApplication;
  let prisma: PrismaService;
  let tutorIdentity: string;
  let tutorSession: string;
  let tutorToken: string;
  let analystIdentity: string;
  let analystSession: string;
  let analystToken: string;
  let adminIdentity: string;
  let adminSession: string;
  let adminToken: string;
  let createdPassportId: string;
  let createdPlayerId: string;
  const ids: PassportTestIds = { identities: [], academyIds: [], playerIds: [], passportIds: [], sessions: [] };

  beforeAll(async () => {
    app = await createApplication({ logger: false });
    await app.init();
    prisma = app.get(PrismaService);

    tutorIdentity = await createPassportIdentity(prisma, 'TUTOR');
    analystIdentity = await createPassportIdentity(prisma, 'ANALYST');
    adminIdentity = await createPassportIdentity(prisma, 'ADMINISTRATOR');
    ids.identities.push(tutorIdentity, analystIdentity, adminIdentity);

    tutorSession = await createPassportSession(prisma, tutorIdentity);
    analystSession = await createPassportSession(prisma, analystIdentity);
    adminSession = await createPassportSession(prisma, adminIdentity);
    ids.sessions.push(tutorSession, analystSession, adminSession);

    tutorToken = await issuePassportBearer(app, tutorIdentity, tutorSession);
    analystToken = await issuePassportBearer(app, analystIdentity, analystSession);
    adminToken = await issuePassportBearer(app, adminIdentity, adminSession);
  });

  afterAll(async () => {
    await cleanupPassportTestData(pool, ids);
    await app.close();
    await pool.end();
  });

  it('requires a valid bearer session for every protected passport operation', async () => {
    const server = app.getHttpServer();
    await request(server).get('/passports').expect(403);
    await request(server).post('/passports/drafts').send({}).expect(403);
    await request(server).get(`/passports/${passportIdForMissingLookup}`).expect(403);
    await request(server).get(`/passports/${passportIdForMissingLookup}/presentation`).expect(403);
    await request(server).patch(`/passports/${passportIdForMissingLookup}/draft`).send({}).expect(403);
    await request(server).post(`/passports/${passportIdForMissingLookup}/submit`).send({}).expect(403);
    await request(server).post(`/passports/${passportIdForMissingLookup}/return`).send({}).expect(403);
    await request(server).post(`/passports/${passportIdForMissingLookup}/possible-duplicate/resolve`).send({}).expect(403);
    await request(server).post(`/passports/${passportIdForMissingLookup}/approve`).send({}).expect(403);
    await request(server).post(`/passports/${passportIdForMissingLookup}/activate`).send({}).expect(403);
    await request(server).get(`/passports/${passportIdForMissingLookup}/history`).expect(403);
  });

  it('returns collection-level create capability for an authorized Tutor when the list is empty', async () => {
    const response = await request(app.getHttpServer())
      .get('/passports?context=PARTICULAR')
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(200)
      .expect('Cache-Control', 'no-store');

    expect(response.body.passports).toEqual([]);
    expect(response.body.collectionActions).toEqual(['VIEW_PARTICULAR_SELECTOR', 'CREATE_SELF', 'CREATE_REPRESENTED_MINOR']);
  });

  it('creates a Tutor Draft and returns a no-store status projection', async () => {
    const response = await request(app.getHttpServer())
      .post('/passports/drafts')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({
        legalName: testLegalName,
        dateOfBirth: '2011-05-04',
        documentType: 'CC',
        documentNumber: testDocumentNumber,
        position: 'Delantero',
        ageCategory: 'Sub-15',
        city: 'Medellín',
        country: 'Colombia',
        dominantFoot: 'Izquierda',
      })
      .expect(201)
      .expect('Cache-Control', 'no-store');

    expect(response.body).toMatchObject({
      lifecycleState: 'DRAFT',
      origin: 'HISTORICAL_TUTOR',
    });
    expect(response.body.availableActions).toEqual(expect.arrayContaining(['EDIT', 'SUBMIT', 'VIEW_HISTORY']));
    createdPassportId = response.body.passportId;
    ids.passportIds.push(createdPassportId);

    const createdPassport = await prisma.playerPassport.findUniqueOrThrow({ where: { id: createdPassportId }, select: { playerId: true } });
    createdPlayerId = createdPassport.playerId;
    ids.playerIds.push(createdPlayerId);
  });

  it('lists only the authenticated actor\'s accessible passport without private identity values', async () => {
    const response = await request(app.getHttpServer())
      .get('/passports?context=PARTICULAR')
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(200)
      .expect('Cache-Control', 'no-store');

    expect(response.body.passports).toHaveLength(1);
    expect(response.body.passports[0].passportId).toBe(createdPassportId);
    expect(response.body.collectionActions).toEqual(['VIEW_PARTICULAR_SELECTOR', 'CREATE_SELF', 'CREATE_REPRESENTED_MINOR']);
    expect(JSON.stringify(response.body)).not.toContain('documentNumber');
    expect(JSON.stringify(response.body)).not.toContain('dateOfBirth');
  });

  it('does not expose creation capability to Analyst or Administrator list responses', async () => {
    const analystList = await request(app.getHttpServer())
      .get('/passports?context=PARTICULAR')
      .set('Authorization', `Bearer ${analystToken}`)
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(analystList.body.collectionActions).toEqual(['VIEW_PARTICULAR_SELECTOR']);
    expect(analystList.body.passports.some((item: { passportId: string }) => item.passportId === createdPassportId)).toBe(true);

    const adminList = await request(app.getHttpServer())
      .get('/passports?context=PARTICULAR')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(adminList.body.collectionActions).toEqual(['VIEW_PARTICULAR_SELECTOR']);
    expect(adminList.body.passports.some((item: { passportId: string }) => item.passportId === createdPassportId)).toBe(true);
  });

  it('returns status and presentation without private identity values', async () => {
    const status = await request(app.getHttpServer())
      .get(`/passports/${createdPassportId}`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(status.body.lifecycleState).toBe('DRAFT');
    expect(JSON.stringify(status.body)).not.toContain('documentNumber');
    expect(JSON.stringify(status.body)).not.toContain('dateOfBirth');

    const presentation = await request(app.getHttpServer())
      .get(`/passports/${createdPassportId}/presentation`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(presentation.body.identity).toMatchObject({
      displayName: testLegalName,
      primaryPosition: { availability: 'AVAILABLE', value: 'Delantero' },
      declaredAgeCategory: { availability: 'AVAILABLE', value: 'Sub-15' },
      city: { availability: 'AVAILABLE', value: 'Medellín' },
      country: { availability: 'AVAILABLE', value: 'Colombia' },
      dominantFoot: { availability: 'AVAILABLE', value: 'Izquierda' },
      academyOrigin: { availability: 'UNAVAILABLE', value: null },
      photograph: { state: 'NEUTRAL_LOCAL_PLACEHOLDER' },
    });
    expect(presentation.body.sections.find((section: { section: string }) => section.section === 'STATISTICS').availability).toBe('FUTURE_DEPENDENCY');
    expect(JSON.stringify(presentation.body)).not.toContain('documentNumber');
    expect(JSON.stringify(presentation.body)).not.toContain('dateOfBirth');
    expect(JSON.stringify(presentation.body)).not.toContain('documentFingerprint');
  });

  it('validates profile fields and applies an editable Draft update', async () => {
    await request(app.getHttpServer())
      .patch(`/passports/${createdPassportId}/draft`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({ dominantFoot: 'Zurdísima' })
      .expect(400)
      .expect((response) => expect(response.body).toMatchObject({ code: 'invalid_request' }));

    await request(app.getHttpServer())
      .patch(`/passports/${createdPassportId}/draft`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({ position: 'Volante', city: 'Calle 10 # 5-20' })
      .expect(400)
      .expect((response) => expect(response.body).toMatchObject({ code: 'invalid_request' }));

    const updated = await request(app.getHttpServer())
      .patch(`/passports/${createdPassportId}/draft`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({ position: 'Volante', city: 'Medellín' })
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect((await prisma.playerPassport.findUniqueOrThrow({ where: { id: createdPassportId } })).position).toBe('Volante');
  });

  it('submits, returns, and resubmits with the approved state transitions', async () => {
    const submitted = await request(app.getHttpServer())
      .post(`/passports/${createdPassportId}/submit`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({})
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(submitted.body.lifecycleState).toBe('IN_REVIEW');

    await request(app.getHttpServer())
      .patch(`/passports/${createdPassportId}/draft`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({ position: 'Defensa' })
      .expect(409)
      .expect((response) => expect(response.body).toMatchObject({ code: 'invalid_state' }));

    const returned = await request(app.getHttpServer())
      .post(`/passports/${createdPassportId}/return`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ reason: 'Corrige la categoría declarada' })
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(returned.body.lifecycleState).toBe('RETURNED_FOR_CORRECTION');

    const resubmitted = await request(app.getHttpServer())
      .post(`/passports/${createdPassportId}/submit`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({})
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(resubmitted.body.lifecycleState).toBe('IN_REVIEW');
  });

  it('blocks approval until the possible-duplicate signal is resolved, then resolves, approves, and activates', async () => {
    await prisma.passportPossibleDuplicateSignal.create({ data: { passportId: createdPassportId } });

    await request(app.getHttpServer())
      .post(`/passports/${createdPassportId}/approve`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({})
      .expect(409)
      .expect((response) => expect(response.body).toMatchObject({ code: 'unresolved_duplicate_signal' }));

    const resolved = await request(app.getHttpServer())
      .post(`/passports/${createdPassportId}/possible-duplicate/resolve`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ resolution: 'DIFFERENT_PLAYERS' })
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(resolved.body.possibleDuplicate).toBe('RESOLVED_DIFFERENT');

    const approved = await request(app.getHttpServer())
      .post(`/passports/${createdPassportId}/approve`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({})
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(approved.body.lifecycleState).toBe('APPROVED');

    const activated = await request(app.getHttpServer())
      .post(`/passports/${createdPassportId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(activated.body.lifecycleState).toBe('ACTIVE');
  });

  it('returns a redacted history and uses the non-disclosing not-found error for unrelated lookups', async () => {
    const history = await request(app.getHttpServer())
      .get(`/passports/${createdPassportId}/history`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(history.body.passportId).toBe(createdPassportId);
    expect(history.body.events.length).toBeGreaterThan(0);
    expect(JSON.stringify(history.body)).not.toContain('documentNumber');

    await request(app.getHttpServer())
      .get(`/passports/${passportIdForMissingLookup}`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(404)
      .expect((response) => expect(response.body).toMatchObject({ code: 'passport_not_found' }));
  });
});
