import { describe, expect, it } from 'vitest';

const modulePath: string = './represented-minor-application.service.js';

describe('RepresentedMinorApplicationService contract', () => {
  const complete = () => ({
    representative: { legalNames: 'Laura', legalSurnames: 'Pérez', documentType: 'CC', documentNumber: '10327392', birthDate: '1990-01-01', country: 'CO', city: '11001', phone: '+57 3000000000' },
    minor: { legalNames: 'Mateo', legalSurnames: 'Pérez', documentType: 'TI', documentNumber: '1000641', birthDate: '2015-01-01', country: 'CO', city: '11001' },
    relationship: 'MOTHER', authorityDeclared: true,
    consent: { privacyVersion: 'v1', privacyAccepted: true, truthfulnessAccepted: true, representationAccepted: true, minorTreatmentAccepted: true },
    evidence: ['IDENTITY_FRONT', 'IDENTITY_BACK', 'MINOR_CIVIL_IDENTITY', 'REPRESENTATION_AUTHORITY'],
    operationInstant: new Date('2026-09-24T18:00:00Z'),
  });
  it('requires an adult representative, phone, controlled relationship, authority, treatment consent and evidence', async () => {
    const { RepresentedMinorApplicationService } = await import(modulePath) as { RepresentedMinorApplicationService: new (...dependencies: unknown[]) => { validate(input: unknown): Promise<unknown> } };
    const service = new RepresentedMinorApplicationService();
    await expect(service.validate({
      representative: { legalNames: 'Laura', legalSurnames: 'Pérez', documentType: 'CC', documentNumber: '10327392', birthDate: '1990-01-01', country: 'CO', city: '11001', phone: '+57 3000000000' },
      minor: { legalNames: 'Mateo', legalSurnames: 'Pérez', documentType: 'TI', documentNumber: '1000641', birthDate: '2015-01-01', country: 'CO', city: '11001' }, relationship: 'MOTHER', authorityDeclared: true,
      consent: { privacyVersion: 'v1', privacyAccepted: true, truthfulnessAccepted: true, representationAccepted: true, minorTreatmentAccepted: true },
      evidence: ['IDENTITY_FRONT', 'IDENTITY_BACK', 'MINOR_CIVIL_IDENTITY', 'REPRESENTATION_AUTHORITY'], operationInstant: new Date('2026-09-24T18:00:00Z'),
    })).resolves.toMatchObject({ complete: true });
  });

  it('never accepts credentials, email, phone or an account for the minor', async () => {
    const { RepresentedMinorApplicationService } = await import(modulePath) as { RepresentedMinorApplicationService: new (...dependencies: unknown[]) => { validate(input: unknown): Promise<unknown> } };
    const service = new RepresentedMinorApplicationService();
    await expect(service.validate({ minor: { email: 'minor@example.com', phone: 'secret', password: 'secret' } })).resolves.toMatchObject({ complete: false, code: 'INVALID_REPRESENTED_MINOR_DRAFT' });
  });

  it.each(complete().evidence)('rejects an otherwise complete request without %s', async (missing) => {
    const { RepresentedMinorApplicationService } = await import(modulePath) as { RepresentedMinorApplicationService: new (...dependencies: unknown[]) => { validate(input: unknown): Promise<unknown> } };
    const service = new RepresentedMinorApplicationService();
    await expect(service.validate({ ...complete(), evidence: complete().evidence.filter((category) => category !== missing) })).resolves.toMatchObject({ complete: false, code: 'INVALID_REPRESENTED_MINOR_DRAFT' });
  });
});
