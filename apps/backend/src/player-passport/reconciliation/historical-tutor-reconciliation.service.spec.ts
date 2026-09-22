import { describe, expect, it, vi } from 'vitest';
import { HistoricalTutorReconciliationService } from './historical-tutor-reconciliation.service.js';

describe('HistoricalTutorReconciliationService', () => {
  it('is explicit, idempotent and does not grant SELF for incomplete facts', async () => {
    const audit = { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ outcome: 'NO_AUTHORITY_GRANTED' }) };
    const service = new HistoricalTutorReconciliationService({ historicalTutorReconciliationAudit: audit } as never);
    await expect(service.reconcile('11111111-1111-4111-8111-111111111111', 'legacy-1', false)).resolves.toMatchObject({ outcome: 'NO_AUTHORITY_GRANTED' });
    expect(audit.create).toHaveBeenCalledOnce();
  });

  it('reuses an existing audit outcome on repeat reconciliation', async () => {
    const existing = { outcome: 'REVIEW_REQUIRED' };
    const audit = { findFirst: vi.fn().mockResolvedValue(existing), create: vi.fn() };
    const service = new HistoricalTutorReconciliationService({ historicalTutorReconciliationAudit: audit } as never);
    await expect(service.reconcile('11111111-1111-4111-8111-111111111111', 'legacy-1', true)).resolves.toBe(existing);
    expect(audit.create).not.toHaveBeenCalled();
  });
});
