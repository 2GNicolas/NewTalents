import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

import { createApplication } from '../../src/main.js';

describe('Feature 003 HTTP surface', () => {
  let application: INestApplication | undefined;
  afterEach(async () => { await application?.close(); application = undefined; });

  it('exposes only the approved authentication operations while health remains public', async () => {
    application = await createApplication({ logger: false });
    await application.init();
    const server = application.getHttpServer();
    await request(server).get('/health/live').expect(200);
    await request(server).get('/health/ready').expect(200);
    await request(server).post('/auth/login').send({}).expect(401);
    await request(server).post('/auth/refresh').send({}).expect(401);
    await request(server).post('/auth/initial-credential/replace').send({}).expect(401);
    await request(server).post('/auth/logout').send({}).expect(403);
    await request(server).post('/auth/logout-all').send({}).expect(403);
    await request(server).post('/auth/credentials/provision').send({}).expect(403);
    await request(server).post('/auth/credentials/reissue').send({}).expect(403);
    await request(server).post('/auth/administrator/recover').send({}).expect(404);
  });
});
