import { describe, expect, it } from 'vitest';

import { RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';
import { AdditionalAcademyAccountService } from './additional-academy-account.service.js';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const ACADEMY_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ACADEMY_ID = '33333333-3333-4333-8333-333333333333';

function prisma(options: Readonly<{ membership?: 'ACTIVE' | 'INACTIVE' | 'MISSING'; academy?: boolean; responsible?: boolean }> = {}) {
  const membership = options.membership ?? 'ACTIVE';
  return {
    identity: { findUnique: async () => ({ status: 'ACTIVE', roleAssignments: [{ role: 'ACADEMY_USER' }], registrationApplicantAccesses: [] }) },
    academyMembership: { findFirst: async ({ where }: { where: { academyId?: string } }) => membership === 'ACTIVE' && where.academyId === ACADEMY_ID ? { academyId: ACADEMY_ID, status: 'ACTIVE' } : null },
    academy: { findUnique: async ({ where }: { where: { id: string } }) => options.academy === false || where.id !== ACADEMY_ID ? null : { id: ACADEMY_ID } },
    registrationRequest: { findFirst: async ({ where }: { where: { ownerIdentityId: string; academyContextId: string } }) => options.responsible === false || where.ownerIdentityId !== ACTOR_ID || where.academyContextId !== ACADEMY_ID ? null : { id: '44444444-4444-4444-8444-444444444444' } },
  };
}

const validPayload = () => ({
  person: { legalNames: 'Cuenta', legalSurnames: 'Sintética', documentType: 'CC', documentNumber: '10327394', birthDate: '1990-01-01', country: 'CO', city: '11001' },
  function: 'Entrenador asistente', responsibleAuthorization: true,
  consent: { privacyVersion: '2026-09', privacyAccepted: true, truthfulnessAccepted: true },
  evidence: ['IDENTITY_FRONT', 'IDENTITY_BACK', 'ACADEMY_ACCOUNT_AUTHORIZATION'],
  operationInstant: new Date('2026-09-28T12:00:00Z'),
});

describe('AdditionalAcademyAccountService', () => {
  it('derives the approved academy from active matching membership and responsible authority', async () => {
    const database = prisma();
    const service = new AdditionalAcademyAccountService(database as never, new RegistrationAuthorizationAdapter(database as never));
    await expect(service.validate({ actorIdentityId: ACTOR_ID, academyId: ACADEMY_ID, payload: validPayload() })).resolves.toEqual({
      complete: true, academyContextId: ACADEMY_ID, ownerIdentityId: ACTOR_ID, academyDecisionAllowed: false,
    });
  });

  it.each([
    ['arbitrary academy id', OTHER_ACADEMY_ID, prisma()],
    ['inactive membership', ACADEMY_ID, prisma({ membership: 'INACTIVE' })],
    ['unapproved academy', ACADEMY_ID, prisma({ academy: false })],
    ['missing responsible authority', ACADEMY_ID, prisma({ responsible: false })],
  ])('rejects %s without deriving academy privilege', async (_case, academyId, database) => {
    const service = new AdditionalAcademyAccountService(database as never, new RegistrationAuthorizationAdapter(database as never));
    await expect(service.validate({ actorIdentityId: ACTOR_ID, academyId, payload: validPayload() })).resolves.toEqual({ complete: false, code: 'ACADEMY_OPERATION_NOT_AUTHORIZED' });
  });

  it.each([
    ['missing function', (value: ReturnType<typeof validPayload>) => { value.function = ''; }],
    ['missing identity', (value: ReturnType<typeof validPayload>) => { value.person.legalNames = ''; }],
    ['document type over the contract limit', (value: ReturnType<typeof validPayload>) => { value.person.documentType = 'X'.repeat(41); }],
    ['missing authorization evidence', (value: ReturnType<typeof validPayload>) => { value.evidence = ['IDENTITY_FRONT', 'IDENTITY_BACK']; }],
    ['client academy field', (value: ReturnType<typeof validPayload> & Record<string, unknown>) => { value.academyId = OTHER_ACADEMY_ID; }],
  ])('rejects %s', async (_case, mutate) => {
    const database = prisma(); const payload = validPayload(); mutate(payload);
    const service = new AdditionalAcademyAccountService(database as never, new RegistrationAuthorizationAdapter(database as never));
    await expect(service.validate({ actorIdentityId: ACTOR_ID, academyId: ACADEMY_ID, payload })).resolves.toEqual({ complete: false, code: 'INVALID_ADDITIONAL_ACADEMY_ACCOUNT_DRAFT' });
  });
});
