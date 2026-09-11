import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';

import { createHealthTestApplication } from './liveness.contract-spec.js';

describe('GET /health/ready contract', () => {
  let app: INestApplication | undefined;
  afterEach(async () => app?.close());

  it.each([
    [{ status: 'ready' }, 200],
    [{ status: 'unavailable' }, 503],
  ] as const)('returns a closed %s response with HTTP %i', async (outcome, status) => {
    app = await createHealthTestApplication(vi.fn().mockResolvedValue(outcome));
    const response = await request(app.getHttpServer()).get('/health/ready').expect(status);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual(outcome);
    expect(Object.keys(response.body)).toEqual(['status']);
  });

  it('normalizes unexpected failures without an HTTP 500', async () => {
    app = await createHealthTestApplication(vi.fn().mockRejectedValue(new Error('secret raw detail')));
    await request(app.getHttpServer()).get('/health/ready').expect(503, { status: 'unavailable' });
  });
});
