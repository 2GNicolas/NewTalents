import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';

import { createApplication } from '../../src/main.js';

describe('backend health timing', () => {
  let app: INestApplication;
  beforeAll(async () => { app = await createApplication({ logger: false }); await app.init(); });
  afterAll(async () => app.close());
  it('observes liveness within ten seconds after the running state', async () => {
    const started = Date.now();
    await request(app.getHttpServer()).get('/health/live').expect(200, { status: 'ok' });
    expect(Date.now() - started).toBeLessThan(10_000);
  });
});
