import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, HEADERS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import requestHttp from 'supertest';

import { AuthenticationGuard } from '../../src/authentication/authentication.guard.js';
import { AnalystWorkspaceController } from '../../src/analyst-workspace/http/analyst-workspace.controller.js';
import { AnalystWorkspaceExceptionFilter } from '../../src/analyst-workspace/http/analyst-workspace-exception.filter.js';
import { AnalystWorkspaceAccessError } from '../../src/analyst-workspace/application/analyst-workspace-access.js';
import { AnalystOverview } from '../../src/analyst-workspace/application/analyst-overview.js';
import { AnalystPassports } from '../../src/analyst-workspace/application/analyst-passports.js';
import { AnalystMatches } from '../../src/analyst-workspace/application/analyst-matches.js';

const request = { actor: { identityId: '11111111-1111-4111-8111-111111111111', sessionId: 'session' } };
const empty = { timeZone: 'America/Bogota', analystLabel: 'Analista de prueba', pending: { availability: 'AVAILABLE', data: [], hasMore: false },
  upcoming: { availability: 'AVAILABLE', data: [], hasMore: false }, completed: { availability: 'UNAVAILABLE' } };

describe('Feature 010 overview HTTP contract', () => {
  it('registers only guarded no-store GET and follows the OpenAPI shape', async () => {
    expect(Reflect.getMetadata(PATH_METADATA, AnalystWorkspaceController)).toBe('analyst/workspace');
    expect(Reflect.getMetadata(GUARDS_METADATA, AnalystWorkspaceController)).toContain(AuthenticationGuard);
    expect(Reflect.getMetadata(PATH_METADATA, AnalystWorkspaceController.prototype.overview)).toBe('overview');
    expect(Reflect.getMetadata(METHOD_METADATA, AnalystWorkspaceController.prototype.overview)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(HEADERS_METADATA, AnalystWorkspaceController.prototype.overview))
      .toContainEqual({ name: 'Cache-Control', value: 'no-store' });
    const query = { get: vi.fn().mockResolvedValue(empty) };
    const controller = new AnalystWorkspaceController(query as never, {} as never, {} as never);
    expect(await controller.overview(request)).toEqual(empty);
    expect(query.get).toHaveBeenCalledWith(request.actor.identityId);
    expect(JSON.stringify(empty)).not.toMatch(/contact|draft|history|metric|loadId|analystIdentityId/i);
    expect(Object.keys(empty)).toEqual(['timeZone', 'analystLabel', 'pending', 'upcoming', 'completed']);
  });

  it('keeps forbidden and unavailable errors minimal and no-store', () => {
    for (const [error, status, code] of [
      [new AnalystWorkspaceAccessError('FORBIDDEN'), 403, 'forbidden'],
      [new Error('private database failure'), 503, 'unavailable'],
    ] as const) {
      const response = { status: vi.fn().mockReturnThis(), header: vi.fn().mockReturnThis(), json: vi.fn() };
      new AnalystWorkspaceExceptionFilter().catch(error, { switchToHttp: () => ({ getResponse: () => response }) } as never);
      expect(response.status).toHaveBeenCalledWith(status);
      expect(response.header).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(response.json).toHaveBeenCalledWith({ code });
      expect(JSON.stringify(response.json.mock.calls)).not.toContain('private database failure');
    }
  });

  it('serves guarded HTTP with no-store for success, missing session, and denied role', async () => {
    let authenticated = true;
    const query = { get: vi.fn().mockResolvedValue(empty) };
    const module = await Test.createTestingModule({
      controllers: [AnalystWorkspaceController],
      providers: [
        { provide: AnalystOverview, useValue: query },
        { provide: AnalystPassports, useValue: {} },
        { provide: AnalystMatches, useValue: {} },
      ],
    }).overrideGuard(AuthenticationGuard).useValue({ canActivate: (context: { switchToHttp: () => { getRequest: () => { actor?: typeof request.actor } } }) => {
          if (!authenticated) return false;
          context.switchToHttp().getRequest().actor = request.actor;
          return true;
        } }).compile();
    const app = module.createNestApplication();
    await app.init();
    try {
      const server = app.getHttpServer();
      const success = await requestHttp(server).get('/analyst/workspace/overview').expect(200);
      expect(success.headers['cache-control']).toBe('no-store');
      expect(success.body).toEqual(empty);
      authenticated = false;
      const absent = await requestHttp(server).get('/analyst/workspace/overview').expect(401);
      expect(absent.headers['cache-control']).toBe('no-store');
      expect(absent.body).toEqual({ code: 'unauthenticated' });
      authenticated = true;
      query.get.mockRejectedValueOnce(new AnalystWorkspaceAccessError('FORBIDDEN'));
      const denied = await requestHttp(server).get('/analyst/workspace/overview').expect(403);
      expect(denied.headers['cache-control']).toBe('no-store');
      expect(denied.body).toEqual({ code: 'forbidden' });
    } finally { await app.close(); }
  });
});
