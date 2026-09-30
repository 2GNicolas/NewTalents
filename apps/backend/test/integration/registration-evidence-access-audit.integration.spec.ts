import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Feature 006 evidence access audit persistence', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  beforeAll(async () => { await pool.query('SELECT 1'); });
  afterAll(async () => { await pool.end(); });

  it('keeps an additive dedicated immutable audit table separate from lifecycle events', async () => {
    const columns = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegistrationEvidenceAccessAudit' ORDER BY column_name`,
    );
    expect(columns.rows.map((row) => row.column_name)).toEqual(expect.arrayContaining([
      'id', 'requestId', 'evidenceItemId', 'actorIdentityId', 'category', 'outcome', 'createdAt',
    ]));
    expect(columns.rows.map((row) => row.column_name)).not.toEqual(expect.arrayContaining(['priorStatus', 'resultingStatus', 'requestVersion']));

    const trigger = await pool.query<{ trigger_name: string }>(
      `SELECT trigger_name FROM information_schema.triggers WHERE event_object_schema = 'public' AND event_object_table = 'RegistrationEvidenceAccessAudit'`,
    );
    expect(trigger.rows.map((row) => row.trigger_name)).toContain('registration_evidence_access_audits_immutable');
  });
});
