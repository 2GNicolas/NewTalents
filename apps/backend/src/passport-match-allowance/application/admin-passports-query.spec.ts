import { describe, expect, it, vi } from 'vitest';

import { AdminPassportsQuery } from './admin-passports-query.js';

const administratorId = '11111111-1111-4111-8111-111111111111';
const passport = (id: string, state: 'ACTIVE' | 'DRAFT', name: string) => ({
  id, createdAt: new Date('2026-10-09T12:00:00Z'), state, encryptedLegalName: name,
});

describe('Administrator all-passport read model', () => {
  it('includes active and inactive passports without custody filtering and keeps references separate', async () => {
    const repository = { list: vi.fn().mockResolvedValueOnce({ rows: [passport('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ACTIVE', 'Jugador Uno'), passport('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'DRAFT', 'Jugador Dos')], hasMore: false }) };
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }) };
    const query = new AdminPassportsQuery(repository as never, authorization as never, { decrypt: (value: string) => value });
    const result = await query.list({ administratorId, limit: 20 });
    expect(result).toMatchObject({ items: [
      { passportId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', playerLabel: 'Jugador Uno', lifecycleState: 'ACTIVE', canConfigure: true, detailPath: '/admin/passports/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      { passportId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', playerLabel: 'Jugador Dos', lifecycleState: 'DRAFT', canConfigure: false },
    ] });
    expect(result).not.toHaveProperty('items.0.encryptedLegalName');
    expect(JSON.stringify(result)).not.toContain('contact');
    expect(repository.list).toHaveBeenCalledWith({ take: 20 });
    expect(authorization.authorize).toHaveBeenCalledWith(administratorId, 'passport.allowance.list');
  });

  it('rejects denied access and invalid pages before fetching protected rows', async () => {
    const repository = { list: vi.fn() };
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: false }) };
    const query = new AdminPassportsQuery(repository as never, authorization as never, { decrypt: (value: string) => value });
    expect(await query.list({ administratorId, limit: 20 })).toEqual({ outcome: 'denied' });
    expect(await query.list({ administratorId, limit: 51 })).toEqual({ outcome: 'invalid-query' });
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('supports stable cursor pages and authorizes detail separately', async () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const repository = { list: vi.fn().mockResolvedValue({ rows: [passport(id, 'ACTIVE', 'Nombre')], hasMore: true }), find: vi.fn().mockResolvedValue(passport(id, 'ACTIVE', 'Nombre')) };
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }) };
    const query = new AdminPassportsQuery(repository as never, authorization as never, { decrypt: (value: string) => value });
    const first = await query.list({ administratorId, limit: 1 });
    expect(first).toHaveProperty('nextCursor');
    if (!('nextCursor' in first) || !first.nextCursor) throw new Error('Expected a next cursor');
    await query.list({ administratorId, limit: 1, cursor: first.nextCursor });
    expect(repository.list.mock.calls[1]?.[0]).toHaveProperty('cursor.id', id);
    expect(await query.detail({ administratorId, passportId: id })).toMatchObject({ passportId: id, playerLabel: 'Nombre' });
    expect(authorization.authorize).toHaveBeenCalledWith(administratorId, 'passport.allowance.view', { exists: true, active: true });
  });
});
