import { HEADERS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { PassportCustodyController } from './passport-custody.controller.js';

const administratorId = '10000000-0000-4000-8000-000000000001';
const passportId = '20000000-0000-4000-8000-000000000002';
const request = { actor: { identityId: administratorId, sessionId: 'session' } };
const detail = {
  passportId, maskedReference: 'PAS-••••-0002', displayLabel: 'Jugador Sintético', lifecycleState: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT',
  custody: { state: 'UNASSIGNED', version: 0 }, capabilities: ['ASSIGN'],
  originRequest: { id: '30000000-0000-4000-8000-000000000003', maskedReference: 'SOL-••••-0003', status: 'APPROVED', available: true },
  linkedDossier: { id: '40000000-0000-4000-8000-000000000004', maskedReference: 'EXP-••••-0004', status: 'APPROVED', available: true },
  history: [], creationMilestone: { kind: 'CREATED_UNASSIGNED', at: '2026-09-30T08:00:00.000Z', label: 'Pasaporte creado · Sin asignar' },
};

function controller(overrides: { detail?: object; authorization?: object } = {}) {
  return new PassportCustodyController(
    { listAnalysts: vi.fn(), listPassports: vi.fn() } as never,
    { assign: vi.fn(), change: vi.fn(), remove: vi.fn() } as never,
    (overrides.authorization ?? { authorizeAdministrator: vi.fn().mockResolvedValue({ allowed: true, policyVersion: '1' }) }) as never,
    (overrides.detail ?? { get: vi.fn().mockResolvedValue({ outcome: 'found', detail }) }) as never,
  );
}

describe('PassportCustodyController detail', () => {
  it('exposes an authorized no-store GET with the closed contract projection', async () => {
    const subject = controller();
    expect(Reflect.getMetadata(PATH_METADATA, PassportCustodyController.prototype.detail)).toBe('passports/:passportId');
    expect(Reflect.getMetadata(METHOD_METADATA, PassportCustodyController.prototype.detail)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(HEADERS_METADATA, PassportCustodyController.prototype.detail)).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
    const result = await subject.detail(request, passportId);
    expect(result).toEqual({ data: expect.objectContaining({ passportId, history: [], originRequest: expect.any(Object), linkedDossier: expect.any(Object) }) });
    expect(result.data).not.toHaveProperty('creationMilestone');
    expect(JSON.stringify(result)).not.toMatch(/encrypted|document|email|phone|objectKey|credential/i);
  });

  it('makes denied and missing detail indistinguishable and safely maps unavailable reads', async () => {
    await expect(controller({ authorization: { authorizeAdministrator: vi.fn().mockResolvedValue({ allowed: false, reason: 'denied', policyVersion: '1' }) } }).detail(request, passportId)).rejects.toMatchObject({ code: 'not-found' });
    await expect(controller({ detail: { get: vi.fn().mockResolvedValue({ outcome: 'not-found' }) } }).detail(request, passportId)).rejects.toMatchObject({ code: 'not-found' });
    await expect(controller({ detail: { get: vi.fn().mockResolvedValue({ outcome: 'unavailable' }) } }).detail(request, passportId)).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('rejects malformed identifiers before protected reads', async () => {
    const service = { get: vi.fn() };
    await expect(controller({ detail: service }).detail(request, 'not-a-uuid')).rejects.toMatchObject({ code: 'not-found' });
    expect(service.get).not.toHaveBeenCalled();
  });
});
