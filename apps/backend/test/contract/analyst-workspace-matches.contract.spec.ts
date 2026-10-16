import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, HEADERS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { AuthenticationGuard } from '../../src/authentication/authentication.guard.js';
import { AnalystWorkspaceAccessError } from '../../src/analyst-workspace/application/analyst-workspace-access.js';
import { AnalystMatches } from '../../src/analyst-workspace/application/analyst-matches.js';
import { AnalystOverview } from '../../src/analyst-workspace/application/analyst-overview.js';
import { AnalystPassports } from '../../src/analyst-workspace/application/analyst-passports.js';
import { AnalystWorkspaceController } from '../../src/analyst-workspace/http/analyst-workspace.controller.js';

const id = '22222222-2222-4222-8222-222222222222';
const match = { id, sourceKind: 'FIRST_MATCH', passportId: id, maskedReference: 'PAS-2222',
  playerName: 'Jugadora sintética', matchDate: '2026-10-18', matchTime: '10:00', opponent: 'Rival',
  competition: 'Liga', venue: 'Cancha', state: 'WAITING' };

describe('Feature 010 match HTTP contract', () => {
  it('exposes only guarded no-store match GETs', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AnalystWorkspaceController)).toContain(AuthenticationGuard);
    for (const [method, path] of [['matches', 'matches'], ['match', 'matches/:matchId']] as const) {
      expect(Reflect.getMetadata(PATH_METADATA, AnalystWorkspaceController.prototype[method])).toBe(path);
      expect(Reflect.getMetadata(METHOD_METADATA, AnalystWorkspaceController.prototype[method])).toBe(RequestMethod.GET);
      expect(Reflect.getMetadata(HEADERS_METADATA, AnalystWorkspaceController.prototype[method]))
        .toContainEqual({ name: 'Cache-Control', value: 'no-store' });
    }
  });

  it('returns bounded pages, minimal detail and indistinguishable missing/foreign IDs', async () => {
    const query = { list: vi.fn().mockResolvedValue({ data: [match], pagination: { hasMore: false } }),
      detail: vi.fn().mockResolvedValue(match) };
    const module = await Test.createTestingModule({ controllers: [AnalystWorkspaceController], providers: [
      { provide: AnalystOverview, useValue: { get: vi.fn() } }, { provide: AnalystPassports, useValue: { list: vi.fn(), detail: vi.fn() } },
      { provide: AnalystMatches, useValue: query },
    ] }).overrideGuard(AuthenticationGuard).useValue({ canActivate: (context: { switchToHttp: () => { getRequest: () => Record<string, unknown> } }) => {
      context.switchToHttp().getRequest().actor = { identityId: id }; return true;
    } }).compile();
    const app = module.createNestApplication(); await app.init();
    try {
      const server = app.getHttpServer();
      const page = await request(server).get('/analyst/workspace/matches').expect(200);
      expect(page.headers['cache-control']).toBe('no-store');
      expect(page.body).toEqual({ data: [match], pagination: { hasMore: false } });
      expect(query.list).toHaveBeenCalledWith(id, { limit: 20 });
      const detail = await request(server).get(`/analyst/workspace/matches/${id}`).expect(200);
      expect(detail.body).toEqual(match);
      expect(JSON.stringify(detail.body)).not.toMatch(/contact|phone|email|document|unitState|loadedAt|metric/i);
      for (const suffix of ['?limit=0', '?limit=51', '?cursor=invalid']) {
        const invalid = await request(server).get(`/analyst/workspace/matches${suffix}`).expect(400);
        expect(invalid.body).toEqual({ code: 'invalid_query' });
        expect(invalid.headers['cache-control']).toBe('no-store');
      }
      query.detail.mockRejectedValueOnce(new AnalystWorkspaceAccessError('NOT_FOUND'));
      const foreign = await request(server).get(`/analyst/workspace/matches/${id}`).expect(404);
      query.detail.mockRejectedValueOnce(new AnalystWorkspaceAccessError('NOT_FOUND'));
      const absent = await request(server).get('/analyst/workspace/matches/33333333-3333-4333-8333-333333333333').expect(404);
      expect(foreign.body).toEqual({ code: 'not_found' });
      expect(absent.body).toEqual(foreign.body);
      expect(await request(server).post('/analyst/workspace/matches').send({}).then((r: { status: number }) => r.status)).toBe(404);
    } finally { await app.close(); }
  });
});
