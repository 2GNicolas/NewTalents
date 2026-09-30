import { createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { PASSPORT_KEY_MATERIAL } from '../../player-passport/passport-key.token.js';
import { documentFingerprint } from '../../player-passport/player-private-identity/fingerprint.js';
import { normalizeDocumentNumber, normalizeDocumentType } from '../../player-passport/player-private-identity/identity-normalization.js';
import type { PassportKeyMaterial } from '../../player-passport/player-private-identity/passport-keys.js';

export type ExactConflictCheck = Readonly<{
  documents: readonly Readonly<{ field: string; documentType: string; documentNumber: string }>[];
  nit?: Readonly<{ field: string; value: string }>;
  academyName?: Readonly<{ field: string; value: string }>;
  excludeRequestId?: string;
}>;
export type ExactConflictResult = Readonly<{ outcome: 'clear' }> | Readonly<{ outcome: 'conflict'; field: string }>;
import type { Prisma } from '../../generated/prisma/client.js';

type ConflictTransaction = Pick<Prisma.TransactionClient, 'playerPrivateIdentity' | 'registrationRequestApplicant' | 'registrationRequestPlayer' | 'registrationRequestRepresentative' | 'formalAcademyRequestDetail' | 'naturalPersonAcademyRequestDetail' | 'registrationExactIdentifierClaim'>;
type ClaimEntry = Readonly<{ claimKey: string; field: string }>;

@Injectable()
export class RegistrationExactConflictService {
  constructor(private readonly prisma: PrismaService, @Inject(PASSPORT_KEY_MATERIAL) private readonly keys: PassportKeyMaterial) {}

  validate(input: ExactConflictCheck): Promise<ExactConflictResult> {
    return this.prisma.$transaction((transaction) => this.inspect(transaction, input));
  }

  async validatePersistedRequest(requestId: string): Promise<ExactConflictResult> {
    const request = await this.prisma.registrationRequest.findUnique({ where: { id: requestId }, select: {
      applicants: { select: { documentFingerprint: true } }, players: { select: { documentFingerprint: true } }, representatives: { select: { documentFingerprint: true } }, formalAcademyDetail: { select: { nitFingerprint: true, academyNameFingerprint: true } }, naturalPersonAcademyDetail: { select: { academyNameFingerprint: true } },
    } });
    if (!request) return Object.freeze({ outcome: 'clear' });
    const documents = [...new Set([...request.applicants, ...request.players, ...request.representatives].map((item) => item.documentFingerprint))];
    return this.prisma.$transaction(async (transaction) => {
      for (const fingerprint of documents) {
        const [registered, applicant, player, representative] = await Promise.all([
          transaction.playerPrivateIdentity.findUnique({ where: { documentFingerprint: fingerprint }, select: { playerId: true } }),
          transaction.registrationRequestApplicant.findFirst({ where: { requestId: { not: requestId }, documentFingerprint: fingerprint }, select: { id: true } }),
          transaction.registrationRequestPlayer.findFirst({ where: { requestId: { not: requestId }, documentFingerprint: fingerprint }, select: { id: true } }),
          transaction.registrationRequestRepresentative.findFirst({ where: { requestId: { not: requestId }, documentFingerprint: fingerprint }, select: { id: true } }),
        ]);
        if (registered || applicant || player || representative) return Object.freeze({ outcome: 'conflict' as const, field: 'documentNumber' });
      }
      const nitFingerprint = request.formalAcademyDetail?.nitFingerprint;
      if (nitFingerprint) {
        const match = await transaction.formalAcademyRequestDetail.findFirst({ where: { requestId: { not: requestId }, nitFingerprint }, select: { id: true } });
        if (match) return Object.freeze({ outcome: 'conflict' as const, field: 'nit' });
      }
      const academyNameFingerprint = request.formalAcademyDetail?.academyNameFingerprint ?? request.naturalPersonAcademyDetail?.academyNameFingerprint;
      if (academyNameFingerprint) {
        const [formalMatch, naturalMatch] = await Promise.all([
          transaction.formalAcademyRequestDetail.findFirst({ where: { requestId: { not: requestId }, academyNameFingerprint }, select: { id: true } }),
          transaction.naturalPersonAcademyRequestDetail.findFirst({ where: { requestId: { not: requestId }, academyNameFingerprint }, select: { id: true } }),
        ]);
        if (formalMatch || naturalMatch) return Object.freeze({ outcome: 'conflict' as const, field: 'academy.academyName' });
      }
      return this.reserveEntries(transaction, [
        ...documents.map((fingerprint) => ({ claimKey: `DOCUMENT:${fingerprint}`, field: 'documentNumber' })),
        ...(nitFingerprint ? [{ claimKey: `NIT:${nitFingerprint}`, field: 'nit' }] : []),
        ...(academyNameFingerprint ? [{ claimKey: `ACADEMY_NAME:${academyNameFingerprint}`, field: 'academy.academyName' }] : []),
      ], requestId);
    });
  }

  async inspect(transaction: ConflictTransaction, input: ExactConflictCheck): Promise<ExactConflictResult> {
    const inspected = new Set<string>();
    for (const document of input.documents) {
      const fingerprint = documentFingerprint(this.keys.documentHmacKey, normalizeDocumentType(document.documentType), normalizeDocumentNumber(document.documentNumber));
      if (inspected.has(fingerprint)) return Object.freeze({ outcome: 'conflict', field: document.field });
      inspected.add(fingerprint);
      const claimKey = `DOCUMENT:${fingerprint}`;
      const requestScope = input.excludeRequestId ? { requestId: { not: input.excludeRequestId } } : {};
      const [claim, registered, applicant, player, representative] = await Promise.all([
        transaction.registrationExactIdentifierClaim.findUnique({ where: { claimKey }, select: { requestId: true } }),
        transaction.playerPrivateIdentity.findUnique({ where: { documentFingerprint: fingerprint }, select: { playerId: true } }),
        transaction.registrationRequestApplicant.findFirst({ where: { ...requestScope, documentFingerprint: fingerprint }, select: { id: true } }),
        transaction.registrationRequestPlayer.findFirst({ where: { ...requestScope, documentFingerprint: fingerprint }, select: { id: true } }),
        transaction.registrationRequestRepresentative.findFirst({ where: { ...requestScope, documentFingerprint: fingerprint }, select: { id: true } }),
      ]);
      if ((claim && claim.requestId !== input.excludeRequestId) || registered || applicant || player || representative) return Object.freeze({ outcome: 'conflict', field: document.field });
    }
    if (input.nit) {
      const normalized = input.nit.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
      if (!normalized) throw new Error('INVALID_ACADEMY_IDENTITY');
      const fingerprint = createHmac('sha256', this.keys.documentHmacKey).update(normalized).digest('hex');
      const claimKey = `NIT:${fingerprint}`;
      const [claim, match] = await Promise.all([
        transaction.registrationExactIdentifierClaim.findUnique({ where: { claimKey }, select: { requestId: true } }),
        transaction.formalAcademyRequestDetail.findFirst({ where: { ...(input.excludeRequestId ? { requestId: { not: input.excludeRequestId } } : {}), nitFingerprint: fingerprint }, select: { id: true } }),
      ]);
      if ((claim && claim.requestId !== input.excludeRequestId) || match) return Object.freeze({ outcome: 'conflict', field: input.nit.field });
    }
    if (input.academyName) {
      const normalized = this.normalizeAcademyName(input.academyName.value);
      const fingerprint = createHmac('sha256', this.keys.documentHmacKey).update(normalized).digest('hex');
      const claimKey = `ACADEMY_NAME:${fingerprint}`;
      const requestScope = input.excludeRequestId ? { requestId: { not: input.excludeRequestId } } : {};
      const [claim, formalMatch, naturalMatch] = await Promise.all([
        transaction.registrationExactIdentifierClaim.findUnique({ where: { claimKey }, select: { requestId: true } }),
        transaction.formalAcademyRequestDetail.findFirst({ where: { ...requestScope, academyNameFingerprint: fingerprint }, select: { id: true } }),
        transaction.naturalPersonAcademyRequestDetail.findFirst({ where: { ...requestScope, academyNameFingerprint: fingerprint }, select: { id: true } }),
      ]);
      if ((claim && claim.requestId !== input.excludeRequestId) || formalMatch || naturalMatch) return Object.freeze({ outcome: 'conflict', field: input.academyName.field });
    }
    return Object.freeze({ outcome: 'clear' });
  }

  async reserve(transaction: ConflictTransaction, input: ExactConflictCheck, requestId: string): Promise<ExactConflictResult> {
    const entries: ClaimEntry[] = input.documents.map((document) => ({
      claimKey: `DOCUMENT:${documentFingerprint(this.keys.documentHmacKey, normalizeDocumentType(document.documentType), normalizeDocumentNumber(document.documentNumber))}`,
      field: document.field,
    }));
    if (input.nit) {
      const normalized = input.nit.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
      entries.push({ claimKey: `NIT:${createHmac('sha256', this.keys.documentHmacKey).update(normalized).digest('hex')}`, field: input.nit.field });
    }
    if (input.academyName) {
      const normalized = this.normalizeAcademyName(input.academyName.value);
      entries.push({ claimKey: `ACADEMY_NAME:${createHmac('sha256', this.keys.documentHmacKey).update(normalized).digest('hex')}`, field: input.academyName.field });
    }
    const unique = new Map<string, ClaimEntry>();
    for (const entry of entries) {
      if (unique.has(entry.claimKey)) return Object.freeze({ outcome: 'conflict', field: entry.field });
      unique.set(entry.claimKey, entry);
    }
    return this.reserveEntries(transaction, [...unique.values()], requestId);
  }

  private async reserveEntries(transaction: ConflictTransaction, entries: readonly ClaimEntry[], requestId: string): Promise<ExactConflictResult> {
    if (!entries.length) return Object.freeze({ outcome: 'clear' });
    const existing = await transaction.registrationExactIdentifierClaim.findMany({ where: { claimKey: { in: entries.map((entry) => entry.claimKey) } }, select: { claimKey: true, requestId: true } });
    const conflict = existing.find((claim) => claim.requestId !== requestId);
    if (conflict) return Object.freeze({ outcome: 'conflict', field: entries.find((entry) => entry.claimKey === conflict.claimKey)?.field ?? 'documentNumber' });
    const existingKeys = new Set(existing.map((claim) => claim.claimKey));
    const pending = entries.filter((entry) => !existingKeys.has(entry.claimKey));
    const created = await transaction.registrationExactIdentifierClaim.createMany({
      data: pending.map((entry) => ({ requestId, claimKey: entry.claimKey, field: entry.field })), skipDuplicates: true,
    });
    if (created.count !== pending.length) return Object.freeze({ outcome: 'conflict', field: pending[0]?.field ?? 'documentNumber' });
    return Object.freeze({ outcome: 'clear' });
  }

  private normalizeAcademyName(value: string): string {
    const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
    if (!normalized) throw new Error('INVALID_ACADEMY_IDENTITY');
    return normalized;
  }
}
