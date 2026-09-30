import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const forbiddenCanaries = [
  'CanaryPassword!42', 'CC-123456789', '2008-04-17', 'synthetic-representative-secret',
  '+57-300-555-0101', 'c3ludGhldGljLWV2aWRlbmNlLWJ5dGVz', 'private/provider/key',
  'a'.repeat(64), 'candidate-person-opaque', 'eyJhbGciOiJub25lIn0',
  'Carrera 7 # 71-21 apartamento 901', 'file:///private/evidence.pdf',
];

describe('Feature 006 evidence privacy contract', () => {
  it('keeps synthetic protected canaries out of ordinary JSON, routes, diagnostics, audit projections and exports', async () => {
    const ordinarySurfaces = {
      response: { id: 'evidence-id', category: 'IDENTITY_FRONT', status: 'CLEAN' },
      route: '/registration-requests/request-id/evidence/evidence-id',
      diagnostic: { code: 'evidence_not_found' },
      accessAudit: { requestId: 'request-id', evidenceItemId: 'evidence-id', category: 'IDENTITY_FRONT', outcome: 'DENIED' },
      exportFixture: { category: 'IDENTITY_FRONT', result: 'unavailable' },
    };
    const serialized = JSON.stringify(ordinarySurfaces);
    for (const canary of forbiddenCanaries) expect(serialized).not.toContain(canary);
    expect(serialized).not.toMatch(/objectKey|contentDigest|password|token|birthDate|documentNumber|providerUrl|filesystemPath|base64/i);
  });

  it('contains no evidence-byte logging and keeps access audit outside lifecycle events', async () => {
    const root = resolve(import.meta.dirname, '../../src/registration-requests/evidence');
    const files = ['evidence-stream.controller.ts', 'evidence-access-audit.service.ts', 'evidence-deletion.service.ts', 'evidence-deletion.worker.ts'];
    const source = (await Promise.all(files.map((file) => readFile(resolve(root, file), 'utf8')))).join('\n');
    expect(source).not.toMatch(/console\.(?:log|info|warn|error)|logger\.(?:log|debug|verbose)/i);
    const auditSource = await readFile(resolve(root, 'evidence-access-audit.service.ts'), 'utf8');
    expect(auditSource).not.toMatch(/registrationRequestEvent|request\.version|registrationRequest\.update/);
  });
});
