import { createHmac, randomUUID } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';

import { PendingApplicantCredentialService } from '../../authentication/pending-applicant-credential.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PASSPORT_KEY_MATERIAL } from '../../player-passport/passport-key.token.js';
import { encryptPassportValue } from '../../player-passport/player-private-identity/passport-crypto.js';
import type { PassportKeyMaterial } from '../../player-passport/player-private-identity/passport-keys.js';
import { PrivateIdentityService } from '../../player-passport/player-private-identity/private-identity.service.js';
import type { RegistrationTypedRequestApplication, TypedApplicationResult } from '../application/applicant-request.service.js';
import { RegistrationDuplicateService } from '../duplicates/registration-duplicate.service.js';
import type { RegistrationRequestType } from '../domain/registration-request.types.js';
import { RegistrationRequestRepository, type RegistrationApplicantCreate, type RegistrationPlayerCreate, type RegistrationRepresentativeCreate, type RegistrationTypedDraftInput } from '../persistence/registration-request.repository.js';
import { PersonalAdultApplicationService } from './personal-adult-application.service.js';
import { RepresentedMinorApplicationService } from './represented-minor-application.service.js';
import { FormalAcademyApplicationService } from '../academy/formal-academy-application.service.js';
import { NaturalPersonAcademyApplicationService } from '../academy/natural-person-academy-application.service.js';
import { AcademyDuplicateService } from '../duplicates/academy-duplicate.service.js';
import { AdditionalAcademyAccountService } from '../academy/additional-academy-account.service.js';
import { AcademyAdultPlayerService } from '../academy/academy-adult-player.service.js';
import { AcademyMinorPlayerService } from '../academy/academy-minor-player.service.js';
import { RegistrationExactConflictService } from '../duplicates/registration-exact-conflict.service.js';

type Person = Readonly<{ legalNames: string; legalSurnames: string; documentType: string; documentNumber: string; birthDate: string; country: string; city: string; phone?: string }>;
type Credentials = Readonly<{ email: string; password: string; passwordConfirmation: string }>;

@Injectable()
export class PersonalRegistrationTypedRequestApplication implements RegistrationTypedRequestApplication {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: RegistrationRequestRepository,
    private readonly credentials: PendingApplicantCredentialService,
    private readonly duplicates: RegistrationDuplicateService,
    private readonly privateIdentity: PrivateIdentityService,
    private readonly adultRules: PersonalAdultApplicationService,
    private readonly minorRules: RepresentedMinorApplicationService,
    private readonly formalAcademyRules: FormalAcademyApplicationService,
    @Inject(PASSPORT_KEY_MATERIAL) private readonly keys: PassportKeyMaterial,
    private readonly naturalAcademyRules: NaturalPersonAcademyApplicationService = new NaturalPersonAcademyApplicationService(),
    private readonly academyDuplicates?: AcademyDuplicateService,
    @Optional() private readonly additionalAccountRules?: AdditionalAcademyAccountService,
    @Optional() private readonly academyAdultRules?: AcademyAdultPlayerService,
    @Optional() private readonly academyMinorRules?: AcademyMinorPlayerService,
    @Optional() private readonly exactConflicts?: RegistrationExactConflictService,
  ) {}

  async create(input: Readonly<{ type: RegistrationRequestType; payload: unknown; academyContextId?: string; actorIdentityId?: string }>): Promise<TypedApplicationResult> {
    if (['ADDITIONAL_ACADEMY_ACCOUNT', 'ACADEMY_ADULT_PLAYER', 'ACADEMY_MINOR_PLAYER'].includes(input.type)) return this.createAcademyOperation(input);
    if (input.type !== 'PERSONAL_ADULT' && input.type !== 'REPRESENTED_MINOR' && input.type !== 'FORMAL_ACADEMY' && input.type !== 'NATURAL_PERSON_ACADEMY') return { outcome: 'unavailable' };
    const payload = input.payload as Record<string, unknown>;
    const valid = input.type === 'PERSONAL_ADULT' ? await this.adultRules.validateDraft(payload)
      : input.type === 'REPRESENTED_MINOR' ? await this.minorRules.validateDraft(payload)
      : input.type === 'FORMAL_ACADEMY' ? await this.formalAcademyRules.validateDraft(payload)
      : await this.naturalAcademyRules.validateDraft(payload);
    if (!valid.complete) return { outcome: 'invalid' };
    const requestId = randomUUID();
    const credential = payload.credentials as Credentials;
    const academyPayload = input.type === 'FORMAL_ACADEMY' || input.type === 'NATURAL_PERSON_ACADEMY' ? payload.academy as Record<string, unknown> : undefined;
    const applicantPerson = (input.type === 'PERSONAL_ADULT' ? payload.person : input.type === 'REPRESENTED_MINOR' ? payload.representative : academyPayload?.responsiblePerson) as Person;
    const playerPerson = (input.type === 'PERSONAL_ADULT' ? payload.person : input.type === 'REPRESENTED_MINOR' ? payload.minor : undefined) as Person | undefined;
    const applicant = this.applicant(applicantPerson, credential.email, true);
    const player = playerPerson ? this.player(playerPerson, input.type === 'PERSONAL_ADULT') : undefined;
    try {
      const typedDraft: RegistrationTypedDraftInput = input.type === 'PERSONAL_ADULT' ? { requestId, type: input.type, detail: { type: input.type, applicant, player: player!, actingForSelf: true } }
      : input.type === 'REPRESENTED_MINOR' ? { requestId, type: input.type, detail: { type: input.type, applicant, player: player!, relationship: payload.relationship as 'MOTHER' | 'FATHER' | 'LEGAL_GUARDIAN', authorityDeclared: true } }
      : input.type === 'FORMAL_ACADEMY' ? { requestId, type: input.type, detail: {
        type: input.type, responsibleApplicant: applicant,
        encryptedAcademyName: encryptPassportValue(this.keys.privateEncryptionKey, String(academyPayload!.academyName)), academyNameFingerprint: this.academyFingerprint(String(academyPayload!.academyName)),
        encryptedCountry: encryptPassportValue(this.keys.privateEncryptionKey, String(academyPayload!.country)), encryptedCity: encryptPassportValue(this.keys.privateEncryptionKey, String(academyPayload!.city)),
        encryptedOrganizationType: encryptPassportValue(this.keys.privateEncryptionKey, String(payload.organizationType)), encryptedNit: encryptPassportValue(this.keys.privateEncryptionKey, String(payload.nit)), nitFingerprint: this.nitFingerprint(String(payload.nit)), authorityDeclared: true,
      } }
      : { requestId, type: 'NATURAL_PERSON_ACADEMY', detail: {
        type: input.type, responsibleApplicant: applicant,
        encryptedAcademyName: encryptPassportValue(this.keys.privateEncryptionKey, String(academyPayload!.academyName)), academyNameFingerprint: this.academyFingerprint(String(academyPayload!.academyName)),
        encryptedCountry: encryptPassportValue(this.keys.privateEncryptionKey, String(academyPayload!.country)), encryptedCity: encryptPassportValue(this.keys.privateEncryptionKey, String(academyPayload!.city)),
        ...(academyPayload!.trainingPlace === undefined ? {} : { encryptedTrainingPlace: encryptPassportValue(this.keys.privateEncryptionKey, String(academyPayload!.trainingPlace)) }),
        operationDeclared: true, proofCategories: payload.proofCategories as ('RUT' | 'MUNICIPAL_OR_SPORT_CERTIFICATION' | 'PLACE_USE_AUTHORIZATION' | 'OPERATION_CONTRACT_OR_REGISTER' | 'OTHER_CONTROLLED')[],
      } };
      const exact = this.exactConflicts ? await this.prisma.$transaction(async (tx) => {
        const documents = input.type === 'REPRESENTED_MINOR'
          ? [{ field: 'representative.documentNumber', documentType: applicantPerson.documentType, documentNumber: applicantPerson.documentNumber }, { field: 'minor.documentNumber', documentType: playerPerson!.documentType, documentNumber: playerPerson!.documentNumber }]
          : [{ field: input.type === 'PERSONAL_ADULT' ? 'person.documentNumber' : 'academy.responsiblePerson.documentNumber', documentType: applicantPerson.documentType, documentNumber: applicantPerson.documentNumber }];
        const identifiers = { documents, ...(academyPayload ? { academyName: { field: 'academy.academyName', value: String(academyPayload.academyName) } } : {}), ...(input.type === 'FORMAL_ACADEMY' ? { nit: { field: 'nit', value: String(payload.nit) } } : {}) };
        const inspected = await this.exactConflicts!.inspect(tx, identifiers);
        if (inspected.outcome === 'conflict') return inspected;
        await this.repository.createTypedDraftInTransaction(tx, typedDraft);
        const reserved = await this.exactConflicts!.reserve(tx, identifiers, requestId);
        if (reserved.outcome === 'conflict') throw Object.assign(new Error('EXACT_IDENTIFIER_CONFLICT'), { code: 'EXACT_IDENTIFIER_CONFLICT', field: reserved.field });
        return reserved;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }) : (await this.repository.createTypedDraft(typedDraft), { outcome: 'clear' as const });
      if (exact.outcome === 'conflict') return { outcome: 'conflict', field: exact.field };
      if (playerPerson) {
        const duplicate = await this.prisma.$transaction((tx) => this.duplicates.inspect(tx, {
          requestId, email: credential.email,
          person: { legalName: this.fullName(playerPerson), dateOfBirth: playerPerson.birthDate, documentType: playerPerson.documentType, documentNumber: playerPerson.documentNumber },
        }));
        if (duplicate.outcome === 'conflict') { await this.removeDraft(requestId); return { outcome: 'conflict', field: duplicate.field }; }
      } else if (this.academyDuplicates) {
        const duplicate = await this.prisma.$transaction((tx) => this.academyDuplicates!.inspect(tx, {
          requestId, academyName: String(academyPayload!.academyName), ...(input.type === 'FORMAL_ACADEMY' ? { nit: String(payload.nit) } : {}),
          responsible: { legalName: this.fullName(applicantPerson), dateOfBirth: applicantPerson.birthDate, documentType: applicantPerson.documentType, documentNumber: applicantPerson.documentNumber },
        }));
        if (duplicate.outcome === 'conflict') { await this.removeDraft(requestId); return { outcome: 'conflict', field: duplicate.field ?? 'academy.academyName' }; }
      }
      const claimed = await this.credentials.create({ requestId, ...credential });
      if (claimed.outcome !== 'created') { await this.removeDraft(requestId); return claimed.outcome === 'conflict' ? { outcome: 'conflict', field: 'credentials.email' } : claimed; }
      await this.prisma.$transaction(async (tx) => {
        await tx.registrationRequestApplicant.updateMany({ where: { requestId }, data: { identityId: claimed.identityId } });
        const consent = payload.consent as Record<string, unknown>;
        const textVersion = String(consent.privacyVersion);
        const types = input.type === 'PERSONAL_ADULT' ? ['PRIVACY', 'TRUTHFULNESS', 'SELF_ACTION'] as const
          : input.type === 'REPRESENTED_MINOR' ? ['PRIVACY', 'TRUTHFULNESS', 'REPRESENTATION', 'MINOR_TREATMENT'] as const
          : ['PRIVACY', 'TRUTHFULNESS'] as const;
        await tx.registrationConsentRecord.createMany({ data: types.map((type) => ({ requestId, type, textVersion, actorIdentityId: claimed.identityId, scopeCategory: input.type, requestVersion: 0 })) });
      });
      return { outcome: 'created', requestId };
    } catch (error) {
      await this.removeDraft(requestId).catch(() => undefined);
      const field = this.errorField(error);
      return ['P2002', 'EXACT_IDENTIFIER_CONFLICT'].includes(this.code(error) ?? '') ? (field ? { outcome: 'conflict', field } : { outcome: 'conflict' }) : { outcome: 'unavailable' };
    }
  }

  async update(input: Readonly<{ requestId: string; type: RegistrationRequestType; payload: unknown; actorIdentityId: string; expectedVersion: number }>): Promise<TypedApplicationResult> {
    if (input.type === 'PERSONAL_ADULT') return (await this.adultRules.validateDraft(input.payload)).complete ? { outcome: 'updated' } : { outcome: 'invalid' };
    if (input.type === 'REPRESENTED_MINOR') return (await this.minorRules.validateDraft(input.payload)).complete ? { outcome: 'updated' } : { outcome: 'invalid' };
    if (input.type === 'FORMAL_ACADEMY') return (await this.formalAcademyRules.validateDraft(input.payload)).complete ? { outcome: 'updated' } : { outcome: 'invalid' };
    if (input.type === 'NATURAL_PERSON_ACADEMY') return (await this.naturalAcademyRules.validateDraft(input.payload)).complete ? { outcome: 'updated' } : { outcome: 'invalid' };
    if (['ADDITIONAL_ACADEMY_ACCOUNT', 'ACADEMY_ADULT_PLAYER', 'ACADEMY_MINOR_PLAYER'].includes(input.type)) {
      const request = await this.prisma.registrationRequest.findUnique({ where: { id: input.requestId }, select: { academyContextId: true, ownerIdentityId: true, version: true } });
      if (!request?.academyContextId || request.ownerIdentityId !== input.actorIdentityId || request.version !== input.expectedVersion) return { outcome: 'conflict' };
      const ruleInput = { actorIdentityId: input.actorIdentityId, academyId: request.academyContextId, payload: input.payload };
      const validation = input.type === 'ADDITIONAL_ACADEMY_ACCOUNT' ? await this.additionalAccountRules?.validateDraft(ruleInput)
        : input.type === 'ACADEMY_ADULT_PLAYER' ? await this.academyAdultRules?.validateDraft(ruleInput)
        : await this.academyMinorRules?.validateDraft(ruleInput);
      return validation?.complete ? { outcome: 'updated' } : { outcome: 'invalid' };
    }
    return { outcome: 'unavailable' };
  }

  async readiness(requestId: string): Promise<Readonly<{ ageRouteCompatible: boolean; representationComplete: boolean }>> {
    const request = await this.prisma.registrationRequest.findUnique({ where: { id: requestId }, include: { evidenceItems: { where: { replacedById: null, deletedAt: null, status: 'CLEAN' } }, consents: true, representedMinorDetail: true, additionalAcademyAccountDetail: true, academyAdultPlayerDetail: true, academyMinorPlayerDetail: true } });
    if (!request) return { ageRouteCompatible: false, representationComplete: false };
    const evidence = new Set(request.evidenceItems.map((item) => item.category));
    // Consent records are immutable acknowledgements. A correction increments the
    // optimistic request version, but does not invalidate previously accepted
    // declarations when the Administrator requested only evidence replacement.
    const consents = new Set(request.consents.filter((item) => item.requestVersion <= request.version).map((item) => item.type));
    const adultReady = ['IDENTITY_FRONT', 'IDENTITY_BACK'].every((item) => evidence.has(item as never)) && ['PRIVACY', 'TRUTHFULNESS', 'SELF_ACTION'].every((item) => consents.has(item as never));
    const minorReady = ['IDENTITY_FRONT', 'IDENTITY_BACK', 'MINOR_CIVIL_IDENTITY', 'REPRESENTATION_AUTHORITY'].every((item) => evidence.has(item as never)) && ['PRIVACY', 'TRUTHFULNESS', 'REPRESENTATION', 'MINOR_TREATMENT'].every((item) => consents.has(item as never)) && request.representedMinorDetail?.authorityDeclared === true;
    const formalReady = ['RUT', 'EXISTENCE_CERTIFICATE', 'RESPONSIBLE_AUTHORITY'].every((item) => evidence.has(item as never)) && ['PRIVACY', 'TRUTHFULNESS'].every((item) => consents.has(item as never));
    if (request.type === 'FORMAL_ACADEMY') return { ageRouteCompatible: formalReady, representationComplete: formalReady };
    const naturalReady = ['OPERATION_PROOF', 'RESPONSIBLE_AUTHORITY'].every((item) => evidence.has(item as never)) && ['PRIVACY', 'TRUTHFULNESS'].every((item) => consents.has(item as never));
    if (request.type === 'NATURAL_PERSON_ACADEMY') return { ageRouteCompatible: naturalReady, representationComplete: naturalReady };
    const accountReady = ['IDENTITY_FRONT', 'IDENTITY_BACK', 'ACADEMY_ACCOUNT_AUTHORIZATION'].every((item) => evidence.has(item as never)) && ['PRIVACY', 'TRUTHFULNESS'].every((item) => consents.has(item as never)) && request.additionalAcademyAccountDetail?.responsibleAuthorization === true;
    if (request.type === 'ADDITIONAL_ACADEMY_ACCOUNT') return { ageRouteCompatible: accountReady, representationComplete: accountReady };
    const adultPlayerReady = ['IDENTITY_FRONT', 'IDENTITY_BACK', 'ADULT_AUTHORIZATION'].every((item) => evidence.has(item as never)) && ['PRIVACY', 'TRUTHFULNESS', 'ACADEMY_PRESENTATION'].every((item) => consents.has(item as never)) && request.academyAdultPlayerDetail?.adultAuthorization === true;
    if (request.type === 'ACADEMY_ADULT_PLAYER') return { ageRouteCompatible: adultPlayerReady, representationComplete: adultPlayerReady };
    const minorPlayerReady = ['IDENTITY_FRONT', 'IDENTITY_BACK', 'MINOR_CIVIL_IDENTITY', 'REPRESENTATION_AUTHORITY'].every((item) => evidence.has(item as never)) && ['PRIVACY', 'TRUTHFULNESS', 'REPRESENTATION', 'MINOR_TREATMENT', 'ACADEMY_PRESENTATION'].every((item) => consents.has(item as never)) && request.academyMinorPlayerDetail?.authorityDeclared === true;
    if (request.type === 'ACADEMY_MINOR_PLAYER') return { ageRouteCompatible: minorPlayerReady, representationComplete: minorPlayerReady };
    return { ageRouteCompatible: request.type === 'PERSONAL_ADULT' ? adultReady : minorReady, representationComplete: request.type === 'PERSONAL_ADULT' || minorReady };
  }

  private async createAcademyOperation(input: Readonly<{ type: RegistrationRequestType; payload: unknown; academyContextId?: string; actorIdentityId?: string }>): Promise<TypedApplicationResult> {
    if (!input.academyContextId || !input.actorIdentityId) return { outcome: 'unavailable' };
    const actorIdentityId = input.actorIdentityId;
    const academyContextId = input.academyContextId;
    const rulesInput = { actorIdentityId, academyId: academyContextId, payload: input.payload };
    const validation = input.type === 'ADDITIONAL_ACADEMY_ACCOUNT' ? await this.additionalAccountRules?.validateDraft(rulesInput)
      : input.type === 'ACADEMY_ADULT_PLAYER' ? await this.academyAdultRules?.validateDraft(rulesInput)
      : input.type === 'ACADEMY_MINOR_PLAYER' ? await this.academyMinorRules?.validateDraft(rulesInput) : undefined;
    if (!validation) return { outcome: 'unavailable' };
    if (!validation.complete) return validation.code === 'ACADEMY_OPERATION_NOT_AUTHORIZED' ? { outcome: 'conflict' } : { outcome: 'invalid' };
    const payload = input.payload as Record<string, unknown>;
    const requestId = randomUUID();
    let targetIdentityId: string | undefined;
    try {
      let typedDraft: RegistrationTypedDraftInput;
      let exactDocuments: readonly Readonly<{ field: string; documentType: string; documentNumber: string }>[];
      if (input.type === 'ADDITIONAL_ACADEMY_ACCOUNT') {
        targetIdentityId = (await this.prisma.identity.create({ data: { status: 'ACTIVE' }, select: { id: true } })).id;
        const person = payload.person as Person;
        typedDraft = { requestId, type: input.type, ownerIdentityId: actorIdentityId, academyContextId, detail: { type: input.type, applicant: this.academyApplicant(person, targetIdentityId), encryptedFunction: encryptPassportValue(this.keys.privateEncryptionKey, String(payload.function)), responsibleAuthorization: true } };
        exactDocuments = [{ field: 'person.documentNumber', documentType: person.documentType, documentNumber: person.documentNumber }];
      } else if (input.type === 'ACADEMY_ADULT_PLAYER') {
        const person = payload.player as Person;
        typedDraft = { requestId, type: input.type, ownerIdentityId: actorIdentityId, academyContextId, detail: { type: input.type, player: this.player(person, true), adultAuthorization: true } };
        exactDocuments = [{ field: 'player.documentNumber', documentType: person.documentType, documentNumber: person.documentNumber }];
      } else {
        const representative = payload.representative as Person;
        const minor = payload.minor as Person;
        typedDraft = { requestId, type: 'ACADEMY_MINOR_PLAYER', ownerIdentityId: actorIdentityId, academyContextId, detail: { type: 'ACADEMY_MINOR_PLAYER', player: this.player(minor, false), representative: this.representative(representative, payload.relationship as RegistrationRepresentativeCreate['relationship']), authorityDeclared: true } };
        exactDocuments = [{ field: 'minor.documentNumber', documentType: minor.documentType, documentNumber: minor.documentNumber }, { field: 'representative.documentNumber', documentType: representative.documentType, documentNumber: representative.documentNumber }];
      }
      const exact = this.exactConflicts ? await this.prisma.$transaction(async (tx) => {
        const identifiers = { documents: exactDocuments };
        const inspected = await this.exactConflicts!.inspect(tx, identifiers);
        if (inspected.outcome === 'conflict') return inspected;
        await this.repository.createTypedDraftInTransaction(tx, typedDraft);
        const reserved = await this.exactConflicts!.reserve(tx, identifiers, requestId);
        if (reserved.outcome === 'conflict') throw Object.assign(new Error('EXACT_IDENTIFIER_CONFLICT'), { code: 'EXACT_IDENTIFIER_CONFLICT', field: reserved.field });
        return reserved;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }) : (await this.repository.createTypedDraft(typedDraft), { outcome: 'clear' as const });
      if (exact.outcome === 'conflict') { await this.removeAcademyOperationDraft(requestId, targetIdentityId); return { outcome: 'conflict', field: exact.field }; }
      const consent = payload.consent as Record<string, unknown>;
      const types = input.type === 'ADDITIONAL_ACADEMY_ACCOUNT' ? ['PRIVACY', 'TRUTHFULNESS'] as const
        : input.type === 'ACADEMY_ADULT_PLAYER' ? ['PRIVACY', 'TRUTHFULNESS', 'ACADEMY_PRESENTATION'] as const
        : ['PRIVACY', 'TRUTHFULNESS', 'REPRESENTATION', 'MINOR_TREATMENT', 'ACADEMY_PRESENTATION'] as const;
      await this.prisma.registrationConsentRecord.createMany({ data: types.map((type) => ({ requestId, type, textVersion: String(consent.privacyVersion), actorIdentityId, scopeCategory: input.type, requestVersion: 0 })) });
      return { outcome: 'created', requestId };
    } catch (error) {
      await this.removeAcademyOperationDraft(requestId, targetIdentityId).catch(() => undefined);
      const field = this.errorField(error);
      return ['P2002', 'EXACT_IDENTIFIER_CONFLICT'].includes(this.code(error) ?? '') ? (field ? { outcome: 'conflict', field } : { outcome: 'conflict' }) : { outcome: 'unavailable' };
    }
  }

  private applicant(person: Person, email: string, derivedAdult: boolean): RegistrationApplicantCreate {
    const identity = this.privateIdentity.createPrivateIdentity({ legalName: this.fullName(person), dateOfBirth: person.birthDate, documentType: person.documentType, documentNumber: person.documentNumber });
    return { ...identity, encryptedEmail: encryptPassportValue(this.keys.privateEncryptionKey, email.trim().toLowerCase()), emailFingerprint: this.fingerprint(email.trim().toLowerCase()), ...(person.phone ? { encryptedPhone: encryptPassportValue(this.keys.privateEncryptionKey, person.phone), phoneFingerprint: this.fingerprint(person.phone) } : {}), derivedAdult };
  }
  private player(person: Person, derivedAdult: boolean): RegistrationPlayerCreate {
    return { ...this.privateIdentity.createPrivateIdentity({ legalName: this.fullName(person), dateOfBirth: person.birthDate, documentType: person.documentType, documentNumber: person.documentNumber }), encryptedCountry: encryptPassportValue(this.keys.privateEncryptionKey, person.country), encryptedCity: encryptPassportValue(this.keys.privateEncryptionKey, person.city), derivedAdult };
  }
  private academyApplicant(person: Person, identityId: string): RegistrationApplicantCreate {
    const identity = this.privateIdentity.createPrivateIdentity({ legalName: this.fullName(person), dateOfBirth: person.birthDate, documentType: person.documentType, documentNumber: person.documentNumber });
    return { ...identity, identityId, ...(person.phone ? { encryptedPhone: encryptPassportValue(this.keys.privateEncryptionKey, person.phone), phoneFingerprint: this.fingerprint(person.phone) } : {}), derivedAdult: true };
  }
  private representative(person: Person, relationship: RegistrationRepresentativeCreate['relationship']): RegistrationRepresentativeCreate {
    const identity = this.privateIdentity.createPrivateIdentity({ legalName: this.fullName(person), dateOfBirth: person.birthDate, documentType: person.documentType, documentNumber: person.documentNumber });
    return { encryptedLegalName: identity.encryptedLegalName, encryptedDocumentType: identity.encryptedDocumentType, encryptedDocumentNumber: identity.encryptedDocumentNumber, documentFingerprint: identity.documentFingerprint, encryptedPhone: encryptPassportValue(this.keys.privateEncryptionKey, person.phone!), phoneFingerprint: this.fingerprint(person.phone!), relationship, authorityDeclared: true };
  }
  private fullName(person: Person) { return `${person.legalNames.trim()} ${person.legalSurnames.trim()}`; }
  private fingerprint(value: string) { return createHmac('sha256', this.keys.documentHmacKey).update(value.normalize('NFC').trim().toLowerCase()).digest('hex'); }
  private academyFingerprint(value: string) { const normalized = this.academyDuplicates?.normalizeName(value) ?? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase(); return createHmac('sha256', this.keys.documentHmacKey).update(normalized).digest('hex'); }
  private nitFingerprint(value: string) { const normalized = this.academyDuplicates?.normalizeNit(value) ?? value.replace(/[^0-9A-Za-z]/g, '').toUpperCase(); return createHmac('sha256', this.keys.documentHmacKey).update(normalized).digest('hex'); }
  private code(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined; }
  private errorField(error: unknown) { return typeof error === 'object' && error !== null && 'field' in error && typeof error.field === 'string' ? error.field : undefined; }
  private async removeDraft(requestId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.registrationPrivateDuplicateSignal.deleteMany({ where: { requestId } });
      await tx.personalAdultRequestDetail.deleteMany({ where: { requestId } });
      await tx.representedMinorRequestDetail.deleteMany({ where: { requestId } });
      await tx.formalAcademyRequestDetail.deleteMany({ where: { requestId } });
      await tx.naturalPersonAcademyRequestDetail.deleteMany({ where: { requestId } });
      await tx.registrationRequestApplicant.deleteMany({ where: { requestId } });
      await tx.registrationRequestPlayer.deleteMany({ where: { requestId } });
      await tx.registrationRequest.deleteMany({ where: { id: requestId, status: 'DRAFT' } });
    });
  }
  private async removeAcademyOperationDraft(requestId: string, targetIdentityId?: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.registrationConsentRecord.deleteMany({ where: { requestId } });
      await tx.additionalAcademyAccountRequestDetail.deleteMany({ where: { requestId } });
      await tx.academyAdultPlayerRequestDetail.deleteMany({ where: { requestId } });
      await tx.academyMinorPlayerRequestDetail.deleteMany({ where: { requestId } });
      await tx.registrationRequestRepresentative.deleteMany({ where: { requestId } });
      await tx.registrationRequestApplicant.deleteMany({ where: { requestId } });
      await tx.registrationRequestPlayer.deleteMany({ where: { requestId } });
      await tx.registrationRequest.deleteMany({ where: { id: requestId, status: 'DRAFT' } });
      if (targetIdentityId) await tx.identity.deleteMany({ where: { id: targetIdentityId, roleAssignments: { none: {} }, memberships: { none: {} } } });
    });
  }
}
