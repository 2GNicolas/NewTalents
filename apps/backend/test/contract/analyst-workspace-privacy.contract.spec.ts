import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { AuthenticationGuard } from '../../src/authentication/authentication.guard.js';
import { AnalystWorkspaceAccessError } from '../../src/analyst-workspace/application/analyst-workspace-access.js';
import { AnalystMatches } from '../../src/analyst-workspace/application/analyst-matches.js';
import { AnalystOverview } from '../../src/analyst-workspace/application/analyst-overview.js';
import { AnalystPassports } from '../../src/analyst-workspace/application/analyst-passports.js';
import { AnalystWorkspaceController } from '../../src/analyst-workspace/http/analyst-workspace.controller.js';

const actor = '11111111-1111-4111-8111-111111111111';
const passportId = '22222222-2222-4222-8222-222222222222';
const matchId = '33333333-3333-4333-8333-333333333333';
const card = { passportId, maskedReference: 'PAS-2222', playerName: 'Jugador sintético',
  lifecycleState: 'ACTIVE', custodyState: 'ASSIGNED_TO_ACTOR' };
const match = { id: matchId, sourceKind: 'FIRST_MATCH', passportId, maskedReference: 'PAS-2222',
  playerName: card.playerName, matchDate: '2026-10-15', matchTime: '10:00', opponent: 'Rival',
  competition: 'Liga', venue: 'Cancha', state: 'WAITING' };
const overview = { timeZone: 'America/Bogota', analystLabel: 'Analista sintético',
  pending: { availability: 'AVAILABLE', data: [match], hasMore: false },
  upcoming: { availability: 'AVAILABLE', data: [], hasMore: false }, completed: { availability: 'UNAVAILABLE' } };

describe('Feature 010 cross-route privacy contract', () => {
  it('guards every workspace GET and exposes no workspace write method', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AnalystWorkspaceController)).toContain(AuthenticationGuard);
    for (const method of ['overview', 'passports', 'passport', 'matches', 'match'] as const) {
      expect(Reflect.getMetadata(METHOD_METADATA, AnalystWorkspaceController.prototype[method])).toBe(RequestMethod.GET);
    }
  });

  it('minimizes every success body and every error across routes', async () => {
    let authenticated = true;
    const overviewQuery = { get: vi.fn().mockResolvedValue(overview) };
    const passportQuery = { list: vi.fn().mockResolvedValue({ data: [card], pagination: { hasMore: false } }),
      detail: vi.fn().mockResolvedValue({ ...card, contact: { availability: 'AVAILABLE', kind: 'SELF', email: 'adult@example.test' } }) };
    const matchQuery = { list: vi.fn().mockResolvedValue({ data: [match], pagination: { hasMore: false } }),
      detail: vi.fn().mockResolvedValue(match) };
    const module = await Test.createTestingModule({ controllers: [AnalystWorkspaceController], providers: [
      { provide: AnalystOverview, useValue: overviewQuery }, { provide: AnalystPassports, useValue: passportQuery },
      { provide: AnalystMatches, useValue: matchQuery },
    ] }).overrideGuard(AuthenticationGuard).useValue({ canActivate: (context: { switchToHttp: () => { getRequest: () => Record<string, unknown> } }) => {
      if (!authenticated) return false;
      context.switchToHttp().getRequest().actor = { identityId: actor }; return true;
    } }).compile();
    const app = module.createNestApplication(); await app.init();
    try {
      const server = app.getHttpServer();
      const paths = ['/analyst/workspace/overview', '/analyst/workspace/passports', `/analyst/workspace/passports/${passportId}`,
        '/analyst/workspace/matches', `/analyst/workspace/matches/${matchId}`];
      for (const path of paths) {
        const response = await request(server).get(path).expect(200);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(JSON.stringify(response.body)).not.toMatch(/document|birth|evidence|encrypted|unitState|loadId|scheduledByIdentityId|loadedByAnalystIdentityId|matchLimit|metrics|drafts|history/i);
        if (path !== `/analyst/workspace/passports/${passportId}`) expect(JSON.stringify(response.body)).not.toMatch(/adult@example\.test|"contact"/);
      }
      authenticated = false;
      for (const path of paths) {
        const response = await request(server).get(path).expect(401);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.body).toEqual({ code: 'unauthenticated' });
      }
      authenticated = true;
      overviewQuery.get.mockRejectedValueOnce(new AnalystWorkspaceAccessError('FORBIDDEN'));
      const forbidden = await request(server).get(paths[0]!).expect(403);
      expect(forbidden.headers['cache-control']).toBe('no-store');
      expect(forbidden.body).toEqual({ code: 'forbidden' });
      passportQuery.detail.mockRejectedValueOnce(new AnalystWorkspaceAccessError('NOT_FOUND'));
      const foreign = await request(server).get(paths[2]!).expect(404);
      passportQuery.detail.mockRejectedValueOnce(new AnalystWorkspaceAccessError('NOT_FOUND'));
      const absent = await request(server).get('/analyst/workspace/passports/44444444-4444-4444-8444-444444444444').expect(404);
      expect(foreign.body).toEqual({ code: 'not_found' });
      expect(absent.body).toEqual(foreign.body);
      expect(absent.headers['cache-control']).toBe('no-store');
      matchQuery.detail.mockRejectedValueOnce(new AnalystWorkspaceAccessError('NOT_FOUND'));
      const foreignMatch = await request(server).get(paths[4]!).expect(404);
      matchQuery.detail.mockRejectedValueOnce(new AnalystWorkspaceAccessError('NOT_FOUND'));
      const absentMatch = await request(server).get('/analyst/workspace/matches/55555555-5555-4555-8555-555555555555').expect(404);
      expect(absentMatch.body).toEqual(foreignMatch.body);
      expect(absentMatch.headers['cache-control']).toBe('no-store');
      const invalid = await request(server).get('/analyst/workspace/matches?limit=0').expect(400);
      expect(invalid.body).toEqual({ code: 'invalid_query' });
      expect(invalid.headers['cache-control']).toBe('no-store');
      overviewQuery.get.mockRejectedValueOnce(new Error('synthetic internal secret'));
      const unavailable = await request(server).get(paths[0]!).expect(503);
      expect(unavailable.body).toEqual({ code: 'unavailable' });
      expect(unavailable.headers['cache-control']).toBe('no-store');
      for (const path of paths) {
        expect((await request(server).post(path).send({}).then((response) => response.status))).toBe(404);
      }
    } finally { await app.close(); }
  });
});
