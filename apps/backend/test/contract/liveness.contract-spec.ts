import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';

import { DatabaseReadinessService } from '../../src/database/database-readiness.service.js';
import { HealthExceptionFilter } from '../../src/health/health-exception.filter.js';
import { HealthResponseInterceptor } from '../../src/health/health-response.interceptor.js';
import { LivenessController } from '../../src/health/liveness.controller.js';
import { ReadinessController } from '../../src/health/readiness.controller.js';
import { ReadinessService } from '../../src/health/readiness.service.js';

type DatabaseCheck = () => Promise<{ status: 'ready' | 'unavailable' }>;

export async function createHealthTestApplication(
  databaseCheck: DatabaseCheck = vi.fn().mockResolvedValue({ status: 'ready' }),
): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    controllers: [LivenessController, ReadinessController],
    providers: [ReadinessService, { provide: DatabaseReadinessService, useValue: { check: databaseCheck } }],
  }).compile();
  const app = module.createNestApplication();
  app.useGlobalInterceptors(new HealthResponseInterceptor());
  app.useGlobalFilters(new HealthExceptionFilter());
  await app.init();
  return app;
}

describe('GET /health/live contract', () => {
  let app: INestApplication | undefined;
  afterEach(async () => app?.close());

  it('returns the exact process-only response without querying the database', async () => {
    const databaseCheck = vi.fn();
    app = await createHealthTestApplication(databaseCheck);
    const response = await request(app.getHttpServer()).get('/health/live').expect(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ status: 'ok' });
    expect(Object.keys(response.body)).toEqual(['status']);
    expect(databaseCheck).not.toHaveBeenCalled();
  });
});
