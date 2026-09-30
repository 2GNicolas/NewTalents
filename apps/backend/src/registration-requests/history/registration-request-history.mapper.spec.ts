import { describe, expect, it } from 'vitest';

import { mapAdministratorRegistrationHistory, mapApplicantRegistrationHistory } from './registration-request-history.mapper.js';

const event = {
  actorIdentityId: '11111111-1111-4111-8111-111111111111', action: 'CORRECTION_REQUESTED',
  priorStatus: 'SUBMITTED' as const, resultingStatus: 'REQUIRES_CORRECTION' as const,
  outcome: 'APPLIED' as const, safeCategory: 'IDENTITY', createdAt: new Date('2026-09-24T12:00:00.000Z'),
};

describe('registration request history projections', () => {
  it('maps actor/time/action/from/to/result/category for Administrator without arbitrary details', () => {
    expect(mapAdministratorRegistrationHistory(event)).toEqual({
      actor: '11111111-1111-4111-8111-111111111111', at: '2026-09-24T12:00:00.000Z',
      action: 'CORRECTION_REQUESTED', fromStatus: 'SUBMITTED', toStatus: 'REQUIRES_CORRECTION', result: 'APPLIED', category: 'IDENTITY',
    });
  });

  it('redacts actor identity for applicant and excludes all protected fields', () => {
    const projection = mapApplicantRegistrationHistory({ ...event, password: 'CanaryPassword', documentNumber: '123', birthDate: '2008-01-01', contact: '+57', evidence: 'bytes', fingerprint: 'digest', candidate: 'person', declaration: 'complete text' } as never);
    expect(projection).toMatchObject({ actor: 'AUTHORIZED_ACTOR', action: 'CORRECTION_REQUESTED', result: 'APPLIED', category: 'IDENTITY' });
    expect(JSON.stringify(projection)).not.toMatch(/CanaryPassword|123|2008-01-01|\+57|bytes|digest|person|complete text/);
    expect(Object.keys(projection).sort()).toEqual(['action', 'actor', 'at', 'category', 'fromStatus', 'result', 'toStatus'].sort());
    expect(mapApplicantRegistrationHistory({ ...event, safeCategory: 'CC-123456789' })).not.toHaveProperty('category');
  });
});
