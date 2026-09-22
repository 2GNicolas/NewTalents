import { Injectable } from '@nestjs/common';
import type { PassportResponsibilityKind } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class PassportResponsibilityService {
  public constructor(private readonly prisma: PrismaService) {}

  public async createSelf(passportId: string, identityId: string) {
    const existing = await this.prisma.passportResponsibility.findFirst({ where: { identityId, kind: 'SELF' } });
    if (existing) throw new Error('IDENTITY_ALREADY_HAS_SELF_RESPONSIBILITY');
    return this.prisma.passportResponsibility.create({ data: { passportId, identityId, kind: 'SELF' } });
  }

  public async createLegalRepresentative(passportId: string, identityId: string) {
    return this.prisma.passportResponsibility.create({ data: { passportId, identityId, kind: 'LEGAL_REPRESENTATIVE' } });
  }

  public async createAcademy(passportId: string, academyId: string) {
    return this.prisma.passportResponsibility.create({ data: { passportId, academyId, kind: 'ACADEMY' } });
  }

  public async list(passportId: string): Promise<ReadonlyArray<{ kind: PassportResponsibilityKind; identityId: string | null; academyId: string | null }>> {
    return this.prisma.passportResponsibility.findMany({ where: { passportId }, select: { kind: true, identityId: true, academyId: true } });
  }
}
