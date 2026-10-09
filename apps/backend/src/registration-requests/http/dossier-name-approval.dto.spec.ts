import { describe, expect, it } from 'vitest';

import { parseApprovalCommand } from './registration-request.dto.js';

const base = { expectedVersion: 2, idempotencyKey: '44444444-4444-4444-8444-444444444444', manualDossierConfirmation: { confirmed: true, dossierName: 'exp-prueba-001', declarationVersion: 'dossier-v1', categories: ['IDENTITY_FRONT'] } };

describe('dossier name in approval command', () => {
  it('accepts the exact entered name in the closed approval DTO', () => {
    expect(parseApprovalCommand(base)).toMatchObject({ ok: true, value: { manualDossierConfirmation: { dossierName: 'exp-prueba-001' } } });
  });

  it.each([undefined, '', '   ', 'x'.repeat(181)])('rejects a missing, empty, or oversized name', (dossierName) => {
    expect(parseApprovalCommand({ ...base, manualDossierConfirmation: { ...base.manualDossierConfirmation, dossierName } }).ok).toBe(false);
  });
});
