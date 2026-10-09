import { HEADERS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';

import { AdminDossierController, AdminDossierHttpError } from './admin-dossier.controller.js';
import { parseAdminDossierQuery } from './admin-dossier.dto.js';

const identityId = '10000000-0000-4000-8000-000000000001';
const dossierId = '20000000-0000-4000-8000-000000000001';
const request = { actor: { identityId } } as never;

describe('AdminDossierController', () => {
  it('parses closed list queries with default 20 and limit 1..50', () => {
    expect(parseAdminDossierQuery({})).toEqual({ ok: true, value: { limit: 20 } });
    expect(parseAdminDossierQuery({ limit: '1', status: 'APPROVED', requestType: 'PERSONAL_ADULT', confirmedFrom: '2026-09-01', confirmedTo: '2026-09-30', query: 'Valentina' })).toMatchObject({ ok: true, value: { limit: 1, status: 'APPROVED' } });
    for (const input of [{ limit: '0' }, { limit: '51' }, { status: 'PENDING' }, { confirmedFrom: 'yesterday' }, { unexpected: 'value' }, { confirmedFrom: '2026-10-01', confirmedTo: '2026-09-01' }]) expect(parseAdminDossierQuery(input).ok).toBe(false);
  });

  it('returns no-store list/detail envelopes and passes only closed values', async () => {
    const summary = { dossierId, maskedReference: 'EXP-••••-0001' };
    const service = { list: vi.fn().mockResolvedValue({ outcome: 'found', items: [summary], nextCursor: 'next' }), detail: vi.fn().mockResolvedValue({ outcome: 'found', detail: { ...summary, confirmationHistory: [] } }) };
    const controller = new AdminDossierController(service as never);
    await expect(controller.list(request, { limit: '20', status: 'APPROVED' })).resolves.toEqual({ data: [summary], pagination: { hasMore: true, nextCursor: 'next' } });
    await expect(controller.detail(request, dossierId)).resolves.toEqual({ data: { ...summary, confirmationHistory: [] } });
    expect(service.list).toHaveBeenCalledWith(identityId, { limit: 20, status: 'APPROVED' });
    expect(Reflect.getMetadata(HEADERS_METADATA, controller.list)).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
    expect(Reflect.getMetadata(HEADERS_METADATA, controller.detail)).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
  });

  it('maps collection denial safely and makes denied/missing details indistinguishable', async () => {
    const controller = new AdminDossierController({ list: vi.fn().mockResolvedValue({ outcome: 'denied' }), detail: vi.fn().mockResolvedValue({ outcome: 'not-found' }) } as never);
    await expect(controller.list(request, {})).rejects.toMatchObject({ code: 'forbidden' });
    await expect(controller.detail(request, dossierId)).rejects.toMatchObject({ code: 'not-found' });
    expect(new AdminDossierHttpError('not-found')).toMatchObject({ status: 404, safeCode: 'dossier_not_found' });
  });

  it('rejects invalid UUIDs and exposes no mutation or evidence route', async () => {
    const controller = new AdminDossierController({} as never);
    await expect(controller.detail(request, 'not-a-uuid')).rejects.toMatchObject({ code: 'not-found' });
    for (const name of ['create', 'update', 'confirm', 'approve', 'evidence', 'delete']) expect(name in AdminDossierController.prototype).toBe(false);
  });
});
