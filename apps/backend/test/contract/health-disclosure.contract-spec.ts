import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';

import { createHealthTestApplication } from './liveness.contract-spec.js';

describe('health disclosure safety', () => {
  let app: INestApplication | undefined;
  afterEach(async () => app?.close());

  it('does not expose failure internals', async () => {
    const sensitive = 'postgresql://private-user:private-password@secret-host:5432/private-db SELECT 1';
    app = await createHealthTestApplication(vi.fn().mockRejectedValue(new Error(sensitive)));
    const response = await request(app.getHttpServer()).get('/health/ready').expect(503);
    const serialized = JSON.stringify({ body: response.body, headers: response.headers }).toLowerCase();
    for (const fragment of ['private-user', 'private-password', 'secret-host', 'select 1', 'stack', 'prisma']) {
      expect(serialized).not.toContain(fragment);
    }
  });
});
