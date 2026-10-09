import { Inject, Injectable } from '@nestjs/common';

import { AdministratorAllowanceAuthorization } from './administrator-allowance-authorization.js';
import { AdminPassportsRepository, type AdminPassportCursor, type AdminPassportRow } from '../persistence/admin-passports.repository.js';

export const ADMIN_PASSPORT_LABEL_DECRYPTOR = Symbol('ADMIN_PASSPORT_LABEL_DECRYPTOR');
export type AdminPassportLabelDecryptor = Readonly<{ decrypt: (ciphertext: string) => string }>;

@Injectable()
export class AdminPassportsQuery {
  constructor(
    private readonly repository: AdminPassportsRepository,
    private readonly authorization: AdministratorAllowanceAuthorization,
    @Inject(ADMIN_PASSPORT_LABEL_DECRYPTOR) private readonly labels: AdminPassportLabelDecryptor,
  ) {}

  async list(input: Readonly<{ administratorId: string; limit: number; cursor?: string }>) {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50) return { outcome: 'invalid-query' as const };
    const cursor = input.cursor ? decodeCursor(input.cursor) : undefined;
    if (input.cursor && !cursor) return { outcome: 'invalid-query' as const };
    if (!(await this.authorization.authorize(input.administratorId, 'passport.allowance.list')).allowed) return { outcome: 'denied' as const };
    const page = await this.repository.list({ take: input.limit, ...(cursor ? { cursor } : {}) });
    const items = page.rows.map((row) => this.project(row));
    const last = page.rows.at(-1);
    return { items, ...(page.hasMore && last ? { nextCursor: encodeCursor({ createdAt: last.createdAt, id: last.id }) } : {}) };
  }

  async detail(input: Readonly<{ administratorId: string; passportId: string }>) {
    if (!(await this.authorization.authorize(input.administratorId, 'passport.allowance.list')).allowed) return { outcome: 'not-found' as const };
    const row = await this.repository.find(input.passportId);
    if (!(await this.authorization.authorize(input.administratorId, 'passport.allowance.view', {
      exists: Boolean(row), active: row?.state === 'ACTIVE',
    })).allowed || !row) return { outcome: 'not-found' as const };
    return this.project(row);
  }

  private project(row: AdminPassportRow) {
    let playerLabel = 'Nombre no disponible';
    try { if (row.encryptedLegalName) playerLabel = this.labels.decrypt(row.encryptedLegalName).trim() || playerLabel; } catch { /* Safe fallback. */ }
    return Object.freeze({
      passportId: row.id,
      playerLabel,
      maskedReference: `PAS-••••-${row.id.slice(-4).toUpperCase()}`,
      detailPath: `/admin/passports/${row.id}`,
      lifecycleState: row.state,
      canConfigure: row.state === 'ACTIVE',
    });
  }
}

function encodeCursor(cursor: AdminPassportCursor): string {
  return Buffer.from(JSON.stringify({ createdAt: cursor.createdAt.toISOString(), id: cursor.id }), 'utf8').toString('base64url');
}

function decodeCursor(value: string): AdminPassportCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
    const createdAt = new Date(String(parsed.createdAt));
    return typeof parsed.id === 'string' && /^[0-9a-f-]{36}$/i.test(parsed.id) && Number.isFinite(createdAt.valueOf())
      ? { createdAt, id: parsed.id } : null;
  } catch { return null; }
}
