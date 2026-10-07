import { describe, expect, it, vi } from 'vitest';

import { PassportCustodyQueryService } from './passport-custody-query.service.js';

const passportId = '11111111-1111-4111-8111-111111111111';
const analystId = '22222222-2222-4222-8222-222222222222';

const encrypted = (label: string) => `cipher:${label}`;
const candidate = (overrides: Record<string, unknown> = {}) => ({
  id: passportId,
  createdAt: new Date('2026-09-30T12:00:00.000Z'),
  state: 'ACTIVE' as const,
  enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT' as const,
  encryptedLegalName: encrypted('Jugador Visible'),
  academyLabel: null,
  custody: null,
  ...overrides,
});

describe('PassportCustodyQueryService', () => {
  it('projects an eligible active basic passport with absent custody as unassigned version zero', async () => {
    const repository = {
      listPassportCandidates: vi.fn().mockResolvedValue({ rows: [candidate()], hasMore: false }),
      listEligibleAnalysts: vi.fn(),
    };
    const service = new PassportCustodyQueryService(repository as never, { decrypt: (value: string) => value.replace('cipher:', '') });

    await expect(service.listPassports({ assignment: 'UNASSIGNED', limit: 20 })).resolves.toEqual({
      items: [{
        passportId,
        maskedReference: 'PAS-\u2022\u2022\u2022\u2022-1111',
        displayLabel: 'Jugador Visible',
        lifecycleState: 'ACTIVE',
        enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT',
        custody: { state: 'UNASSIGNED', version: 0 },
        capabilities: ['ASSIGN'],
      }],
    });
    expect(repository.listPassportCandidates).toHaveBeenCalledWith(expect.objectContaining({
      assignment: 'UNASSIGNED',
      state: 'ACTIVE',
      enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT',
    }));
  });

  it('projects assigned custody and live Analyst workload without private identity or credential fields', async () => {
    const repository = {
      listPassportCandidates: vi.fn().mockResolvedValue({ rows: [candidate({
        custody: {
          version: 4,
          assignedAt: new Date('2026-09-29T10:00:00.000Z'),
          currentAnalyst: { identityId: analystId, displayLabel: 'Analista Operativo' },
          activeCustodyCount: 7,
        },
      })], hasMore: false }),
      listEligibleAnalysts: vi.fn().mockResolvedValue({
        rows: [{ identityId: analystId, displayLabel: 'Analista Operativo', normalizedLabel: 'analista operativo', activeCustodyCount: 7 }],
        hasMore: false,
      }),
    };
    const service = new PassportCustodyQueryService(repository as never, { decrypt: (value: string) => value.replace('cipher:', '') });

    const passports = await service.listPassports({ assignment: 'ASSIGNED', analystId, limit: 20 });
    const analysts = await service.listAnalysts({ limit: 20 });

    expect('items' in passports).toBe(true);
    expect('items' in analysts).toBe(true);
    if (!('items' in passports) || !('items' in analysts)) throw new Error('Expected successful query pages');
    expect(passports.items[0]).toMatchObject({
      custody: {
        state: 'ASSIGNED', version: 4, assignedAt: '2026-09-29T10:00:00.000Z',
        analyst: { identityId: analystId, displayLabel: 'Analista Operativo', activeCustodyCount: 7 },
      },
      capabilities: ['CHANGE', 'REMOVE'],
    });
    expect(analysts.items).toEqual([{ identityId: analystId, displayLabel: 'Analista Operativo', activeCustodyCount: 7 }]);
    expect(JSON.stringify({ passports, analysts })).not.toMatch(/email|document|credential|password|encryptedLegalName|normalizedLabel/i);
  });

  it('searches decrypted permitted names and masked references through bounded stable chunks', async () => {
    const first = Array.from({ length: 20 }, (_, index) => candidate({
      id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      createdAt: new Date(Date.UTC(2026, 8, 30, 12, 0, 20 - index)),
      encryptedLegalName: encrypted(`Sin coincidencia ${index}`),
    }));
    const match = candidate({ id: '33333333-3333-4333-8333-333333333333', encryptedLegalName: encrypted('Valentina Coincide') });
    const repository = {
      listPassportCandidates: vi.fn()
        .mockResolvedValueOnce({ rows: first, hasMore: true })
        .mockResolvedValueOnce({ rows: [match], hasMore: false }),
      listEligibleAnalysts: vi.fn(),
    };
    const service = new PassportCustodyQueryService(repository as never, { decrypt: (value: string) => value.replace('cipher:', '') });

    const page = await service.listPassports({ assignment: 'ALL', query: 'valentina', limit: 1 });

    expect('items' in page).toBe(true);
    if (!('items' in page)) throw new Error('Expected a successful passport page');
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.displayLabel).toBe('Valentina Coincide');
    expect(repository.listPassportCandidates).toHaveBeenCalledTimes(2);
    expect(repository.listPassportCandidates.mock.calls[0]?.[0].take).toBe(20);
    expect(repository.listPassportCandidates.mock.calls[1]?.[0].cursor).toEqual(expect.objectContaining({ id: first[19]?.id }));
  });

  it('uses stable continuation cursors for passport and Analyst pages', async () => {
    const repository = {
      listPassportCandidates: vi.fn().mockResolvedValue({ rows: [candidate()], hasMore: true }),
      listEligibleAnalysts: vi.fn().mockResolvedValue({
        rows: [{ identityId: analystId, displayLabel: 'Analista Operativo', normalizedLabel: 'analista operativo', activeCustodyCount: 0 }],
        hasMore: true,
      }),
    };
    const service = new PassportCustodyQueryService(repository as never, { decrypt: (value: string) => value.replace('cipher:', '') });

    const passports = await service.listPassports({ assignment: 'ALL', limit: 1 });
    const analysts = await service.listAnalysts({ limit: 1 });

    expect('items' in passports).toBe(true);
    expect('items' in analysts).toBe(true);
    if (!('items' in passports) || !('items' in analysts)) throw new Error('Expected successful query pages');
    expect(passports.nextCursor).toEqual(expect.any(String));
    expect(analysts.nextCursor).toEqual(expect.any(String));
    if (!passports.nextCursor || !analysts.nextCursor) throw new Error('Expected stable continuation cursors');
    await service.listPassports({ assignment: 'ALL', limit: 1, cursor: passports.nextCursor });
    await service.listAnalysts({ limit: 1, cursor: analysts.nextCursor });
    expect(repository.listPassportCandidates).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: { createdAt: new Date('2026-09-30T12:00:00.000Z'), id: passportId } }));
    expect(repository.listEligibleAnalysts).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: { normalizedLabel: 'analista operativo', identityId: analystId } }));
  });

  it('rejects malformed or mismatched cursors without reading protected rows', async () => {
    const repository = { listPassportCandidates: vi.fn(), listEligibleAnalysts: vi.fn() };
    const service = new PassportCustodyQueryService(repository as never, { decrypt: vi.fn() });

    await expect(service.listPassports({ assignment: 'ALL', limit: 20, cursor: 'not-a-cursor' })).resolves.toEqual({ outcome: 'invalid-cursor' });
    await expect(service.listAnalysts({ limit: 20, cursor: 'not-a-cursor' })).resolves.toEqual({ outcome: 'invalid-cursor' });
    expect(repository.listPassportCandidates).not.toHaveBeenCalled();
    expect(repository.listEligibleAnalysts).not.toHaveBeenCalled();
  });
});
