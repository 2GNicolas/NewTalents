import { describe, expect, it } from 'vitest';

const modulePath: string = './natural-person-academy-application.service.js';

describe('NaturalPersonAcademyApplicationService contract', () => {
  it('requires operating identity, non-precise location, adult responsible phone, declaration, consent and a unique controlled proof', async () => {
    const { NaturalPersonAcademyApplicationService } = await import(modulePath) as { NaturalPersonAcademyApplicationService: new () => { validate(input: unknown): Promise<unknown> } };
    const service = new NaturalPersonAcademyApplicationService();
    await expect(service.validate({
      academy: { academyName: 'Escuela Comunitaria', country: 'CO', city: '76001', trainingPlace: 'Sector norte' },
      responsiblePerson: { legalNames: 'Luis', legalSurnames: 'Rojas', documentType: 'CC', documentNumber: '10327393', birthDate: '1985-01-01', country: 'CO', city: '76001', phone: '+57 3110000000' },
      operationDeclared: true, proofCategories: ['PLACE_USE_AUTHORIZATION'],
      consent: { privacyVersion: 'v1', privacyAccepted: true, truthfulnessAccepted: true }, evidence: ['OPERATION_PROOF', 'RESPONSIBLE_AUTHORITY'],
    })).resolves.toMatchObject({ complete: true, legalCertificationClaimed: false });
  });

  it('rejects duplicate/uncontrolled proofs and formal-only fields', async () => {
    const { NaturalPersonAcademyApplicationService } = await import(modulePath) as { NaturalPersonAcademyApplicationService: new () => { validate(input: unknown): Promise<unknown> } };
    await expect(new NaturalPersonAcademyApplicationService().validate({ proofCategories: ['RUT', 'RUT'], nit: '900', organizationType: 'CORPORATION' })).resolves.toMatchObject({ complete: false, code: 'INVALID_NATURAL_PERSON_ACADEMY_DRAFT' });
  });
});
