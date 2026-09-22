import { describe, expect, it } from 'vitest';

import {
  toPassportListResponse,
  toPassportPresentationResponse,
  toPassportStatusResponse,
  toPassportSummaryResponse,
} from '../../src/player-passport/http/passport-presentation-mapper.js';
import { mapOrdinaryPassportHistory } from '../../src/player-passport/presentation/passport-history.mapper.js';

const CANARIES = [
  'T106-DOCUMENT-TYPE', 'T106-DOCUMENT-NUMBER', '2008-09-21', 'T106-REPRESENTATIVE-CONFIRMATION',
  'T106-CONTACT@example.test', 'T106-ACCESS-TOKEN', 'T106-REFRESH-TOKEN', '4.6097,-74.0817',
  'https://media.example.test/t106-player.jpg',
] as const;

function expectNoCanaries(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const canary of CANARIES) expect(serialized).not.toContain(canary);
}

describe('T106 backend public passport secret safety', () => {
  const contaminated = {
    id: '76000000-0000-4000-8000-000000000001', state: 'DRAFT' as const, originKind: 'PARTICULAR' as const,
    position: 'Defensa', ageCategory: 'Sub-17', city: 'Bogota', country: 'Colombia', dominantFoot: 'RIGHT' as const,
    version: 1, createdAt: new Date('2026-09-21T12:00:00Z'), updatedAt: new Date('2026-09-21T12:00:00Z'), displayName: 'Jugador sintetico', academyOriginName: null,
    documentType: CANARIES[0], documentNumber: CANARIES[1], dateOfBirth: CANARIES[2], representativeConfirmation: CANARIES[3],
    contact: CANARIES[4], accessToken: CANARIES[5], refreshToken: CANARIES[6], preciseLocation: CANARIES[7], mediaReference: CANARIES[8],
  };

  it('projects status, list and presentation DTOs from an allowlist only', () => {
    const status = toPassportStatusResponse(contaminated, ['EDIT', 'SUBMIT', 'VIEW_HISTORY']);
    const summary = toPassportSummaryResponse(contaminated, ['EDIT', 'SUBMIT', 'VIEW_HISTORY']);
    const list = toPassportListResponse([summary], ['create'], 'PARTICULAR');
    const presentation = toPassportPresentationResponse(contaminated, []);
    for (const output of [status, list, presentation]) expectNoCanaries(output);
    expect(presentation.identity.photograph).toEqual({ state: 'NEUTRAL_LOCAL_PLACEHOLDER' });
    expect(JSON.stringify(presentation)).not.toMatch(/(?:photo|media)(?:Url|Uri|Id|Reference)|latitude|longitude|address/i);
  });

  it('removes internal duplicate events and protected details from ordinary history', () => {
    const ordinary = mapOrdinaryPassportHistory([
      { id: '76000000-0000-4000-8000-000000000002', action: 'CREATED', outcome: 'APPLIED', actorIdentityId: '76000000-0000-4000-8000-000000000003', details: Object.fromEntries(CANARIES.map((value, index) => [`secret${index}`, value])), createdAt: new Date('2026-09-21T12:00:00Z') },
      { id: '76000000-0000-4000-8000-000000000004', action: 'POSSIBLE_DUPLICATE_DETECTED', outcome: 'APPLIED', details: { candidate: CANARIES[1] }, createdAt: new Date('2026-09-21T12:01:00Z') },
      { id: '76000000-0000-4000-8000-000000000005', action: 'POSSIBLE_DUPLICATE_RESOLVED', outcome: 'APPLIED', details: { resolution: 'DIFFERENT_PLAYERS' }, createdAt: new Date('2026-09-21T12:02:00Z') },
    ]);
    expect(ordinary).toHaveLength(1);
    expect(ordinary[0]).toMatchObject({ action: 'CREATED', outcome: 'APPLIED' });
    expectNoCanaries(ordinary);
    expect(JSON.stringify(ordinary)).not.toMatch(/POSSIBLE_DUPLICATE|details|resolution|candidate/i);
  });
});
