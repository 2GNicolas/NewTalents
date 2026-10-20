import { RequestMethod } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { GUARDS_METADATA, HEADERS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { AuthenticationGuard } from '../../src/authentication/authentication.guard.js';
import { AnalystMatchUploadAccessError } from '../../src/analyst-match-upload/application/analyst-match-upload-access.js';
import { AnalystMatchCapture } from '../../src/analyst-match-upload/application/analyst-match-capture.js';
import { ConfirmAnalystMatchUpload } from '../../src/analyst-match-upload/application/confirm-analyst-match-upload.js';
import { AnalystMatchUploadController } from '../../src/analyst-match-upload/http/analyst-match-upload.controller.js';

const id = '22222222-2222-4222-8222-222222222222';
const base = { matchId: id, sourceKind: 'FIRST_MATCH', passportId: id };

describe('Feature 011 capture GET contract', () => {
  it('contracts a private confirmed upload without treating it as an evaluation', () => {
    const contract = readFileSync(new URL('../../../../specs/011-analyst-match-analysis/contracts/analyst-match-upload.openapi.yaml', import.meta.url), 'utf8');
    expect(contract).toContain('enum: [AVAILABLE, CONFIRMED, UNAVAILABLE]');
    expect(contract).toContain('Present only while AVAILABLE');
    expect(contract).toContain("upload: { $ref: '#/components/schemas/ConfirmedUpload' }");
    expect(contract).toContain('required: [matchId, sourceKind, participation, totalMinutesPlayed, youtubeUrl, events, confirmedAt, outcome]');
    expect(contract).toContain('Backward-compatible private text for existing clients');
    expect(contract).toContain('GOAL and ASSIST, and any event with result FAILURE, require empty context');
  });
  it('is authenticated, read-only and no-store', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AnalystMatchUploadController)).toContain(AuthenticationGuard);
    const handler = AnalystMatchUploadController.prototype.capture;
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('matches/:matchId/capture');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
    expect(Object.getOwnPropertyNames(AnalystMatchUploadController.prototype)).toEqual(['constructor', 'capture', 'confirm']);
  });

  it('returns only bounded context and safe denials', async () => {
    const confirmed = { matchId: id, sourceKind: 'FIRST_MATCH', participation: 'PARTICIPATED',
      totalMinutesPlayed: 97, youtubeUrl: 'https://youtu.be/SyntheticVideo', confirmedAt: '2026-10-16T12:00:00.000Z',
      outcome: 'APPLIED', events: [{ sequence: 1, eventType: 'GOAL', result: 'NONE', videoMinute: '90+7',
        context: {}, complexity: {},
        observation: 'Observación sintética' }] };
    const capture = vi.fn().mockResolvedValueOnce({ ...base, availability: 'AVAILABLE', expectedVersion: 2 })
      .mockResolvedValueOnce({ ...base, availability: 'UNAVAILABLE' })
      .mockResolvedValueOnce({ ...base, availability: 'CONFIRMED', upload: confirmed });
    const module = await Test.createTestingModule({ controllers: [AnalystMatchUploadController], providers: [
      { provide: AnalystMatchCapture, useValue: { get: capture } },
      { provide: ConfirmAnalystMatchUpload, useValue: { confirm: vi.fn() } },
    ] }).overrideGuard(AuthenticationGuard).useValue({ canActivate: (context: { switchToHttp: () => { getRequest: () => Record<string, unknown> } }) => {
      context.switchToHttp().getRequest().actor = { identityId: id }; return true;
    } }).compile();
    const app = module.createNestApplication(); await app.init();
    try {
      const server = app.getHttpServer();
      const available = await request(server).get(`/analyst/workspace/matches/${id}/capture`).expect(200);
      expect(available.headers['cache-control']).toBe('no-store');
      expect(available.body).toEqual({ ...base, availability: 'AVAILABLE', expectedVersion: 2 });
      const unavailable = await request(server).get(`/analyst/workspace/matches/${id}/capture`).expect(200);
      expect(unavailable.body).toEqual({ ...base, availability: 'UNAVAILABLE' });
      expect(unavailable.body).not.toHaveProperty('expectedVersion');
      expect(unavailable.body).not.toHaveProperty('upload');
      const loaded = await request(server).get(`/analyst/workspace/matches/${id}/capture`).expect(200);
      expect(loaded.headers['cache-control']).toBe('no-store');
      expect(loaded.body).toEqual({ ...base, availability: 'CONFIRMED', upload: confirmed });
      expect(loaded.body).not.toHaveProperty('expectedVersion');
      expect(JSON.stringify(loaded.body)).not.toMatch(/rating|score|evaluation/i);
      expect(JSON.stringify(available.body)).not.toMatch(/unitState|playerName|youtubeUrl|events|rating/i);
      capture.mockRejectedValueOnce(new AnalystMatchUploadAccessError('NOT_FOUND'));
      const foreign = await request(server).get(`/analyst/workspace/matches/${id}/capture`).expect(404);
      capture.mockRejectedValueOnce(new AnalystMatchUploadAccessError('NOT_FOUND'));
      const missing = await request(server).get(`/analyst/workspace/matches/33333333-3333-4333-8333-333333333333/capture`).expect(404);
      expect(foreign.body).toEqual({ code: 'not_found' });
      expect(missing.body).toEqual(foreign.body);
      expect(foreign.headers['cache-control']).toBe('no-store');
      expect((await request(server).get('/analyst/workspace/matches/invalid/capture').expect(404)).body).toEqual(foreign.body);
      capture.mockRejectedValueOnce(new AnalystMatchUploadAccessError('FORBIDDEN'));
      const forbidden = await request(server).get(`/analyst/workspace/matches/${id}/capture`).expect(403);
      expect(forbidden.body).toEqual({ code: 'forbidden' });
      expect(forbidden.headers['cache-control']).toBe('no-store');
      capture.mockRejectedValueOnce(new Error('internal fixture failure'));
      const failure = await request(server).get(`/analyst/workspace/matches/${id}/capture`).expect(503);
      expect(failure.body).toEqual({ code: 'unavailable' });
      expect(failure.headers['cache-control']).toBe('no-store');
      expect(await request(server).post(`/analyst/workspace/matches/${id}/capture/confirm`).send({}).then((r: { status: number }) => r.status)).toBe(400);
    } finally { await app.close(); }
  });

  it('keeps a rejected session response minimal and uncached', async () => {
    const module = await Test.createTestingModule({ controllers: [AnalystMatchUploadController], providers: [
      { provide: AnalystMatchCapture, useValue: { get: vi.fn() } },
      { provide: ConfirmAnalystMatchUpload, useValue: { confirm: vi.fn() } },
    ] }).overrideGuard(AuthenticationGuard).useValue({ canActivate: () => false }).compile();
    const app = module.createNestApplication(); await app.init();
    try {
      const response = await request(app.getHttpServer()).get(`/analyst/workspace/matches/${id}/capture`).expect(401);
      expect(response.body).toEqual({ code: 'unauthenticated' });
      expect(response.headers['cache-control']).toBe('no-store');
    } finally { await app.close(); }
  });
});
