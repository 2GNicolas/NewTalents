import { describe, expect, it } from 'vitest';

const modulePath: string = './personal-adult-application.service.js';

describe('PersonalAdultApplicationService contract', () => {
  it('requires adult self-action, privacy/truthfulness and the exact personal evidence set', async () => {
    const { PersonalAdultApplicationService } = await import(modulePath) as { PersonalAdultApplicationService: new (...dependencies: unknown[]) => { validate(input: unknown): Promise<unknown> } };
    const service = new PersonalAdultApplicationService();
    await expect(service.validate({
      person: { legalNames: 'Ana', legalSurnames: 'Pérez', documentType: 'CC', documentNumber: '12345678', birthDate: '2000-01-01', country: 'CO', city: '11001' },
      actingForSelf: true,
      consent: { privacyVersion: 'v1', privacyAccepted: true, truthfulnessAccepted: true },
      evidence: ['IDENTITY_FRONT', 'IDENTITY_BACK'],
      operationInstant: new Date('2026-09-24T18:00:00Z'),
    })).resolves.toMatchObject({ complete: true, applicantIsPlayer: true });
  });

  it('keeps phone optional and rejects client age or Analyst-owned sports fields', async () => {
    const { PersonalAdultApplicationService } = await import(modulePath) as { PersonalAdultApplicationService: new (...dependencies: unknown[]) => { validate(input: unknown): Promise<unknown> } };
    const service = new PersonalAdultApplicationService();
    await expect(service.validate({ person: { birthDate: '2000-01-01' }, isAdult: true, position: 'FORWARD' })).resolves.toMatchObject({ complete: false, code: 'INVALID_PERSONAL_ADULT_DRAFT' });
  });
});
