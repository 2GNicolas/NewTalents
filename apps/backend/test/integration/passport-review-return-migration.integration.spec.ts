import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

describe('PassportReviewReturn actor rename migration', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  afterAll(async () => { await pool.end(); });

  it('preserves an existing return and its restrictive identity reference', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Reconstruct the immediately preceding column shape inside this isolated transaction.
      await client.query('ALTER TABLE "PassportReviewReturn" RENAME COLUMN "reviewerIdentityId" TO "analystIdentityId"');
      await client.query('ALTER TABLE "PassportReviewReturn" RENAME CONSTRAINT "PassportReviewReturn_reviewerIdentityId_fkey" TO "PassportReviewReturn_analystIdentityId_fkey"');

      const actor = await client.query<{ id: string }>(
        'INSERT INTO "Identity" (status, "updatedAt") VALUES (\'ACTIVE\', CURRENT_TIMESTAMP) RETURNING id',
      );
      const player = await client.query<{ id: string }>(
        'INSERT INTO "Player" (id, "updatedAt") VALUES (gen_random_uuid(), CURRENT_TIMESTAMP) RETURNING id',
      );
      const passport = await client.query<{ id: string }>(
        'INSERT INTO "PlayerPassport" (id, "playerId", "state", "originKind", position, "ageCategory", city, country, "dominantFoot", "createdByIdentityId", "updatedAt") VALUES (gen_random_uuid(), $1, \'IN_REVIEW\', \'TUTOR\', \'Delantero\', \'Sub-15\', \'Bogotá\', \'Colombia\', \'LEFT\', $2, CURRENT_TIMESTAMP) RETURNING id',
        [player.rows[0]!.id, actor.rows[0]!.id],
      );
      const prior = await client.query<{ id: string }>(
        'INSERT INTO "PassportReviewReturn" (id, "passportId", "analystIdentityId", reason) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id',
        [passport.rows[0]!.id, actor.rows[0]!.id, 'Corregir datos declarados'],
      );

      const migration = await readFile(
        new URL('../../prisma/migrations/20261014090000_passport_review_return_reviewer/migration.sql', import.meta.url),
        'utf8',
      );
      await client.query(migration);

      const preserved = await client.query<{ id: string; reviewerIdentityId: string; reason: string }>(
        'SELECT id, "reviewerIdentityId", reason FROM "PassportReviewReturn" WHERE id = $1',
        [prior.rows[0]!.id],
      );
      expect(preserved.rows).toEqual([{
        id: prior.rows[0]!.id,
        reviewerIdentityId: actor.rows[0]!.id,
        reason: 'Corregir datos declarados',
      }]);
      const columns = await client.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'PassportReviewReturn' AND column_name IN ('analystIdentityId', 'reviewerIdentityId')",
      );
      expect(columns.rows.map((row) => row.column_name)).toEqual(['reviewerIdentityId']);
      const constraints = await client.query<{ conname: string }>(
        'SELECT conname FROM pg_constraint WHERE conrelid = \'"PassportReviewReturn"\'::regclass AND conname LIKE \'PassportReviewReturn_%IdentityId_fkey\'',
      );
      expect(constraints.rows.map((row) => row.conname)).toEqual(['PassportReviewReturn_reviewerIdentityId_fkey']);

      await client.query('SAVEPOINT invalid_reviewer');
      await expect(client.query(
        'INSERT INTO "PassportReviewReturn" (id, "passportId", "reviewerIdentityId", reason) VALUES (gen_random_uuid(), $1, gen_random_uuid(), $2)',
        [passport.rows[0]!.id, 'Actor inexistente'],
      )).rejects.toMatchObject({ code: '23503' });
      await client.query('ROLLBACK TO SAVEPOINT invalid_reviewer');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
