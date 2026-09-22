import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

describe('Feature 005 corrective persistence contract', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://test:test@127.0.0.1:5433/new_talents_test' });
  afterAll(() => pool.end());
  it('exposes USER/PARTICULAR and corrective responsibility tables without removing TUTOR', async () => {
    const enums = await pool.query<{ typname: string; enumlabel: string }>("SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname IN ('FunctionalRole','PassportOrigin')");
    expect(enums.rows).toEqual(expect.arrayContaining([{ typname: 'FunctionalRole', enumlabel: 'USER' }, { typname: 'PassportOrigin', enumlabel: 'PARTICULAR' }, { typname: 'PassportOrigin', enumlabel: 'TUTOR' }]));
    const tables = await pool.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('PassportResponsibility','RepresentativeConfirmation','HistoricalTutorReconciliationAudit')");
    expect(tables.rows.map((row) => row.table_name)).toEqual(expect.arrayContaining(['PassportResponsibility', 'RepresentativeConfirmation', 'HistoricalTutorReconciliationAudit']));
  });

  it('persists responsibility cardinality and one SELF passport per identity constraints', async () => {
    const indexes = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'PassportResponsibility'`,
    );
    expect(indexes.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ indexname: 'PassportResponsibility_passportId_kind_identityId_key' }),
      expect.objectContaining({
        indexname: 'PassportResponsibility_one_self_per_identity',
        indexdef: expect.stringMatching(/UNIQUE.*identityId.*kind.*SELF/i),
      }),
      expect.objectContaining({ indexname: 'PassportResponsibility_academyId_kind_idx' }),
    ]));
  });

  it('persists single-use representative-confirmation state and binding evidence', async () => {
    const columns = await pool.query<{ column_name: string; is_nullable: string }>(
      `SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'RepresentativeConfirmation'`,
    );
    expect(columns.rows).toEqual(expect.arrayContaining([
      { column_name: 'status', is_nullable: 'NO' },
      { column_name: 'consumedAt', is_nullable: 'YES' },
      { column_name: 'expiresAt', is_nullable: 'NO' },
      { column_name: 'playerDocumentBinding', is_nullable: 'NO' },
      { column_name: 'representativeIdentityId', is_nullable: 'NO' },
    ]));
  });

  it('keeps historical TUTOR facts interpretable alongside additive reconciliation audit', async () => {
    const tutorStructures = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('InitialTutorResponsibility', 'HistoricalTutorReconciliationAudit')`,
    );
    expect(tutorStructures.rows.map((row) => row.table_name)).toEqual(expect.arrayContaining([
      'InitialTutorResponsibility',
      'HistoricalTutorReconciliationAudit',
    ]));
  });
});
