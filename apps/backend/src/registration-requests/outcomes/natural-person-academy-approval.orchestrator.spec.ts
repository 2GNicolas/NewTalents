import { describe, expect, it } from 'vitest';

const modulePath: string = './natural-person-academy-approval.orchestrator.js';

describe('NaturalPersonAcademyApprovalOrchestrator contract', () => {
  it('creates the bounded academy outcome without claiming legal certification', async () => {
    const { NaturalPersonAcademyApprovalOrchestrator } = await import(modulePath) as { NaturalPersonAcademyApprovalOrchestrator: new (...dependencies: unknown[]) => { approve(input: unknown): Promise<unknown> } };
    await expect(new NaturalPersonAcademyApprovalOrchestrator().approve({ requestId: '11111111-1111-4111-8111-111111111111', expectedVersion: 1 })).resolves.toMatchObject({ outcome: 'approved', academyCount: 1, responsibleRoles: ['ACADEMY_USER'], membership: 'ACTIVE', legalCertificationClaimed: false });
  });
});
