import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Feature 006 lifecycle idempotency persistence', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  beforeAll(async () => { await pool.query('SELECT 1'); });
  afterAll(async () => { await pool.end(); });

  it('has an additive JSONB snapshot, request/action/key uniqueness and immutable records', async () => {
    const columns = await pool.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegistrationRequestIdempotencyRecord'`,
    );
    expect(columns.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ column_name: 'requestId' }),
      expect.objectContaining({ column_name: 'action' }),
      expect.objectContaining({ column_name: 'idempotencyKey' }),
      expect.objectContaining({ column_name: 'resultSnapshot', data_type: 'jsonb' }),
    ]));
    const indexes = await pool.query<{ indexdef: string }>(`SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'RegistrationRequestIdempotencyRecord'`);
    expect(indexes.rows.map((row) => row.indexdef).join('\n')).toContain('UNIQUE');
    expect(indexes.rows.map((row) => row.indexdef).join('\n')).toContain('"requestId", action, "idempotencyKey"');
    const triggers = await pool.query<{ trigger_name: string }>(`SELECT trigger_name FROM information_schema.triggers WHERE event_object_schema = 'public' AND event_object_table = 'RegistrationRequestIdempotencyRecord'`);
    expect(triggers.rows.map((row) => row.trigger_name)).toContain('registration_request_idempotency_records_immutable');
  });
});
