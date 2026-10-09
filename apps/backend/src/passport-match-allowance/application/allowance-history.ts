import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { AdministratorAllowanceAuthorization } from './administrator-allowance-authorization.js';

type Cursor = Readonly<{ sequence: number; id: string }>;

@Injectable()
export class AllowanceHistory {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AdministratorAllowanceAuthorization) {}

  async list(input: Readonly<{ administratorId: string; passportId: string; limit: number; cursor?: string }>) {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50) return { outcome: 'invalid-query' as const };
    const cursor = input.cursor ? decodeCursor(input.cursor) : undefined;
    if (input.cursor && !cursor) return { outcome: 'invalid-query' as const };
    const passport = await this.prisma.playerPassport.findUnique({ where: { id: input.passportId }, select: { state: true } });
    const decision = await this.authorization.authorize(input.administratorId, 'passport.allowance.history', {
      exists: Boolean(passport), active: passport?.state === 'ACTIVE',
    });
    if (!decision.allowed || !passport) return { outcome: 'not-found' as const };
    const allowance = await this.prisma.passportMatchAllowance.findUnique({ where: { passportId: input.passportId }, select: { id: true } });
    if (!allowance) return { items: [], nextCursor: null };
    const rows = await this.prisma.passportMatchAllowanceRevision.findMany({
      where: { allowanceId: allowance.id, ...(cursor ? { sequence: { lt: cursor.sequence } } : {}) },
      orderBy: [{ sequence: 'desc' }, { id: 'desc' }], take: input.limit + 1,
      select: { id: true, sequence: true, cadence: true, matchLimit: true, effectiveOn: true,
        confirmedAt: true, previousCadence: true, previousMatchLimit: true, previousEffectiveOn: true },
    });
    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    return { items: page.map((row) => ({ sequence: row.sequence, confirmedAt: row.confirmedAt.toISOString(),
      actorLabel: 'Administrador de New Talents', effectiveOn: dateOnly(row.effectiveOn),
      previousRule: row.previousCadence && row.previousMatchLimit !== null && row.previousEffectiveOn
        ? { cadence: row.previousCadence, matchLimit: Number(row.previousMatchLimit), effectiveOn: dateOnly(row.previousEffectiveOn) } : null,
      newRule: { cadence: row.cadence, matchLimit: Number(row.matchLimit), effectiveOn: dateOnly(row.effectiveOn) },
    })), nextCursor: rows.length > input.limit && last ? encodeCursor({ sequence: last.sequence, id: last.id }) : null };
  }
}

function dateOnly(value: Date): string { return value.toISOString().slice(0, 10); }
function encodeCursor(value: Cursor): string { return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url'); }
function decodeCursor(value: string): Cursor | null {
  try {
    const candidate = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
    return Number.isSafeInteger(candidate.sequence) && Number(candidate.sequence) > 0 && typeof candidate.id === 'string' && candidate.id.length > 0
      ? { sequence: Number(candidate.sequence), id: candidate.id } : null;
  } catch { return null; }
}
