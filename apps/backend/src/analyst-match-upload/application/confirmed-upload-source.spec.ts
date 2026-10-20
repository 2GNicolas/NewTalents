import { describe, expect, it } from 'vitest';

import { ConfirmedUploadSources, Feature009UploadSource, type UploadSource } from './confirmed-upload-source.js';

const match = { id: '00000000-0000-4000-8000-000000000001', passportId: '00000000-0000-4000-8000-000000000002',
  playerId: '00000000-0000-4000-8000-000000000003', version: 1, state: 'WAITING' as const,
  unitState: 'RESERVED' as const, sourceKind: 'FIRST_MATCH' as const };

describe('Feature 011 source boundary', () => {
  it('enables only an authoritative WAITING/RESERVED first match by ID, not by ordinal', () => {
    const sources = new ConfirmedUploadSources();
    expect(sources.forMatch(match)).toEqual({ sourceKind: 'FIRST_MATCH', availability: 'AVAILABLE', expectedVersion: 1 });
    expect(sources.forMatch({ ...match, state: 'LOADED', unitState: 'USED' })).toEqual({
      sourceKind: 'FIRST_MATCH', availability: 'UNAVAILABLE',
    });
    expect(sources.forMatch({ ...match, state: 'CANCELED', unitState: 'RELEASED' })).toBeNull();
  });

  it('keeps future sources as an interface without registering invented matches', () => {
    const future: UploadSource = { kind: 'TEST_ONLY_LATER_MATCH', eligibility: () => ({
      sourceKind: 'TEST_ONLY_LATER_MATCH', availability: 'AVAILABLE', expectedVersion: 1,
    }) };
    expect(future.eligibility(match)?.availability).toBe('AVAILABLE');
    const registry = new ConfirmedUploadSources();
    expect(registry.registeredKinds).toEqual(['FIRST_MATCH']);
    expect(registry.resolve('TEST_ONLY_LATER_MATCH')).toBeUndefined();
    expect(new Feature009UploadSource().kind).toBe('FIRST_MATCH');
  });
});
