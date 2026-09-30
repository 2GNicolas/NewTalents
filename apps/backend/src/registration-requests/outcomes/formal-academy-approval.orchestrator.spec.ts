import { describe, expect, it } from 'vitest';

const modulePath: string = './formal-academy-approval.orchestrator.js';

describe('FormalAcademyApprovalOrchestrator contract', () => {
  it('atomically creates one Academy, enables only ACADEMY_USER, membership and responsible relationship', async () => {
    const { FormalAcademyApprovalOrchestrator } = await import(modulePath) as { FormalAcademyApprovalOrchestrator: new (...dependencies: unknown[]) => { approve(input: unknown): Promise<unknown> } };
    await expect(new FormalAcademyApprovalOrchestrator().approve({ requestId: '11111111-1111-4111-8111-111111111111', expectedVersion: 1 })).resolves.toMatchObject({ outcome: 'approved', academyCount: 1, responsibleRoles: ['ACADEMY_USER'], membership: 'ACTIVE', responsibleRelationship: 'ACTIVE' });
  });
});
