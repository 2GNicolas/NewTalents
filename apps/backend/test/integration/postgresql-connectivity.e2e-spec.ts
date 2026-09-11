import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';

import { createApplication } from '../../src/main.js';

describe('PostgreSQL connectivity', () => {
  let app: INestApplication;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  beforeAll(async () => { app = await createApplication({ logger: false }); await app.init(); });
  afterAll(async () => { await app.close(); await pool.end(); });

  it('proves authenticated SELECT 1 readiness without creating tables', async () => {
    const tableCount = async () => Number((await pool.query<{ count: string }>("SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')")).rows[0]?.count);
    const before = await tableCount();
    await request(app.getHttpServer()).get('/health/ready').expect(200, { status: 'ready' });
    expect(await tableCount()).toBe(before);
  });
});
