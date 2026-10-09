import { describe, expect, it } from 'vitest';

const modulePath: string = './academy-duplicate.service.js';

describe('AcademyDuplicateService contract', () => {
  it('normalizes name/NIT/responsible identity and returns only a generic exact-conflict result', async () => {
    const { AcademyDuplicateService } = await import(modulePath) as { AcademyDuplicateService: new (...dependencies: unknown[]) => { inspect(input: unknown): Promise<unknown> } };
    const service = new AcademyDuplicateService();
    await expect(service.inspect({ academyName: ' Academia Águilas ', nit: '900.123.456-7', responsibleDocument: '10', exactAcademyExists: true })).resolves.toEqual({ outcome: 'conflict', code: 'REGISTRATION_CONFLICT' });
  });

  it('keeps non-conclusive similarity private and exposes no candidate fields', async () => {
    const { AcademyDuplicateService } = await import(modulePath) as { AcademyDuplicateService: new (...dependencies: unknown[]) => { inspect(input: unknown): Promise<unknown> } };
    const result = await new AcademyDuplicateService().inspect({ academyName: 'Academia Aguilas', responsibleDocument: '11', similarAcademyExists: true });
    expect(result).toEqual({ outcome: 'clear' });
    expect(JSON.stringify(result)).not.toMatch(/candidate|fingerprint|document|academyName|reason/i);
  });
});
