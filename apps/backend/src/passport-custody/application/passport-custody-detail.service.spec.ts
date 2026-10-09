import { describe, expect, it, vi } from 'vitest';

import { PassportCustodyDetailService } from './passport-custody-detail.service.js';

describe('PassportCustodyDetailService authorized names', () => {
  it('projects the authorized player and dossier label on available links without protected fields', async () => {
    const prisma = {
      playerPassport: { findFirst: vi.fn().mockResolvedValue({
        id: '10000000-0000-4000-8000-000000000001', playerId: '20000000-0000-4000-8000-000000000002', state: 'ACTIVE',
        enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT', createdAt: new Date('2026-09-30T08:00:00.000Z'),
        player: { privateIdentity: { encryptedLegalName: 'cipher:Valentina Pérez' } }, originAcademy: null, custody: null, custodyEvents: [],
      }) },
      registrationRequestPlayer: { findFirst: vi.fn().mockResolvedValue({ request: {
        id: '30000000-0000-4000-8000-000000000003', status: 'APPROVED', dossierConfirmations: [{ id: '40000000-0000-4000-8000-000000000004' }],
      } }) },
      passportCustody: { count: vi.fn() },
    };
    const service = new PassportCustodyDetailService(prisma as never, { decrypt: (value: string) => value.replace('cipher:', '') });

    const result = await service.get('10000000-0000-4000-8000-000000000001');

    expect(result).toMatchObject({ outcome: 'found', detail: {
      displayLabel: 'Valentina Pérez',
      originRequest: { displayLabel: 'Valentina Pérez', available: true },
      linkedDossier: { displayLabel: 'Valentina Pérez', available: true },
    } });
    expect(JSON.stringify(result)).not.toMatch(/encryptedLegalName|document|email|phone|credential/i);
  });
});
