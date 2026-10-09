import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { mapAdministratorRegistrationHistory, mapApplicantRegistrationHistory, type RegistrationHistoryProjection } from './registration-request-history.mapper.js';

@Injectable()
export class RegistrationRequestHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async applicantHistory(requestId: string): Promise<readonly RegistrationHistoryProjection[]> {
    return (await this.load(requestId)).map(mapApplicantRegistrationHistory);
  }

  async administratorHistory(requestId: string): Promise<readonly RegistrationHistoryProjection[]> {
    return (await this.load(requestId)).map(mapAdministratorRegistrationHistory);
  }

  private load(requestId: string) {
    return this.prisma.registrationRequestEvent.findMany({
      where: { requestId }, orderBy: { sequence: 'asc' },
      select: { actorIdentityId: true, action: true, priorStatus: true, resultingStatus: true, outcome: true, safeCategory: true, createdAt: true },
    });
  }
}
