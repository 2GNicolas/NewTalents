import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import type { RegistrationEvidenceCategory } from '../../generated/prisma/client.js';

export type EvidenceAccessOutcome = 'STREAMED' | 'DENIED' | 'NOT_FOUND' | 'UNAVAILABLE';

@Injectable()
export class EvidenceAccessAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: Readonly<{ requestId: string; evidenceItemId: string; actorIdentityId: string; category: RegistrationEvidenceCategory; outcome: EvidenceAccessOutcome }>): Promise<void> {
    await this.prisma.registrationEvidenceAccessAudit.create({ data: input });
  }
}
