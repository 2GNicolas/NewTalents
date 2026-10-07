import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';

export type AnalystOperationalProfile = Readonly<{
  identityId: string;
  displayLabel: string;
  normalizedLabel: string;
}>;

export type AnalystOperationalProfileProvisionResult =
  | Readonly<{ outcome: 'provisioned' | 'updated' | 'unchanged'; profile: AnalystOperationalProfile }>
  | Readonly<{ outcome: 'invalid-label' | 'ineligible' | 'unavailable' }>;

export type AnalystOperationalProfileLookupResult =
  | Readonly<{ outcome: 'available'; profile: AnalystOperationalProfile }>
  | Readonly<{ outcome: 'unavailable' }>;

const opaqueIdentityId = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const safeLabel = (value: unknown): Readonly<{ displayLabel: string; normalizedLabel: string }> | null => {
  if (typeof value !== 'string') return null;
  const displayLabel = value.trim().replace(/\s+/g, ' ');
  if (displayLabel.length === 0 || displayLabel.length > 120) return null;
  if (/[\u0000-\u001f\u007f@]/u.test(displayLabel) || /\d{6,}/u.test(displayLabel)) return null;
  if (/\b(?:password|contrase(?:n|ñ)a|credential|credencial|token|documento?)\b/iu.test(displayLabel)) return null;
  const normalizedLabel = displayLabel
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CO');
  return { displayLabel, normalizedLabel };
};

@Injectable()
export class AnalystOperationalProfileService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async provision(input: Readonly<{ identityId: unknown; displayLabel: unknown }>): Promise<AnalystOperationalProfileProvisionResult> {
    const label = safeLabel(input.displayLabel);
    if (!label) return { outcome: 'invalid-label' };
    if (!opaqueIdentityId(input.identityId)) return { outcome: 'ineligible' };

    try {
      if (!await this.eligible(input.identityId)) return { outcome: 'ineligible' };
      const existing = await this.prisma.analystOperationalProfile.findUnique({
        where: { identityId: input.identityId },
        select: { identityId: true, displayLabel: true, normalizedLabel: true },
      });
      if (existing?.displayLabel === label.displayLabel && existing.normalizedLabel === label.normalizedLabel) {
        return { outcome: 'unchanged', profile: existing };
      }
      const profile = await this.prisma.analystOperationalProfile.upsert({
        where: { identityId: input.identityId },
        create: { identityId: input.identityId, ...label },
        update: label,
        select: { identityId: true, displayLabel: true, normalizedLabel: true },
      });
      return { outcome: existing ? 'updated' : 'provisioned', profile };
    } catch {
      return { outcome: 'unavailable' };
    }
  }

  async lookup(identityId: unknown): Promise<AnalystOperationalProfileLookupResult> {
    if (!opaqueIdentityId(identityId)) return { outcome: 'unavailable' };
    try {
      if (!await this.eligible(identityId)) return { outcome: 'unavailable' };
      const profile = await this.prisma.analystOperationalProfile.findUnique({
        where: { identityId },
        select: { identityId: true, displayLabel: true, normalizedLabel: true },
      });
      return profile ? { outcome: 'available', profile } : { outcome: 'unavailable' };
    } catch {
      return { outcome: 'unavailable' };
    }
  }

  private async eligible(identityId: string): Promise<boolean> {
    const identity = await this.prisma.identity.findUnique({
      where: { id: identityId },
      select: {
        id: true,
        status: true,
        roleAssignments: {
          where: { role: 'ANALYST', status: 'ACTIVE' },
          select: { id: true },
          take: 1,
        },
      },
    });
    return identity?.status === 'ACTIVE' && identity.roleAssignments.length === 1;
  }
}
