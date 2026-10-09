import { type INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../../src/main.js';

describe('Feature 005 passport persistence schema', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let app: INestApplication;
  let creatorIdentityId: string;
  let analystIdentityId: string;
  let academyId: string;
  const playerIds: string[] = [];
  const passportIds: string[] = [];

  beforeAll(async () => {
    app = await createApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    if (passportIds.length) {
      await pool.query('DELETE FROM "PassportLifecycleEvent" WHERE "passportId" = ANY($1::uuid[])', [passportIds]);
      await pool.query('DELETE FROM "PassportPossibleDuplicateSignal" WHERE "passportId" = ANY($1::uuid[])', [passportIds]);
      await pool.query('DELETE FROM "PassportReviewReturn" WHERE "passportId" = ANY($1::uuid[])', [passportIds]);
      await pool.query('DELETE FROM "PassportLifecycleEvent" WHERE "actorIdentityId" = ANY($1::uuid[])', [[creatorIdentityId, analystIdentityId].filter(Boolean)]);
      await pool.query('DELETE FROM "PlayerPassport" WHERE id = ANY($1::uuid[])', [passportIds]);
    }
    if (playerIds.length) {
      await pool.query('DELETE FROM "InitialTutorResponsibility" WHERE "playerId" = ANY($1::uuid[])', [playerIds]);
      await pool.query('DELETE FROM "PlayerPrivateIdentity" WHERE "playerId" = ANY($1::uuid[])', [playerIds]);
      await pool.query('DELETE FROM "Player" WHERE id = ANY($1::uuid[])', [playerIds]);
    }
    if (academyId) await pool.query('DELETE FROM "Academy" WHERE id = $1', [academyId]);
    const identityIds = [creatorIdentityId, analystIdentityId].filter(Boolean);
    if (identityIds.length) await pool.query('DELETE FROM "Identity" WHERE id = ANY($1::uuid[])', [identityIds]);
    await app.close();
    await pool.end();
  });

  it('persists the additive passport tables, profile columns, constraints, indexes, and immutable trace trigger', async () => {
    const tables = await pool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const tableNames = tables.rows.map((row) => row.table_name);
    for (const table of [
      'Player',
      'PlayerPrivateIdentity',
      'PlayerPassport',
      'InitialTutorResponsibility',
      'PassportReviewReturn',
      'PassportPossibleDuplicateSignal',
      'PassportLifecycleEvent',
      'PassportResponsibility',
      'RepresentativeConfirmation',
      'HistoricalTutorReconciliationAudit',
    ]) {
      expect(tableNames).toContain(table);
    }
    const correctiveColumns = await pool.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('Academy', 'RepresentativeConfirmation')",
    );
    const correctiveColumnNames = correctiveColumns.rows.map((row) => row.column_name);
    expect(correctiveColumnNames).toContain('displayName');
    expect(correctiveColumnNames).toContain('playerDocumentBinding');

    const columns = await pool.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlayerPassport'",
    );
    const columnNames = columns.rows.map((row) => row.column_name);
    for (const column of ['ageCategory', 'city', 'country', 'dominantFoot']) {
      expect(columnNames).toContain(column);
    }
    expect(columnNames.some((column) => column.toLowerCase().includes('photo'))).toBe(false);
    expect(columnNames.some((column) => column.toLowerCase().includes('media'))).toBe(false);

    const creator = await pool.query<{ id: string }>(
      "INSERT INTO \"Identity\" (status, \"updatedAt\") VALUES ('ACTIVE', CURRENT_TIMESTAMP) RETURNING id",
    );
    creatorIdentityId = creator.rows[0]!.id;
    const analyst = await pool.query<{ id: string }>(
      "INSERT INTO \"Identity\" (status, \"updatedAt\") VALUES ('ACTIVE', CURRENT_TIMESTAMP) RETURNING id",
    );
    analystIdentityId = analyst.rows[0]!.id;
    const academy = await pool.query<{ id: string }>('INSERT INTO "Academy" DEFAULT VALUES RETURNING id');
    academyId = academy.rows[0]!.id;

    const createPlayer = async (): Promise<string> => {
      const player = await pool.query<{ id: string }>('INSERT INTO "Player" (id, "updatedAt") VALUES (gen_random_uuid(), CURRENT_TIMESTAMP) RETURNING id');
      playerIds.push(player.rows[0]!.id);
      return player.rows[0]!.id;
    };

    const createPrivateIdentity = async (playerId: string, documentFingerprint: string, nameDobFingerprint: string): Promise<void> => {
      await pool.query(
        'INSERT INTO "PlayerPrivateIdentity" (id, "playerId", "encryptedLegalName", "encryptedDateOfBirth", "encryptedDocumentType", "encryptedDocumentNumber", "documentFingerprint", "nameDobFingerprint", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)',
        [playerId, 'enc-name', 'enc-dob', 'enc-type', 'enc-number', documentFingerprint, nameDobFingerprint],
      );
    };

    const playerA = await createPlayer();
    await createPrivateIdentity(playerA, 'doc-fingerprint-a', 'name-dob-fingerprint-a');
    const tutorPassport = await pool.query<{ id: string }>(
      "INSERT INTO \"PlayerPassport\" (id, \"playerId\", \"state\", \"originKind\", position, \"ageCategory\", city, country, \"dominantFoot\", \"createdByIdentityId\", \"updatedAt\") VALUES (gen_random_uuid(), $1, 'DRAFT', 'TUTOR', 'Delantero', 'Sub-15', 'Medellín', 'Colombia', 'LEFT', $2, CURRENT_TIMESTAMP) RETURNING id",
      [playerA, creatorIdentityId],
    );
    passportIds.push(tutorPassport.rows[0]!.id);

    const playerB = await createPlayer();
    await expect(createPrivateIdentity(playerB, 'doc-fingerprint-a', 'name-dob-fingerprint-b')).rejects.toMatchObject({ code: '23505' });

    const playerC = await createPlayer();
    await createPrivateIdentity(playerC, 'doc-fingerprint-c', 'name-dob-fingerprint-c');
    await expect(
      pool.query(
        "INSERT INTO \"PlayerPassport\" (id, \"playerId\", \"originKind\", position, \"ageCategory\", city, country, \"dominantFoot\", \"createdByIdentityId\", \"originAcademyId\", \"updatedAt\") VALUES (gen_random_uuid(), $1, 'TUTOR', 'Delantero', 'Sub-15', 'Medellín', 'Colombia', 'LEFT', $2, $3, CURRENT_TIMESTAMP)",
        [playerC, creatorIdentityId, academyId],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    const playerD = await createPlayer();
    await createPrivateIdentity(playerD, 'doc-fingerprint-d', 'name-dob-fingerprint-d');
    await expect(
      pool.query(
        "INSERT INTO \"PlayerPassport\" (id, \"playerId\", \"originKind\", position, \"ageCategory\", city, country, \"dominantFoot\", \"createdByIdentityId\", \"updatedAt\") VALUES (gen_random_uuid(), $1, 'ACADEMY', 'Delantero', 'Sub-15', 'Medellín', 'Colombia', 'LEFT', $2, CURRENT_TIMESTAMP)",
        [playerD, creatorIdentityId],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    const playerE = await createPlayer();
    await createPrivateIdentity(playerE, 'doc-fingerprint-e', 'name-dob-fingerprint-e');
    const academyPassport = await pool.query<{ id: string }>(
      "INSERT INTO \"PlayerPassport\" (id, \"playerId\", \"originKind\", position, \"ageCategory\", city, country, \"dominantFoot\", \"createdByIdentityId\", \"originAcademyId\", \"updatedAt\") VALUES (gen_random_uuid(), $1, 'ACADEMY', 'Delantero', 'Sub-15', 'Medellín', 'Colombia', 'RIGHT', $2, $3, CURRENT_TIMESTAMP) RETURNING id",
      [playerE, creatorIdentityId, academyId],
    );
    passportIds.push(academyPassport.rows[0]!.id);

    const indexes = await pool.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('PlayerPrivateIdentity', 'PlayerPassport', 'InitialTutorResponsibility', 'PassportLifecycleEvent')",
    );
    const indexNames = indexes.rows.map((row) => row.indexname);
    for (const index of [
      'PlayerPrivateIdentity_documentFingerprint_key',
      'PlayerPrivateIdentity_nameDobFingerprint_idx',
      'PlayerPassport_playerId_key',
      'PassportLifecycleEvent_passportId_createdAt_idx',
    ]) {
      expect(indexNames).toContain(index);
    }

    const eventClient = await pool.connect();
    try {
      await eventClient.query('BEGIN');
      await eventClient.query(
        "INSERT INTO \"PassportLifecycleEvent\" (id, \"passportId\", action, outcome, \"actorIdentityId\", \"priorState\", \"resultingState\") VALUES (gen_random_uuid(), $1, 'CREATED', 'APPLIED', $2, NULL, 'DRAFT')",
        [tutorPassport.rows[0]!.id, creatorIdentityId],
      );
      await eventClient.query('SAVEPOINT immutable_update');
      await expect(
        eventClient.query('UPDATE "PassportLifecycleEvent" SET outcome = \'DENIED\' WHERE "passportId" = $1', [tutorPassport.rows[0]!.id]),
      ).rejects.toMatchObject({ code: '55000' });
      await eventClient.query('ROLLBACK TO SAVEPOINT immutable_update');
      await eventClient.query('SAVEPOINT immutable_delete');
      await expect(
        eventClient.query('DELETE FROM "PassportLifecycleEvent" WHERE "passportId" = $1', [tutorPassport.rows[0]!.id]),
      ).rejects.toMatchObject({ code: '55000' });
      await eventClient.query('ROLLBACK');
    } finally {
      eventClient.release();
    }

    await request(app.getHttpServer()).get('/health/live').expect(200, { status: 'ok' });
    await request(app.getHttpServer()).get('/health/ready').expect(200, { status: 'ready' });
  });
});
