import { createHash, createHmac } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client.js';
import type { PassportKeyMaterial } from '../../player-passport/player-private-identity/passport-keys.js';
import { PrivateIdentityService, type PrivateIdentityInput } from '../../player-passport/player-private-identity/private-identity.service.js';
import { PASSPORT_KEY_MATERIAL } from '../../player-passport/passport-key.token.js';

export type AcademyDuplicateResult = Readonly<{ outcome: 'clear' }> | Readonly<{ outcome: 'conflict'; code: 'REGISTRATION_CONFLICT'; field?: 'academy.academyName' | 'nit' | 'academy.responsiblePerson.documentNumber' }>;
type AcademyDuplicateTransaction = Pick<Prisma.TransactionClient, '$executeRaw' | 'formalAcademyRequestDetail' | 'naturalPersonAcademyRequestDetail' | 'registrationRequestApplicant' | 'registrationPrivateDuplicateSignal'>;
type AcademyDuplicateInput = Readonly<{ requestId: string; academyName: string; nit?: string; responsible: PrivateIdentityInput }>;
type ContractInput = Readonly<{ academyName?: unknown; nit?: unknown; responsibleDocument?: unknown; exactAcademyExists?: unknown; similarAcademyExists?: unknown }>;

@Injectable()
export class AcademyDuplicateService {
  constructor(@Optional() private readonly privateIdentity?: PrivateIdentityService, @Optional() @Inject(PASSPORT_KEY_MATERIAL) private readonly keys?: PassportKeyMaterial) {}

  async inspect(input: ContractInput): Promise<AcademyDuplicateResult>;
  async inspect(transaction: AcademyDuplicateTransaction, input: AcademyDuplicateInput): Promise<AcademyDuplicateResult>;
  async inspect(first: AcademyDuplicateTransaction | ContractInput, second?: AcademyDuplicateInput): Promise<AcademyDuplicateResult> {
    if (second === undefined) {
      const input = first as ContractInput;
      this.normalizeName(String(input.academyName ?? ''));
      if (input.nit !== undefined) this.normalizeNit(String(input.nit));
      if (typeof input.responsibleDocument !== 'string' || input.responsibleDocument.trim() === '') throw new Error('INVALID_ACADEMY_IDENTITY');
      return input.exactAcademyExists === true ? Object.freeze({ outcome: 'conflict', code: 'REGISTRATION_CONFLICT' }) : Object.freeze({ outcome: 'clear' });
    }
    if (!this.privateIdentity || !this.keys) throw new Error('ACADEMY_DUPLICATE_CONFIGURATION_UNAVAILABLE');
    const transaction = first as AcademyDuplicateTransaction;
    const nameFingerprint = this.fingerprint(this.normalizeName(second.academyName));
    const nitFingerprint = second.nit === undefined ? undefined : this.fingerprint(this.normalizeNit(second.nit));
    const responsible = this.privateIdentity.createPrivateIdentity(second.responsible);
    for (const key of [`academy:${nameFingerprint}`, ...(nitFingerprint ? [`nit:${nitFingerprint}`] : []), `responsible:${responsible.documentFingerprint}`]) await this.lock(transaction, key);
    const [formalName, naturalName, formalNit, responsibleMatch] = await Promise.all([
      transaction.formalAcademyRequestDetail.findFirst({ where: { requestId: { not: second.requestId }, academyNameFingerprint: nameFingerprint }, select: { id: true } }),
      transaction.naturalPersonAcademyRequestDetail.findFirst({ where: { requestId: { not: second.requestId }, academyNameFingerprint: nameFingerprint }, select: { id: true } }),
      nitFingerprint ? transaction.formalAcademyRequestDetail.findFirst({ where: { requestId: { not: second.requestId }, nitFingerprint }, select: { id: true } }) : null,
      transaction.registrationRequestApplicant.findFirst({ where: { requestId: { not: second.requestId }, documentFingerprint: responsible.documentFingerprint }, select: { id: true } }),
    ]);
    if (formalName || naturalName) return Object.freeze({ outcome: 'conflict', code: 'REGISTRATION_CONFLICT', field: 'academy.academyName' });
    if (formalNit) return Object.freeze({ outcome: 'conflict', code: 'REGISTRATION_CONFLICT', field: 'nit' });
    if (responsibleMatch) return Object.freeze({ outcome: 'conflict', code: 'REGISTRATION_CONFLICT', field: 'academy.responsiblePerson.documentNumber' });
    return Object.freeze({ outcome: 'clear' });
  }

  normalizeName(value: string) { const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase(); if (!normalized) throw new Error('INVALID_ACADEMY_IDENTITY'); return normalized; }
  normalizeNit(value: string) { const normalized = value.replace(/[^0-9A-Za-z]/g, '').toUpperCase(); if (!normalized) throw new Error('INVALID_ACADEMY_IDENTITY'); return normalized; }
  private fingerprint(value: string) { return createHmac('sha256', this.keys!.documentHmacKey).update(value).digest('hex'); }
  private async lock(transaction: AcademyDuplicateTransaction, value: string) {
    const digest = createHash('sha256').update(value).digest('hex').slice(0, 16);
    const key = BigInt.asIntN(64, BigInt(`0x${digest}`));
    await transaction.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${key})`);
  }
}
