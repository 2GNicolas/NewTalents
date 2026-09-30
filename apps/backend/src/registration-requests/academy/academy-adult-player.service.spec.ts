import { describe, expect, it } from 'vitest';

import { RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';
import { AcademyAdultPlayerService } from './academy-adult-player.service.js';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const ACADEMY_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ACADEMY_ID = '33333333-3333-4333-8333-333333333333';

function prisma(options: Readonly<{ membership?: boolean; role?: boolean }> = {}) {
  return {
    identity: { findUnique: async () => ({ status: 'ACTIVE', roleAssignments: options.role === false ? [] : [{ role: 'ACADEMY_USER' }], registrationApplicantAccesses: [] }) },
    academyMembership: { findFirst: async ({ where }: { where: { academyId?: string } }) => options.membership !== false && where.academyId === ACADEMY_ID ? { academyId: ACADEMY_ID, status: 'ACTIVE' } : null },
    academy: { findUnique: async ({ where }: { where: { id: string } }) => where.id === ACADEMY_ID ? { id: ACADEMY_ID } : null },
  };
}

const validPayload = () => ({
  player: { legalNames: 'Jugador', legalSurnames: 'Adulto', documentType: 'CC', documentNumber: '10327395', birthDate: '1995-01-01', country: 'CO', city: '76001' },
  adultAuthorization: true,
  consent: { privacyVersion: '2026-09', privacyAccepted: true, truthfulnessAccepted: true, academyPresentationAccepted: true },
  evidence: ['IDENTITY_FRONT', 'IDENTITY_BACK', 'ADULT_AUTHORIZATION'], operationInstant: new Date('2026-09-28T12:00:00Z'),
});

describe('AcademyAdultPlayerService', () => {
  it('accepts adult identity, evidence and express authorization only in the active academy context', async () => {
    const database = prisma();
    const service = new AcademyAdultPlayerService(database as never, new RegistrationAuthorizationAdapter(database as never));
    await expect(service.validate({ actorIdentityId: ACTOR_ID, academyId: ACADEMY_ID, payload: validPayload() })).resolves.toEqual({
      complete: true, academyContextId: ACADEMY_ID, ownerIdentityId: ACTOR_ID, academyDecisionAllowed: false, createsUserOrSelf: false,
    });
  });

  it.each([
    ['stale membership', ACADEMY_ID, prisma({ membership: false })],
    ['arbitrary academy id', OTHER_ACADEMY_ID, prisma()],
    ['missing academy role', ACADEMY_ID, prisma({ role: false })],
  ])('rejects %s without trusting frontend academy state', async (_case, academyId, database) => {
    const service = new AcademyAdultPlayerService(database as never, new RegistrationAuthorizationAdapter(database as never));
    await expect(service.validate({ actorIdentityId: ACTOR_ID, academyId, payload: validPayload() })).resolves.toEqual({ complete: false, code: 'ACADEMY_OPERATION_NOT_AUTHORIZED' });
  });

  it.each([
    ['minor on adult route', (value: ReturnType<typeof validPayload>) => { value.player.birthDate = '2012-01-01'; }],
    ['missing adult authorization', (value: ReturnType<typeof validPayload>) => { value.adultAuthorization = false; }],
    ['missing evidence', (value: ReturnType<typeof validPayload>) => { value.evidence = ['IDENTITY_FRONT', 'IDENTITY_BACK']; }],
    ['missing academy presentation consent', (value: ReturnType<typeof validPayload>) => { value.consent.academyPresentationAccepted = false; }],
  ])('rejects %s', async (_case, mutate) => {
    const database = prisma(); const payload = validPayload(); mutate(payload);
    const service = new AcademyAdultPlayerService(database as never, new RegistrationAuthorizationAdapter(database as never));
    await expect(service.validate({ actorIdentityId: ACTOR_ID, academyId: ACADEMY_ID, payload })).resolves.toEqual({ complete: false, code: 'INVALID_ACADEMY_ADULT_PLAYER_DRAFT' });
  });
});
