import { Inject, Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';

import { PrismaService } from '../../database/prisma.service.js';
import { encryptPassportValue } from '../player-private-identity/passport-crypto.js';
import { normalizeDocumentNumber, normalizeDocumentType, normalizeLegalName } from '../player-private-identity/identity-normalization.js';
import { documentFingerprint } from '../player-private-identity/fingerprint.js';
import type { PassportKeyMaterial } from '../player-private-identity/passport-keys.js';
import { PASSPORT_KEY_MATERIAL } from '../passport-key.token.js';

@Injectable()
export class RepresentativeConfirmationService {
  public constructor(private readonly prisma: PrismaService, @Inject(PASSPORT_KEY_MATERIAL) private readonly keys: PassportKeyMaterial) {}

  public async create(input: { representativeIdentityId: string; legalName: string; documentType: string; documentNumber: string; relationship: 'MOTHER' | 'FATHER' | 'LEGAL_GUARDIAN'; playerDocumentFingerprint: string; now?: Date }) {
    const now = input.now ?? new Date();
    const documentType = normalizeDocumentType(input.documentType);
    const documentNumber = normalizeDocumentNumber(input.documentNumber);
    const legalName = normalizeLegalName(input.legalName);
    return this.prisma.representativeConfirmation.create({ data: {
      representativeIdentityId: input.representativeIdentityId,
      encryptedLegalName: encryptPassportValue(this.keys.privateEncryptionKey, input.legalName.trim()),
      encryptedDocumentType: encryptPassportValue(this.keys.privateEncryptionKey, input.documentType.trim()),
      encryptedDocumentNumber: encryptPassportValue(this.keys.privateEncryptionKey, input.documentNumber.trim()),
      encryptedRelationship: encryptPassportValue(this.keys.privateEncryptionKey, input.relationship),
      documentFingerprint: createHmac('sha256', this.keys.documentHmacKey).update(`${documentType}:${documentNumber}`).digest('hex'),
      playerDocumentBinding: input.playerDocumentFingerprint,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    } });
  }

  public async createForPlayerDocument(input: { representativeIdentityId: string; legalName: string; documentType: string; documentNumber: string; relationship: 'MOTHER' | 'FATHER' | 'LEGAL_GUARDIAN'; playerDocumentType: string; playerDocumentNumber: string; now?: Date }) {
    return this.create({
      representativeIdentityId: input.representativeIdentityId,
      legalName: input.legalName,
      documentType: input.documentType,
      documentNumber: input.documentNumber,
      relationship: input.relationship,
      playerDocumentFingerprint: documentFingerprint(this.keys.documentHmacKey, normalizeDocumentType(input.playerDocumentType), normalizeDocumentNumber(input.playerDocumentNumber)),
      ...(input.now ? { now: input.now } : {}),
    });
  }

  public async consume(id: string, playerDocumentFingerprint: string, now = new Date()) {
    const confirmation = await this.prisma.representativeConfirmation.findUnique({ where: { id } });
    if (!confirmation || confirmation.status !== 'PENDING' || confirmation.playerDocumentBinding !== playerDocumentFingerprint || confirmation.expiresAt <= now) {
      throw new Error('INVALID_OR_EXPIRED_REPRESENTATIVE_CONFIRMATION');
    }
    return this.prisma.representativeConfirmation.update({ where: { id }, data: { status: 'CONSUMED', consumedAt: now } });
  }
}
