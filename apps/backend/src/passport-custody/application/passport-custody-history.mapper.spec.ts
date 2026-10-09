import { describe, expect, it } from 'vitest';

import { mapPassportCustodyHistory } from './passport-custody-history.mapper.js';

const passportId = '10000000-0000-4000-8000-000000000001';

describe('mapPassportCustodyHistory', () => {
  it('projects a derived creation milestone and stable chronological custody events', () => {
    const result = mapPassportCustodyHistory({
      passportId,
      passportCreatedAt: new Date('2026-09-30T08:00:00.000Z'),
      events: [
        event('30000000-0000-4000-8000-000000000003', 'REMOVED', '2026-09-30T11:00:00.000Z', 'Analista B', undefined, 'Retiro operativo'),
        event('10000000-0000-4000-8000-000000000003', 'ASSIGNED', '2026-09-30T09:00:00.000Z', undefined, 'Analista A', null),
        event('20000000-0000-4000-8000-000000000003', 'CHANGED', '2026-09-30T10:00:00.000Z', 'Analista A', 'Analista B', 'Balance de carga'),
      ],
    });

    expect(result.milestone).toEqual({ kind: 'CREATED_UNASSIGNED', at: '2026-09-30T08:00:00.000Z', label: 'Pasaporte creado · Sin asignar' });
    expect(result.events.map(({ action }) => action)).toEqual(['ASSIGNED', 'CHANGED', 'REMOVED']);
    expect(result.events[0]).not.toHaveProperty('reason');
    expect(result.events[1]).toMatchObject({ actorLabel: 'Administrador', previousAnalystLabel: 'Analista A', nextAnalystLabel: 'Analista B' });
  });

  it('uses only operational labels, bounds reasons, and excludes protected identity fields', () => {
    const result = mapPassportCustodyHistory({
      passportId,
      passportCreatedAt: new Date('2026-09-30T08:00:00.000Z'),
      events: [{
        ...event('10000000-0000-4000-8000-000000000003', 'CHANGED', '2026-09-30T09:00:00.000Z', 'Analista Anterior', '  Analista Operativo  ', ` ${'a'.repeat(520)} `),
        administrator: { analystOperationalProfile: { displayLabel: 'No usar' } },
        email: 'privacy-canary@example.test',
        documentNumber: 'PRIVATE-DOCUMENT',
      }],
    });

    expect(result.events[0]?.nextAnalystLabel).toBe('Analista Operativo');
    expect(result.events[0]?.reason).toHaveLength(500);
    expect(JSON.stringify(result)).not.toMatch(/privacy-canary|PRIVATE-DOCUMENT|administratorIdentityId|nextAnalystIdentityId/i);
  });
});

function event(id: string, action: 'ASSIGNED' | 'CHANGED' | 'REMOVED', createdAt: string, previous?: string, next?: string, safeReason: string | null = 'Motivo seguro') {
  return {
    id,
    action,
    createdAt: new Date(createdAt),
    safeReason,
    previousAnalyst: previous ? { analystOperationalProfile: { displayLabel: previous } } : null,
    nextAnalyst: next ? { analystOperationalProfile: { displayLabel: next } } : null,
  };
}
