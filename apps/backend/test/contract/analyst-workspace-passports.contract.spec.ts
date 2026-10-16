import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, HEADERS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import requestHttp from 'supertest';

import { AuthenticationGuard } from '../../src/authentication/authentication.guard.js';
import { AnalystWorkspaceController } from '../../src/analyst-workspace/http/analyst-workspace.controller.js';
import { AnalystWorkspaceQueryError } from '../../src/analyst-workspace/http/analyst-workspace-query.error.js';
import { AnalystWorkspaceExceptionFilter } from '../../src/analyst-workspace/http/analyst-workspace-exception.filter.js';
import { AnalystWorkspaceAccessError } from '../../src/analyst-workspace/application/analyst-workspace-access.js';
import { AnalystPassports } from '../../src/analyst-workspace/application/analyst-passports.js';
import { AnalystMatches } from '../../src/analyst-workspace/application/analyst-matches.js';
import { AnalystOverview } from '../../src/analyst-workspace/application/analyst-overview.js';

describe('Feature 010 passport read contract', () => {
  it('exposes guarded no-store GETs only, with bounded pagination', async () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AnalystWorkspaceController)).toContain(AuthenticationGuard);
    for (const [method, path] of [['passports', 'passports'], ['passport', 'passports/:passportId']] as const) {
      expect(Reflect.getMetadata(PATH_METADATA, AnalystWorkspaceController.prototype[method])).toBe(path);
      expect(Reflect.getMetadata(METHOD_METADATA, AnalystWorkspaceController.prototype[method])).toBe(RequestMethod.GET);
      expect(Reflect.getMetadata(HEADERS_METADATA, AnalystWorkspaceController.prototype[method]))
        .toContainEqual({ name: 'Cache-Control', value: 'no-store' });
    }
    const query = { list: vi.fn().mockResolvedValue({ data: [], pagination: { hasMore: false } }),
      detail: vi.fn().mockResolvedValue({ contact: { availability: 'UNAVAILABLE' } }) };
    const controller = new AnalystWorkspaceController({} as never, query as never, {} as never);
    const actor = { actor: { identityId: '11111111-1111-4111-8111-111111111111' } } as never;
    expect(await controller.passports(actor, undefined, undefined)).toEqual({ data: [], pagination: { hasMore: false } });
    expect(query.list).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', { limit: 20 });
    await controller.passport(actor, '22222222-2222-4222-8222-222222222222');
    expect(query.detail).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');
  });

  it('rejects invalid queries and makes foreign/missing resources indistinguishable', () => {
    const filter = new AnalystWorkspaceExceptionFilter();
    for (const [error, status, code] of [
      [new AnalystWorkspaceAccessError('NOT_FOUND'), 404, 'not_found'],
      [new AnalystWorkspaceQueryError(), 400, 'invalid_query'],
    ] as const) {
      const response = { status: vi.fn().mockReturnThis(), header: vi.fn().mockReturnThis(), json: vi.fn() };
      filter.catch(error, { switchToHttp: () => ({ getResponse: () => response }) } as never);
      expect(response.status).toHaveBeenCalledWith(status);
      expect(response.header).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(response.json).toHaveBeenCalledWith({ code });
    }
  });

  it('returns minimal no-store HTTP shapes and bounded-query errors', async () => {
    const card = { passportId: '22222222-2222-4222-8222-222222222222', maskedReference: 'PAS-••••-2222',
      playerName: 'Jugador sintético', lifecycleState: 'ACTIVE', custodyState: 'ASSIGNED_TO_ACTOR' };
    const query = { list: vi.fn().mockResolvedValue({ data: [card], pagination: { hasMore: false } }),
      detail: vi.fn().mockResolvedValue({ ...card, contact: { availability: 'AVAILABLE', kind: 'SELF', email: 'adult@example.test' } }) };
    const module = await Test.createTestingModule({ controllers: [AnalystWorkspaceController], providers: [
      { provide: AnalystOverview, useValue: { get: vi.fn() } }, { provide: AnalystPassports, useValue: query },
      { provide: AnalystMatches, useValue: {} },
    ] }).overrideGuard(AuthenticationGuard).useValue({ canActivate: (context: { switchToHttp: () => { getRequest: () => Record<string, unknown> } }) => {
      context.switchToHttp().getRequest().actor = { identityId: '11111111-1111-4111-8111-111111111111' }; return true;
    } }).compile();
    const app = module.createNestApplication();
    await app.init();
    try {
      const server = app.getHttpServer();
      const list = await requestHttp(server).get('/analyst/workspace/passports').expect(200);
      expect(list.headers['cache-control']).toBe('no-store');
      expect(list.body.data).toEqual([card]);
      expect(JSON.stringify(list.body)).not.toMatch(/contact|document|birth|evidence|analystIdentityId/i);
      const detail = await requestHttp(server).get(`/analyst/workspace/passports/${card.passportId}`).expect(200);
      expect(detail.headers['cache-control']).toBe('no-store');
      expect(detail.body.contact).toEqual({ availability: 'AVAILABLE', kind: 'SELF', email: 'adult@example.test' });
      expect(detail.body.contact.phone).toBeUndefined();
      for (const path of ['/analyst/workspace/passports?limit=0', '/analyst/workspace/passports?limit=51',
        '/analyst/workspace/passports?cursor=bad']) {
        const response = await requestHttp(server).get(path).expect(400);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.body).toEqual({ code: 'invalid_query' });
      }
      query.detail.mockRejectedValueOnce(new AnalystWorkspaceAccessError('NOT_FOUND'));
      const foreign = await requestHttp(server).get(`/analyst/workspace/passports/${card.passportId}`).expect(404);
      query.detail.mockRejectedValueOnce(new AnalystWorkspaceAccessError('NOT_FOUND'));
      const absent = await requestHttp(server).get('/analyst/workspace/passports/33333333-3333-4333-8333-333333333333').expect(404);
      expect(foreign.headers['cache-control']).toBe('no-store');
      expect(foreign.body).toEqual({ code: 'not_found' });
      expect(absent.body).toEqual(foreign.body);
    } finally { await app.close(); }
  });
});
