import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import type { PassportLifecycleState } from '../../generated/prisma/client.js';

export type AdminPassportCursor = Readonly<{ createdAt: Date; id: string }>;
export type AdminPassportRow = Readonly<{
  id: string;
  createdAt: Date;
  state: PassportLifecycleState;
  encryptedLegalName: string | null;
}>;

@Injectable()
export class AdminPassportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: Readonly<{ take: number; cursor?: AdminPassportCursor }>): Promise<Readonly<{ rows: readonly AdminPassportRow[]; hasMore: boolean }>> {
    const rows = await this.prisma.playerPassport.findMany({
      ...(input.cursor ? { where: { OR: [
        { createdAt: { lt: input.cursor.createdAt } },
        { createdAt: input.cursor.createdAt, id: { lt: input.cursor.id } },
      ] } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.take + 1,
      select: { id: true, createdAt: true, state: true,
        player: { select: { privateIdentity: { select: { encryptedLegalName: true } } } } },
    });
    return { hasMore: rows.length > input.take, rows: rows.slice(0, input.take).map((row) => ({
      id: row.id, createdAt: row.createdAt, state: row.state,
      encryptedLegalName: row.player.privateIdentity?.encryptedLegalName ?? null,
    })) };
  }

  async find(passportId: string): Promise<AdminPassportRow | null> {
    const row = await this.prisma.playerPassport.findUnique({ where: { id: passportId },
      select: { id: true, createdAt: true, state: true,
        player: { select: { privateIdentity: { select: { encryptedLegalName: true } } } } } });
    return row ? { id: row.id, createdAt: row.createdAt, state: row.state,
      encryptedLegalName: row.player.privateIdentity?.encryptedLegalName ?? null } : null;
  }
}
