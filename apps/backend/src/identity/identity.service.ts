import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';

export type IdentityContext =
  | Readonly<{ kind: 'active'; id: string }>
  | Readonly<{ kind: 'inactive'; id: string }>
  | Readonly<{ kind: 'unknown' | 'invalid' | 'unavailable' }>;

const opaqueIdentityId = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

@Injectable()
export class IdentityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(): Promise<Extract<IdentityContext, { kind: 'active' }>> {
    const identity = await this.prisma.identity.create({ data: {} });
    return { kind: 'active', id: identity.id };
  }

  async lookup(identityId: unknown): Promise<IdentityContext> {
    if (!opaqueIdentityId(identityId)) return { kind: 'invalid' };

    try {
      const identity = await this.prisma.identity.findUnique({
        where: { id: identityId },
        select: { id: true, status: true },
      });
      if (!identity) return { kind: 'unknown' };
      return identity.status === 'ACTIVE'
        ? { kind: 'active', id: identity.id }
        : { kind: 'inactive', id: identity.id };
    } catch {
      return { kind: 'unavailable' };
    }
  }

  async inactivate(identityId: unknown): Promise<IdentityContext> {
    const current = await this.lookup(identityId);
    if (current.kind !== 'active') return current;

    try {
      const identity = await this.prisma.identity.update({
        where: { id: current.id },
        data: { status: 'INACTIVE', deactivatedAt: new Date() },
        select: { id: true },
      });
      return { kind: 'inactive', id: identity.id };
    } catch {
      return { kind: 'unavailable' };
    }
  }
}
