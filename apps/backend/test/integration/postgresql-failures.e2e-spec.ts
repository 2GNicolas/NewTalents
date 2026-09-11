import { execFileSync } from 'node:child_process';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';

import { createApplication } from '../../src/main.js';

async function waitForPostgres(): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const health = execFileSync('docker', ['inspect', '--format', '{{.State.Health.Status}}', 'new-talents-postgres'], { encoding: 'utf8' }).trim();
      if (health === 'healthy') return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('PostgreSQL did not become healthy after state restoration');
}

describe('real PostgreSQL readiness failures', () => {
  let app: INestApplication | undefined;
  const originalUrl = process.env.DATABASE_URL;

  afterEach(async () => {
    try { execFileSync('docker', ['unpause', 'new-talents-postgres'], { stdio: 'ignore' }); } catch {}
    try { execFileSync('docker', ['start', 'new-talents-postgres'], { stdio: 'ignore' }); } catch {}
    await waitForPostgres();
    await app?.close();
    app = undefined;
    process.env.DATABASE_URL = originalUrl;
  });

  it.each([
    ['rejected credentials', 'postgresql://new_talents_local:wrong-password@localhost:5433/new_talents_local'],
    ['refused connection', 'postgresql://new_talents_local:any-password@127.0.0.1:65432/new_talents_local'],
  ])('normalizes %s to 503 within 15 seconds', async (_case, url) => {
    process.env.DATABASE_URL = url;
    app = await createApplication({ logger: false });
    await app.init();
    const started = Date.now();
    await request(app.getHttpServer()).get('/health/ready').expect(503, { status: 'unavailable' });
    expect(Date.now() - started).toBeLessThan(15_000);
  });

  it('keeps liveness healthy while PostgreSQL is stopped', async () => {
    app = await createApplication({ logger: false });
    await app.init();
    execFileSync('docker', ['stop', 'new-talents-postgres'], { stdio: 'ignore' });
    await request(app.getHttpServer()).get('/health/live').expect(200, { status: 'ok' });
    await request(app.getHttpServer()).get('/health/ready').expect(503, { status: 'unavailable' });
  });

  it('bounds a real-container stalled connection to five seconds', async () => {
    app = await createApplication({ logger: false });
    await app.init();
    await request(app.getHttpServer()).get('/health/ready').expect(200);
    execFileSync('docker', ['pause', 'new-talents-postgres'], { stdio: 'ignore' });
    const started = Date.now();
    await request(app.getHttpServer()).get('/health/ready').expect(503, { status: 'unavailable' });
    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(4_900);
    expect(elapsed).toBeLessThan(15_000);
  }, 20_000);
});
