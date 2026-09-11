import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

import { createApplication } from '../../src/main.js';

describe('backend bootstrap', () => {
  let application: INestApplication | undefined;

  afterEach(async () => {
    await application?.close();
    application = undefined;
  });

  it('starts a listener and exposes no business route', async () => {
    application = await createApplication({ logger: false });
    await application.listen(0, '127.0.0.1');

    await request(application.getHttpServer()).get('/users').expect(404);
    expect(application.getHttpServer().listening).toBe(true);

    await application.close();
    expect(application.getHttpServer().listening).toBe(false);
    application = undefined;
  });

  it('fails before listening when configuration is invalid', async () => {
    const originalPort = process.env.PORT;
    process.env.PORT = '__REQUIRED__';
    try {
      await expect(createApplication({ logger: false })).rejects.toThrow('PORT');
    } finally {
      process.env.PORT = originalPort;
    }
  });
});
