import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { Prisma } from '../../generated/prisma/client.js';
import { PrivateIdentityService, type PrivateIdentityInput } from '../../player-passport/player-private-identity/private-identity.service.js';

export type RegistrationDuplicateResult = Readonly<{ outcome: 'clear' }> | Readonly<{ outcome: 'conflict'; code: 'REGISTRATION_CONFLICT'; field: 'credentials.email' | 'person.documentNumber' }>;
export type RegistrationDuplicateInput = Readonly<{ requestId: string; email: string; person: PrivateIdentityInput }>;

type DuplicateTransaction = Pick<Prisma.TransactionClient, '$executeRaw' | 'authenticationCredential' | 'playerPrivateIdentity' | 'registrationRequestApplicant' | 'registrationPrivateDuplicateSignal'>;

@Injectable()
export class RegistrationDuplicateService {
  constructor(private readonly privateIdentity: PrivateIdentityService) {}

  async inspect(transaction: DuplicateTransaction, input: RegistrationDuplicateInput): Promise<RegistrationDuplicateResult> {
    const normalizedEmail = this.normalizeEmail(input.email);
    const stored = this.privateIdentity.createPrivateIdentity(input.person);
    await this.lock(transaction, `email:${normalizedEmail}`);
    await this.lock(transaction, `document:${stored.documentFingerprint}`);

    const [credential, playerDocument, requestDocument] = await Promise.all([
      transaction.authenticationCredential.findUnique({ where: { normalizedEmail }, select: { identityId: true } }),
      transaction.playerPrivateIdentity.findUnique({ where: { documentFingerprint: stored.documentFingerprint }, select: { playerId: true } }),
      transaction.registrationRequestApplicant.findFirst({ where: { requestId: { not: input.requestId }, documentFingerprint: stored.documentFingerprint }, select: { id: true } }),
    ]);
    if (credential) return Object.freeze({ outcome: 'conflict', code: 'REGISTRATION_CONFLICT', field: 'credentials.email' });
    if (playerDocument || requestDocument) return Object.freeze({ outcome: 'conflict', code: 'REGISTRATION_CONFLICT', field: 'person.documentNumber' });

    const [playerSimilarity, requestSimilarity] = await Promise.all([
      transaction.playerPrivateIdentity.findFirst({ where: { nameDobFingerprint: stored.nameDobFingerprint }, select: { playerId: true } }),
      transaction.registrationRequestApplicant.findFirst({ where: { requestId: { not: input.requestId }, nameDobFingerprint: stored.nameDobFingerprint }, select: { id: true } }),
    ]);
    if (playerSimilarity || requestSimilarity) {
      await transaction.registrationPrivateDuplicateSignal.create({ data: { requestId: input.requestId, signalType: 'NAME_DOB_SIMILARITY', encryptedCandidateReference: null } });
    }
    return Object.freeze({ outcome: 'clear' });
  }

  private normalizeEmail(value: string): string {
    if (typeof value !== 'string') throw new Error('INVALID_REGISTRATION_IDENTITY');
    const normalized = value.normalize('NFC').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) throw new Error('INVALID_REGISTRATION_IDENTITY');
    return normalized;
  }

  private async lock(transaction: DuplicateTransaction, value: string): Promise<void> {
    const digest = createHash('sha256').update(value).digest('hex').slice(0, 16);
    const key = BigInt.asIntN(64, BigInt(`0x${digest}`));
    await transaction.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${key})`);
  }
}
