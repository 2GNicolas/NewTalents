import { encryptPassportValue } from './passport-crypto.js';
import { documentFingerprint, nameDobFingerprint } from './fingerprint.js';
import {
  normalizeDateOfBirth,
  normalizeDocumentNumber,
  normalizeDocumentType,
  normalizeLegalName,
} from './identity-normalization.js';
import type { PassportKeyMaterial } from './passport-keys.js';

export type PrivateIdentityInput = Readonly<{
  legalName: string;
  dateOfBirth: string;
  documentType: string;
  documentNumber: string;
}>;

export type StoredPrivateIdentity = Readonly<{
  encryptedLegalName: string;
  encryptedDateOfBirth: string;
  encryptedDocumentType: string;
  encryptedDocumentNumber: string;
  documentFingerprint: string;
  nameDobFingerprint: string;
}>;

export class PrivateIdentityService {
  public constructor(private readonly keys: PassportKeyMaterial) {}

  public createPrivateIdentity(input: PrivateIdentityInput): StoredPrivateIdentity {
    const legalName = normalizeLegalName(input.legalName);
    const dateOfBirth = normalizeDateOfBirth(input.dateOfBirth);
    const documentType = normalizeDocumentType(input.documentType);
    const documentNumber = normalizeDocumentNumber(input.documentNumber);

    return Object.freeze({
      encryptedLegalName: encryptPassportValue(this.keys.privateEncryptionKey, input.legalName.trim()),
      encryptedDateOfBirth: encryptPassportValue(this.keys.privateEncryptionKey, input.dateOfBirth.trim()),
      encryptedDocumentType: encryptPassportValue(this.keys.privateEncryptionKey, input.documentType.trim()),
      encryptedDocumentNumber: encryptPassportValue(this.keys.privateEncryptionKey, input.documentNumber.trim()),
      documentFingerprint: documentFingerprint(this.keys.documentHmacKey, documentType, documentNumber),
      nameDobFingerprint: nameDobFingerprint(this.keys.nameDobHmacKey, legalName, dateOfBirth),
    });
  }

}
