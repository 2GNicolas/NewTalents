import { describe, expect, it, vi } from 'vitest';

import { PrivateIdentityService } from '../../player-passport/player-private-identity/private-identity.service.js';
import { FormalAcademyApplicationService } from './formal-academy-application.service.js';
import { PersonalRegistrationTypedRequestApplication } from '../personal/personal-registration-typed-request.application.js';

const valid = () => ({
  academy: { academyName: '  Academia Águilas  ', country: 'CO', city: '11001' },
  organizationType: 'CORPORATION', nit: '900.123.456-7', authorityDeclared: true,
  responsiblePerson: { legalNames: 'Laura', legalSurnames: 'Pérez', documentType: 'CC', documentNumber: '10327392', birthDate: '1990-01-01', country: 'CO', city: '11001', phone: '+57 3000000000' },
  consent: { privacyVersion: 'v1', privacyAccepted: true, truthfulnessAccepted: true },
  evidence: ['RUT', 'EXISTENCE_CERTIFICATE', 'RESPONSIBLE_AUTHORITY'],
  operationInstant: new Date('2026-09-24T18:00:00Z'),
});

describe('FormalAcademyApplicationService', () => {
  it('accepts normalized institutional identity, adult responsible contact, authority, consent and exact formal evidence', async () => {
    await expect(new FormalAcademyApplicationService().validate(valid())).resolves.toEqual({
      complete: true, academyOperable: false, grantedRoles: [], normalizedAcademyName: 'ACADEMIA AGUILAS', normalizedNit: '9001234567',
    });
  });

  it.each([
    ['missing phone', (draft: ReturnType<typeof valid>) => { delete (draft.responsiblePerson as { phone?: string }).phone; }],
    ['minor responsible', (draft: ReturnType<typeof valid>) => { draft.responsiblePerson.birthDate = '2012-01-01'; }],
    ['missing authority', (draft: ReturnType<typeof valid>) => { draft.authorityDeclared = false; }],
    ['wrong evidence', (draft: ReturnType<typeof valid>) => { draft.evidence = ['RUT', 'OPERATION_PROOF']; }],
    ['natural-person fields', (draft: ReturnType<typeof valid> & Record<string, unknown>) => { draft.operationDeclared = true; draft.proofCategories = ['RUT']; }],
  ])('rejects %s without creating academy privilege', async (_label, mutate) => {
    const draft = valid(); mutate(draft);
    await expect(new FormalAcademyApplicationService().validate(draft)).resolves.toEqual({ complete: false, code: 'INVALID_FORMAL_ACADEMY_DRAFT', academyOperable: false, grantedRoles: [] });
  });

  it('persists only a pending registration aggregate and grants no academy capability', async () => {
    const keys = { documentHmacKey: Buffer.alloc(32, 1), nameDobHmacKey: Buffer.alloc(32, 2), privateEncryptionKey: Buffer.alloc(32, 3) };
    const createTypedDraft = vi.fn().mockResolvedValue({ id: 'request', status: 'DRAFT', version: 0 });
    const tx = { registrationRequestApplicant: { updateMany: vi.fn() }, registrationConsentRecord: { createMany: vi.fn() } };
    const application = new PersonalRegistrationTypedRequestApplication(
      { $transaction: (operation: (client: typeof tx) => unknown) => operation(tx) } as never,
      { createTypedDraft } as never,
      { create: vi.fn().mockResolvedValue({ outcome: 'created', identityId: '22222222-2222-4222-8222-222222222222' }) } as never,
      {} as never,
      new PrivateIdentityService(keys),
      {} as never, {} as never, new FormalAcademyApplicationService(), keys,
    );
    const input = valid();
    const result = await application.create({ type: 'FORMAL_ACADEMY', payload: {
      credentials: { email: 'responsible@example.test', password: 'long-password-123', passwordConfirmation: 'long-password-123' },
      academy: { ...input.academy, responsiblePerson: input.responsiblePerson }, organizationType: input.organizationType, nit: input.nit,
      authorityDeclared: true, consent: input.consent,
    } });
    expect(result).toMatchObject({ outcome: 'created' });
    expect(createTypedDraft).toHaveBeenCalledWith(expect.objectContaining({ type: 'FORMAL_ACADEMY' }));
    expect(createTypedDraft.mock.calls[0]?.[0]).not.toHaveProperty('ownerIdentityId');
    expect(JSON.stringify(createTypedDraft.mock.calls)).not.toMatch(/ACADEMY_USER|membership|academyContextId/i);
  });
});
