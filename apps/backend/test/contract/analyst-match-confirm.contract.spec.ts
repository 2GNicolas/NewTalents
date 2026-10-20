import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { RequestMethod } from '@nestjs/common';
import { HEADERS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { AuthenticationGuard } from '../../src/authentication/authentication.guard.js';
import { AnalystMatchCapture } from '../../src/analyst-match-upload/application/analyst-match-capture.js';
import { ConfirmAnalystMatchUpload } from '../../src/analyst-match-upload/application/confirm-analyst-match-upload.js';
import { ConfirmAnalystMatchUploadError } from '../../src/analyst-match-upload/application/confirm-analyst-match-upload.js';
import { ConfirmUploadValidationError } from '../../src/analyst-match-upload/domain/confirm-upload-validation.js';
import { AnalystMatchUploadController } from '../../src/analyst-match-upload/http/analyst-match-upload.controller.js';

const matchId = randomUUID();
const actorId = randomUUID();
const valid = { expectedVersion: 1, participation: 'DID_NOT_PARTICIPATE', totalMinutesPlayed: 0,
  youtubeUrl: 'https://youtu.be/Feature011TestVideo', events: [] };

describe('Feature 011 final confirmation HTTP contract', () => {
  it('documents private final-only POST with bounded URL, optional observation and safe statuses', () => {
    const yaml = readFileSync(new URL('../../../../specs/011-analyst-match-analysis/contracts/analyst-match-upload.openapi.yaml', import.meta.url), 'utf8');
    expect(yaml).toContain('/analyst/workspace/matches/{matchId}/capture/confirm:');
    expect(yaml).toContain('Idempotency-Key');
    expect(yaml).toContain('maxLength: 2048');
    expect(yaml).toContain('observation:');
    expect(yaml).toContain('required: [code]');
    expect(yaml).not.toContain('required: [code, message]');
    for (const status of ['400', '401', '403', '404', '409', '422', '503']) expect(yaml).toContain(`'${status}'`);
    expect(yaml).not.toContain('/save-event:');
  });

  it('maps the final control to one authenticated no-store POST, not a local-save route', () => {
    const handler = AnalystMatchUploadController.prototype.confirm;
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('matches/:matchId/capture/confirm');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
    expect(Object.getOwnPropertyNames(AnalystMatchUploadController.prototype))
      .toEqual(['constructor', 'capture', 'confirm']);
  });

  it('passes only actor, match, UUID intention and body; returns minimal validation failures', async () => {
    const confirm = vi.fn().mockResolvedValue({ matchId, sourceKind: 'FIRST_MATCH', participation: 'DID_NOT_PARTICIPATE',
      totalMinutesPlayed: 0, youtubeUrl: valid.youtubeUrl, events: [], confirmedAt: new Date().toISOString(), outcome: 'APPLIED' });
    const module = await Test.createTestingModule({ controllers: [AnalystMatchUploadController], providers: [
      { provide: AnalystMatchCapture, useValue: { get: vi.fn() } },
      { provide: ConfirmAnalystMatchUpload, useValue: { confirm } },
    ] }).overrideGuard(AuthenticationGuard).useValue({ canActivate: (context: { switchToHttp: () => { getRequest: () => Record<string, unknown> } }) => {
      context.switchToHttp().getRequest().actor = { identityId: actorId }; return true;
    } }).compile();
    const app = module.createNestApplication(); await app.init();
    try {
      const key = randomUUID();
      const applied = await request(app.getHttpServer()).post(`/analyst/workspace/matches/${matchId}/capture/confirm`)
        .set('Idempotency-Key', key).send(valid).expect(200);
      expect(applied.headers['cache-control']).toBe('no-store');
      expect(confirm).toHaveBeenCalledWith(actorId, matchId, key, valid);
      expect(applied.body.outcome).toBe('APPLIED');
      for (const header of ['', 'not-a-uuid']) {
        const response = await request(app.getHttpServer()).post(`/analyst/workspace/matches/${matchId}/capture/confirm`)
          .set('Idempotency-Key', header).send(valid).expect(400);
        expect(response.body).toEqual({ code: 'invalid_request' });
        expect(response.headers['cache-control']).toBe('no-store');
      }
      expect(confirm).toHaveBeenCalledTimes(1);
      for (const [failure, status, code] of [
        [new ConfirmUploadValidationError(), 422, 'validation_failed'],
        [new ConfirmAnalystMatchUploadError('CONFLICT'), 409, 'conflict'],
        [new ConfirmAnalystMatchUploadError('FORBIDDEN'), 403, 'forbidden'],
        [new ConfirmAnalystMatchUploadError('NOT_FOUND'), 404, 'not_found'],
        [new Error('synthetic'), 503, 'unavailable'],
      ] as const) {
        confirm.mockRejectedValueOnce(failure);
        const response = await request(app.getHttpServer()).post(`/analyst/workspace/matches/${matchId}/capture/confirm`)
          .set('Idempotency-Key', randomUUID()).send(valid).expect(status);
        expect(response.body).toEqual({ code });
        expect(response.headers['cache-control']).toBe('no-store');
        expect(JSON.stringify(response.body)).not.toContain(valid.youtubeUrl);
      }
    } finally { await app.close(); }
  });

  it('requires a session for the POST without exposing submitted video data', async () => {
    const module = await Test.createTestingModule({ controllers: [AnalystMatchUploadController], providers: [
      { provide: AnalystMatchCapture, useValue: { get: vi.fn() } },
      { provide: ConfirmAnalystMatchUpload, useValue: { confirm: vi.fn() } },
    ] }).overrideGuard(AuthenticationGuard).useValue({ canActivate: () => false }).compile();
    const app = module.createNestApplication(); await app.init();
    try {
      const response = await request(app.getHttpServer()).post(`/analyst/workspace/matches/${matchId}/capture/confirm`)
        .set('Idempotency-Key', randomUUID()).send(valid).expect(401);
      expect(response.body).toEqual({ code: 'unauthenticated' });
      expect(response.headers['cache-control']).toBe('no-store');
    } finally { await app.close(); }
  });
});
