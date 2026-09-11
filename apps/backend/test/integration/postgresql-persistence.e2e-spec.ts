import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

describe('PostgreSQL named-volume persistence', () => {
  it('retains an isolated technical marker across normal stop/start and always removes it', async () => {
    const source = new URL(process.env.DATABASE_URL!);
    const databaseName = `nt_persistence_${process.pid}`;
    const tableName = `probe_${Date.now()}`;
    const adminUrl = new URL(source); adminUrl.pathname = '/postgres';
    const testUrl = new URL(source); testUrl.pathname = `/${databaseName}`;
    const admin = new Pool({ connectionString: adminUrl.toString() });
    admin.on('error', () => undefined);
    let testPool: Pool | undefined;
    try {
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      testPool = new Pool({ connectionString: testUrl.toString() });
      testPool.on('error', () => undefined);
      await testPool.query(`CREATE TABLE "${tableName}" (marker text NOT NULL)`);
      await testPool.query(`INSERT INTO "${tableName}" (marker) VALUES ($1)`, ['volume-persistence-probe']);
      await testPool.end(); testPool = undefined;
      execFileSync('docker', ['stop', 'new-talents-postgres'], { stdio: 'ignore' });
      execFileSync('docker', ['start', 'new-talents-postgres'], { stdio: 'ignore' });
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      testPool = new Pool({ connectionString: testUrl.toString() });
      testPool.on('error', () => undefined);
      const result = await testPool.query<{ marker: string }>(`SELECT marker FROM "${tableName}"`);
      expect(result.rows).toEqual([{ marker: 'volume-persistence-probe' }]);
    } finally {
      await testPool?.query(`DROP TABLE IF EXISTS "${tableName}"`);
      await testPool?.end();
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [databaseName]);
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      const absence = await admin.query<{ count: string }>('SELECT count(*) FROM pg_database WHERE datname = $1', [databaseName]);
      expect(absence.rows[0]?.count).toBe('0');
      await admin.end();
    }
  }, 30_000);
});
