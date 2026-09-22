import { describe, expect, it } from 'vitest';
import { mapInternalPassportHistory, mapOrdinaryPassportHistory } from './passport-history.mapper.js';

describe('passport history projections', () => {
  const events = [
    { action: 'CREATED', outcome: 'APPLIED', details: { document: 'secret' }, createdAt: new Date('2026-01-01') },
    { action: 'POSSIBLE_DUPLICATE_RESOLVED', outcome: 'APPLIED', details: { resolution: 'DIFFERENT_PLAYERS', candidateId: 'secret' }, createdAt: new Date('2026-01-02') },
  ];
  it('removes duplicate detection details from ordinary history', () => {
    const result = mapOrdinaryPassportHistory(events);
    expect(result).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('secret');
  });
  it('retains only the redacted resolution for internal history', () => {
    const result = mapInternalPassportHistory(events);
    expect(result[1]).toMatchObject({ action: 'POSSIBLE_DUPLICATE_RESOLVED', resolution: 'DIFFERENT_PLAYERS' });
    expect(JSON.stringify(result)).not.toContain('candidateId');
    expect(JSON.stringify(result)).not.toContain('document');
  });
});
