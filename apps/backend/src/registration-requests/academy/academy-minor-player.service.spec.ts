import { describe, expect, it } from 'vitest';

import { RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';
import { AcademyMinorPlayerService } from './academy-minor-player.service.js';

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
  minor: { legalNames: 'Jugador', legalSurnames: 'Menor', documentType: 'TI', documentNumber: '1000642', birthDate: '2014-01-01', country: 'CO', city: '05001' },
  representative: { legalNames: 'Representante', legalSurnames: 'Sintético', documentType: 'CC', documentNumber: '10327396', birthDate: '1987-01-01', country: 'CO', city: '05001', phone: '3000000000' },
  relationship: 'MOTHER', authorityDeclared: true,
  consent: { privacyVersion: '2026-09', privacyAccepted: true, truthfulnessAccepted: true, representationAccepted: true, minorTreatmentAccepted: true, academyPresentationAccepted: true },
  evidence: ['IDENTITY_FRONT', 'IDENTITY_BACK', 'MINOR_CIVIL_IDENTITY', 'REPRESENTATION_AUTHORITY'], operationInstant: new Date('2026-09-28T12:00:00Z'),
});

describe('AcademyMinorPlayerService', () => {
  it('keeps legal representation separate from the active academy sporting context', async () => {
    const database = prisma();
    const service = new AcademyMinorPlayerService(database as never, new RegistrationAuthorizationAdapter(database as never));
    await expect(service.validate({ actorIdentityId: ACTOR_ID, academyId: ACADEMY_ID, payload: validPayload() })).resolves.toEqual({
      complete: true, academyContextId: ACADEMY_ID, ownerIdentityId: ACTOR_ID, academyDecisionAllowed: false, academyIsLegalRepresentative: false, automaticAccounts: 0,
    });
  });

  it.each([
    ['inactive membership', ACADEMY_ID, prisma({ membership: false })],
    ['arbitrary academy id', OTHER_ACADEMY_ID, prisma()],
    ['missing academy role', ACADEMY_ID, prisma({ role: false })],
  ])('rejects %s without trusting frontend academy state', async (_case, academyId, database) => {
    const service = new AcademyMinorPlayerService(database as never, new RegistrationAuthorizationAdapter(database as never));
    await expect(service.validate({ actorIdentityId: ACTOR_ID, academyId, payload: validPayload() })).resolves.toEqual({ complete: false, code: 'ACADEMY_OPERATION_NOT_AUTHORIZED' });
  });

  it.each([
    ['adult on minor route', (value: ReturnType<typeof validPayload>) => { value.minor.birthDate = '1990-01-01'; }],
    ['representative without phone', (value: ReturnType<typeof validPayload>) => { value.representative.phone = ''; }],
    ['minor contact', (value: ReturnType<typeof validPayload> & { minor: Record<string, unknown> }) => { value.minor.phone = '3000000000'; }],
    ['missing authority', (value: ReturnType<typeof validPayload>) => { value.authorityDeclared = false; }],
    ['missing treatment consent', (value: ReturnType<typeof validPayload>) => { value.consent.minorTreatmentAccepted = false; }],
    ['missing presentation consent', (value: ReturnType<typeof validPayload>) => { value.consent.academyPresentationAccepted = false; }],
    ['incomplete evidence', (value: ReturnType<typeof validPayload>) => { value.evidence = ['MINOR_CIVIL_IDENTITY', 'REPRESENTATION_AUTHORITY']; }],
  ])('rejects %s', async (_case, mutate) => {
    const database = prisma(); const payload = validPayload(); mutate(payload as never);
    const service = new AcademyMinorPlayerService(database as never, new RegistrationAuthorizationAdapter(database as never));
    await expect(service.validate({ actorIdentityId: ACTOR_ID, academyId: ACADEMY_ID, payload })).resolves.toEqual({ complete: false, code: 'INVALID_ACADEMY_MINOR_PLAYER_DRAFT' });
  });
});
