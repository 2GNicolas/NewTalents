import { Inject, Injectable } from '@nestjs/common';

import {
  PassportCustodyRepository,
  type AnalystCursor,
  type EligibleAnalystRow,
  type PassportAssignmentFilter,
  type PassportCandidate,
  type PassportCandidateCursor,
} from '../persistence/passport-custody.repository.js';

export const PASSPORT_CUSTODY_LABEL_DECRYPTOR = Symbol('PASSPORT_CUSTODY_LABEL_DECRYPTOR');
export type PassportCustodyLabelDecryptor = Readonly<{ decrypt: (ciphertext: string) => string }>;

export type CustodyPassportSummary = Readonly<{
  passportId: string;
  maskedReference: string;
  displayLabel: string;
  lifecycleState: 'ACTIVE';
  enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT';
  academyLabel?: string;
  custody: Readonly<{
    state: 'UNASSIGNED' | 'ASSIGNED';
    version: number;
    analyst?: Readonly<{ identityId: string; displayLabel: string; activeCustodyCount: number }>;
    assignedAt?: string;
  }>;
  capabilities: readonly ('ASSIGN' | 'CHANGE' | 'REMOVE')[];
}>;

type Page<T> = Readonly<{ items: readonly T[]; nextCursor?: string }>;
type QueryFailure = Readonly<{ outcome: 'invalid-cursor' | 'unavailable' }>;
const PASSPORT_SCAN_SIZE = 20;

@Injectable()
export class PassportCustodyQueryService {
  constructor(
    private readonly repository: PassportCustodyRepository,
    @Inject(PASSPORT_CUSTODY_LABEL_DECRYPTOR) private readonly labels: PassportCustodyLabelDecryptor,
  ) {}

  async listPassports(input: Readonly<{
    assignment: PassportAssignmentFilter;
    analystId?: string;
    query?: string;
    cursor?: string;
    limit: number;
  }>): Promise<Page<CustodyPassportSummary> | QueryFailure> {
    const initialCursor = input.cursor ? decodeCursor<PassportCandidateCursor>(input.cursor, 'passport') : undefined;
    if (input.cursor && !initialCursor) return { outcome: 'invalid-cursor' };
    const needle = normalize(input.query);
    const items: CustodyPassportSummary[] = [];
    let cursor = initialCursor;
    try {
      while (items.length < input.limit) {
        const page = await this.repository.listPassportCandidates({
          state: 'ACTIVE',
          enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT',
          assignment: input.assignment,
          ...(input.analystId ? { analystId: input.analystId } : {}),
          ...(cursor ? { cursor } : {}),
          take: Math.max(PASSPORT_SCAN_SIZE, input.limit),
        });
        for (let index = 0; index < page.rows.length; index += 1) {
          const row = page.rows[index]!;
          cursor = { createdAt: row.createdAt, id: row.id };
          const projected = this.projectPassport(row);
          if (!projected) continue;
          if (!needle || normalize(projected.displayLabel).includes(needle) || normalize(projected.maskedReference).includes(needle)) items.push(projected);
          if (items.length === input.limit) {
            const hasMore = index < page.rows.length - 1 || page.hasMore;
            return { items: Object.freeze(items), ...(hasMore ? { nextCursor: encodeCursor('passport', cursor) } : {}) };
          }
        }
        if (!page.hasMore || page.rows.length === 0) return { items: Object.freeze(items) };
      }
      return { items: Object.freeze(items) };
    } catch {
      return { outcome: 'unavailable' };
    }
  }

  async listAnalysts(input: Readonly<{ query?: string; cursor?: string; limit: number }>): Promise<Page<Readonly<{ identityId: string; displayLabel: string; activeCustodyCount: number }>> | QueryFailure> {
    const cursor = input.cursor ? decodeCursor<AnalystCursor>(input.cursor, 'analyst') : undefined;
    if (input.cursor && !cursor) return { outcome: 'invalid-cursor' };
    try {
      const page = await this.repository.listEligibleAnalysts({
        ...(input.query ? { query: normalize(input.query) } : {}),
        ...(cursor ? { cursor } : {}),
        take: input.limit,
      });
      const items = Object.freeze(page.rows.map(projectAnalyst));
      const last = page.rows.at(-1);
      return { items, ...(page.hasMore && last ? { nextCursor: encodeCursor('analyst', { normalizedLabel: last.normalizedLabel, identityId: last.identityId }) } : {}) };
    } catch {
      return { outcome: 'unavailable' };
    }
  }

  private projectPassport(row: PassportCandidate): CustodyPassportSummary | null {
    let displayLabel: string;
    try { displayLabel = this.labels.decrypt(row.encryptedLegalName).trim(); } catch { return null; }
    if (!displayLabel) return null;
    const suffix = row.id.slice(-4).toUpperCase();
    const profile = row.custody?.currentAnalyst;
    const assigned = Boolean(profile);
    return Object.freeze({
      passportId: row.id,
      maskedReference: `PAS-\u2022\u2022\u2022\u2022-${suffix}`,
      displayLabel,
      lifecycleState: 'ACTIVE',
      enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT',
      ...(row.academyLabel ? { academyLabel: row.academyLabel } : {}),
      custody: assigned && row.custody && profile ? Object.freeze({
        state: 'ASSIGNED' as const,
        version: row.custody.version,
        analyst: Object.freeze({ identityId: profile.identityId, displayLabel: profile.displayLabel, activeCustodyCount: row.custody.activeCustodyCount }),
        ...(row.custody.assignedAt ? { assignedAt: row.custody.assignedAt.toISOString() } : {}),
      }) : Object.freeze({ state: 'UNASSIGNED' as const, version: row.custody?.version ?? 0 }),
      capabilities: Object.freeze(assigned ? ['CHANGE', 'REMOVE'] as const : ['ASSIGN'] as const),
    });
  }
}

function projectAnalyst(row: EligibleAnalystRow) {
  return Object.freeze({ identityId: row.identityId, displayLabel: row.displayLabel, activeCustodyCount: row.activeCustodyCount });
}

function normalize(value?: string): string {
  return (value ?? '').trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-CO');
}

function encodeCursor(kind: 'passport' | 'analyst', cursor: PassportCandidateCursor | AnalystCursor): string {
  const serializable = 'createdAt' in cursor ? { ...cursor, createdAt: cursor.createdAt.toISOString() } : cursor;
  return Buffer.from(JSON.stringify({ kind, cursor: serializable }), 'utf8').toString('base64url');
}

function decodeCursor<T extends PassportCandidateCursor | AnalystCursor>(value: string, kind: 'passport' | 'analyst'): T | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as { kind?: unknown; cursor?: Record<string, unknown> };
    if (parsed.kind !== kind || !parsed.cursor) return null;
    if (kind === 'passport') {
      const createdAt = new Date(String(parsed.cursor.createdAt));
      return (!Number.isNaN(createdAt.valueOf()) && typeof parsed.cursor.id === 'string' ? { createdAt, id: parsed.cursor.id } : null) as T | null;
    }
    return (typeof parsed.cursor.normalizedLabel === 'string' && typeof parsed.cursor.identityId === 'string'
      ? { normalizedLabel: parsed.cursor.normalizedLabel, identityId: parsed.cursor.identityId }
      : null) as T | null;
  } catch { return null; }
}
