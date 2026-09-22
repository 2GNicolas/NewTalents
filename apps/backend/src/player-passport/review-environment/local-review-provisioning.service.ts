import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationTransactionService } from '../../authentication/authentication-transaction.service.js';
import { CredentialService } from '../../authentication/credential.service.js';
import { BACKEND_RUNTIME_CONFIGURATION } from '../../config/config.module.js';
import type { BackendRuntimeConfiguration } from '../../config/environment.schema.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { FunctionalRole, PassportLifecycleState } from '../../generated/prisma/client.js';
import { MembershipTransitionService } from '../../academy-membership/membership-transition.service.js';
import { HistoricalTutorReconciliationService } from '../reconciliation/historical-tutor-reconciliation.service.js';
import { PassportTraceService } from '../passport-lifecycle/passport-trace.service.js';
import { PassportTransactionRunner } from '../passport-lifecycle/transaction-runner.js';
import { PassportTransitionService } from '../passport-lifecycle/passport-transition.service.js';
import { PrivateIdentityService, type PrivateIdentityInput } from '../player-private-identity/private-identity.service.js';
import { PlayerPassportService, type FootballProfileInput, type ManagementContext } from '../player-passport.service.js';

const REVIEW_DOMAIN = '@newtalents.local';
const ACADEMY_NAME = 'Academia Horizonte Sintetica';

type AccountKey = 'adult' | 'adultDraft' | 'representativeOne' | 'representativeMultiple' | 'academy' | 'mixed' | 'analyst' | 'admin' | 'tutor' | 'unauthorized';
type AccountDefinition = Readonly<{ email: string; roles: readonly FunctionalRole[] }>;
type PassportDefinition = Readonly<{
  key: string;
  owner: AccountKey;
  context: ManagementContext | 'HISTORICAL_TUTOR';
  legalName: string;
  dateOfBirth: string;
  documentNumber: string;
  profile: FootballProfileInput;
  targetState: PassportLifecycleState;
}>;

const ACCOUNTS: Record<AccountKey, AccountDefinition> = {
  adult: { email: 'adult@newtalents.local', roles: ['USER'] },
  adultDraft: { email: 'adult.draft@newtalents.local', roles: ['USER'] },
  representativeOne: { email: 'representative.one@newtalents.local', roles: ['USER'] },
  representativeMultiple: { email: 'representative.multiple@newtalents.local', roles: ['USER'] },
  academy: { email: 'academy@newtalents.local', roles: ['ACADEMY_USER'] },
  mixed: { email: 'mixed@newtalents.local', roles: ['USER', 'ACADEMY_USER'] },
  analyst: { email: 'analyst@newtalents.local', roles: ['ANALYST'] },
  admin: { email: 'admin@newtalents.local', roles: ['ADMINISTRATOR'] },
  tutor: { email: 'tutor@newtalents.local', roles: ['TUTOR'] },
  unauthorized: { email: 'unauthorized@newtalents.local', roles: ['USER'] },
};

const profile = (position: string, ageCategory: string, city: string, dominantFoot: FootballProfileInput['dominantFoot']): FootballProfileInput => ({
  position, ageCategory, city, country: 'Colombia', dominantFoot,
});

const PASSPORTS: readonly PassportDefinition[] = [
  { key: 'adult-active', owner: 'adult', context: 'SELF', legalName: 'Valeria Rios Sintetica', dateOfBirth: '1998-04-11', documentNumber: 'NTREV-ADULT-001', profile: profile('Mediocampista', 'Mayores', 'Bogota', 'RIGHT'), targetState: 'ACTIVE' },
  { key: 'adult-draft', owner: 'adultDraft', context: 'SELF', legalName: 'Samuel Pinto Sintetico', dateOfBirth: '1997-08-23', documentNumber: 'NTREV-DRAFT-001', profile: profile('Defensa central', 'Mayores', 'Cali', 'LEFT'), targetState: 'DRAFT' },
  { key: 'represented-one', owner: 'representativeOne', context: 'LEGAL_REPRESENTATIVE', legalName: 'Isabela Naranjo Sintetica', dateOfBirth: '2012-05-16', documentNumber: 'NTREV-REPONE-001', profile: profile('Delantera', 'Sub-15', 'Medellin', 'RIGHT'), targetState: 'ACTIVE' },
  { key: 'represented-returned', owner: 'representativeMultiple', context: 'LEGAL_REPRESENTATIVE', legalName: 'Tomas Quintero Sintetico', dateOfBirth: '2011-10-02', documentNumber: 'NTREV-REPMULTI-001', profile: profile('Portero', 'Sub-15', 'Manizales', 'RIGHT'), targetState: 'RETURNED_FOR_CORRECTION' },
  { key: 'represented-active', owner: 'representativeMultiple', context: 'LEGAL_REPRESENTATIVE', legalName: 'Luciana Vera Sintetica', dateOfBirth: '2013-02-19', documentNumber: 'NTREV-REPMULTI-002', profile: profile('Extrema', 'Sub-13', 'Pereira', 'LEFT'), targetState: 'ACTIVE' },
  { key: 'mixed-self', owner: 'mixed', context: 'SELF', legalName: 'Julian Duarte Sintetico', dateOfBirth: '1996-12-09', documentNumber: 'NTREV-MIXED-001', profile: profile('Lateral', 'Mayores', 'Barranquilla', 'BOTH'), targetState: 'ACTIVE' },
  { key: 'academy-active', owner: 'academy', context: 'ACADEMY', legalName: 'Daniela Acosta Sintetica', dateOfBirth: '1999-01-14', documentNumber: 'NTREV-ACADEMY-001', profile: profile('Volante', 'Mayores', 'Bogota', 'RIGHT'), targetState: 'ACTIVE' },
  { key: 'academy-draft', owner: 'academy', context: 'ACADEMY', legalName: 'Camilo Pedraza Sintetico', dateOfBirth: '2001-06-07', documentNumber: 'NTREV-ACADEMY-002', profile: profile('Defensa', 'Mayores', 'Tunja', 'LEFT'), targetState: 'DRAFT' },
  { key: 'duplicate-base', owner: 'academy', context: 'ACADEMY', legalName: 'Alexis Montoya Sintetico', dateOfBirth: '2000-09-30', documentNumber: 'NTREV-DUPLICATE-BASE', profile: profile('Delantero', 'Mayores', 'Ibague', 'RIGHT'), targetState: 'ACTIVE' },
  { key: 'duplicate-review', owner: 'academy', context: 'ACADEMY', legalName: 'Alexis Montoya Sintetico', dateOfBirth: '2000-09-30', documentNumber: 'NTREV-DUPLICATE-REVIEW', profile: profile('Delantero', 'Mayores', 'Ibague', 'RIGHT'), targetState: 'IN_REVIEW' },
  { key: 'analyst-candidate', owner: 'academy', context: 'ACADEMY', legalName: 'Mariana Cedeno Sintetica', dateOfBirth: '1999-03-21', documentNumber: 'NTREV-ANALYST-001', profile: profile('Mediocampista', 'Mayores', 'Cartagena', 'BOTH'), targetState: 'IN_REVIEW' },
  { key: 'admin-approved', owner: 'academy', context: 'ACADEMY', legalName: 'Nicolas Becerra Sintetico', dateOfBirth: '1998-11-05', documentNumber: 'NTREV-ADMIN-001', profile: profile('Central', 'Mayores', 'Bucaramanga', 'RIGHT'), targetState: 'APPROVED' },
  { key: 'historical-tutor', owner: 'tutor', context: 'HISTORICAL_TUTOR', legalName: 'Emilia Solano Sintetica', dateOfBirth: '2010-07-12', documentNumber: 'NTREV-TUTOR-001', profile: profile('Volante', 'Sub-17', 'Armenia', 'UNDECLARED'), targetState: 'DRAFT' },
];

export type LocalReviewProvisioningReport = Readonly<{
  academyId: string;
  academyDisplayName: string;
  accounts: ReadonlyArray<{ key: AccountKey; email: string; identityId: string; roles: readonly FunctionalRole[] }>;
  passports: ReadonlyArray<{ key: string; passportId: string; state: PassportLifecycleState }>;
}>;

@Injectable()
export class LocalReviewProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: CredentialService,
    private readonly authenticationTransactions: AuthenticationTransactionService,
    private readonly memberships: MembershipTransitionService,
    private readonly passports: PlayerPassportService,
    private readonly passportTransactions: PassportTransactionRunner,
    private readonly transitions: PassportTransitionService,
    private readonly privateIdentities: PrivateIdentityService,
    private readonly traces: PassportTraceService,
    private readonly tutorReconciliation: HistoricalTutorReconciliationService,
    @Inject(BACKEND_RUNTIME_CONFIGURATION) private readonly configuration: BackendRuntimeConfiguration,
  ) {}

  async provision(password: string): Promise<LocalReviewProvisioningReport> {
    this.assertSafeEnvironment();
    if (!this.credentials.validPassword(password)) throw new Error('review-password-invalid');

    const identities = new Map<AccountKey, string>();
    for (const key of Object.keys(ACCOUNTS) as AccountKey[]) {
      const definition = ACCOUNTS[key];
      const identityId = await this.ensureIdentity(definition.email, password);
      identities.set(key, identityId);
    }
    const administratorId = this.requiredIdentity(identities, 'admin');
    for (const key of Object.keys(ACCOUNTS) as AccountKey[]) {
      await this.ensureRoles(this.requiredIdentity(identities, key), ACCOUNTS[key].roles, administratorId);
    }

    const academy = await this.ensureAcademy();
    for (const key of ['academy', 'mixed'] as const) {
      const outcome = await this.memberships.transition(this.requiredIdentity(identities, key), academy.id, administratorId);
      if (!['transitioned', 'already-current'].includes(outcome.outcome)) throw new Error(`review-membership-${key}-${outcome.outcome}`);
    }

    const provisioned: Array<{ key: string; passportId: string; state: PassportLifecycleState }> = [];
    for (const definition of PASSPORTS) {
      const passportId = definition.context === 'HISTORICAL_TUTOR'
        ? await this.ensureHistoricalTutorPassport(definition, this.requiredIdentity(identities, definition.owner))
        : await this.ensureModernPassport(definition, this.requiredIdentity(identities, definition.owner), academy.id);
      await this.advance(passportId, definition.targetState, this.requiredIdentity(identities, definition.owner), this.requiredIdentity(identities, 'analyst'), administratorId);
      const stored = await this.prisma.playerPassport.findUniqueOrThrow({ where: { id: passportId }, select: { state: true } });
      if (stored.state !== definition.targetState) throw new Error(`review-state-${definition.key}-${stored.state}`);
      provisioned.push({ key: definition.key, passportId, state: stored.state });
    }

    await this.assertRestrictedAccounts(identities);

    return {
      academyId: academy.id,
      academyDisplayName: academy.displayName ?? ACADEMY_NAME,
      accounts: (Object.keys(ACCOUNTS) as AccountKey[]).map((key) => ({ key, email: ACCOUNTS[key].email, identityId: this.requiredIdentity(identities, key), roles: ACCOUNTS[key].roles })),
      passports: provisioned,
    };
  }

  private async assertRestrictedAccounts(identities: ReadonlyMap<AccountKey, string>): Promise<void> {
    const tutorIdentityId = this.requiredIdentity(identities, 'tutor');
    const unauthorizedIdentityId = this.requiredIdentity(identities, 'unauthorized');
    const [tutorModernResponsibilities, tutorModernRoles, tutorAudit, unauthorizedResponsibilities, unauthorizedMemberships] = await Promise.all([
      this.prisma.passportResponsibility.count({ where: { identityId: tutorIdentityId } }),
      this.prisma.roleAssignment.count({ where: { identityId: tutorIdentityId, status: 'ACTIVE', role: { in: ['USER', 'ACADEMY_USER', 'ANALYST', 'ADMINISTRATOR'] } } }),
      this.prisma.historicalTutorReconciliationAudit.count({ where: { actorIdentityId: tutorIdentityId } }),
      this.prisma.passportResponsibility.count({ where: { identityId: unauthorizedIdentityId } }),
      this.prisma.academyMembership.count({ where: { identityId: unauthorizedIdentityId, status: 'ACTIVE' } }),
    ]);
    if (tutorModernResponsibilities !== 0 || tutorModernRoles !== 0 || tutorAudit !== 1) throw new Error('review-tutor-modern-authority');
    if (unauthorizedResponsibilities !== 0 || unauthorizedMemberships !== 0) throw new Error('review-unauthorized-authority');
  }

  private assertSafeEnvironment(): void {
    const url = new URL(this.configuration.databaseUrl);
    if (this.configuration.nodeEnv === 'production' || url.hostname !== 'localhost' || url.port !== '5433') {
      throw new Error('review-environment-refused');
    }
  }

  private async ensureIdentity(email: string, password: string): Promise<string> {
    if (!email.endsWith(REVIEW_DOMAIN)) throw new Error('review-email-refused');
    const passwordHash = await this.credentials.hashPassword(password);
    return this.authenticationTransactions.execute(async (tx) => {
      const existing = await tx.authenticationCredential.findUnique({ where: { normalizedEmail: email }, select: { identityId: true } });
      const identity = existing
        ? await tx.identity.update({ where: { id: existing.identityId }, data: { status: 'ACTIVE', deactivatedAt: null }, select: { id: true } })
        : await tx.identity.create({ data: {}, select: { id: true } });
      await tx.authenticationCredential.upsert({
        where: { identityId: identity.id },
        create: { identityId: identity.id, normalizedEmail: email, passwordHash, status: 'ACTIVE', activatedAt: new Date() },
        update: { normalizedEmail: email, passwordHash, status: 'ACTIVE', activatedAt: new Date(), disabledAt: null },
      });
      await tx.authenticationSession.updateMany({ where: { identityId: identity.id, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: new Date(), revocationReason: 'local-review-credential-replaced' } });
      return identity.id;
    });
  }

  private async ensureRoles(identityId: string, roles: readonly FunctionalRole[], assignedByIdentityId: string): Promise<void> {
    await this.authenticationTransactions.execute(async (tx) => {
      await tx.roleAssignment.updateMany({
        where: { identityId, status: 'ACTIVE', role: { notIn: [...roles] } },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      for (const role of roles) {
        const active = await tx.roleAssignment.findFirst({ where: { identityId, role, status: 'ACTIVE' }, select: { id: true } });
        if (!active) await tx.roleAssignment.create({ data: { identityId, role, assignedByIdentityId } });
      }
    });
  }

  private async ensureAcademy() {
    const academies = await this.prisma.academy.findMany({ where: { displayName: ACADEMY_NAME }, select: { id: true, displayName: true } });
    if (academies.length > 1) throw new Error('review-academy-ambiguous');
    return academies[0] ?? this.prisma.academy.create({ data: { displayName: ACADEMY_NAME }, select: { id: true, displayName: true } });
  }

  private async ensureModernPassport(definition: PassportDefinition, actorIdentityId: string, academyId: string): Promise<string> {
    const identity = this.privateIdentities.createPrivateIdentity(this.privateInput(definition));
    const existing = await this.prisma.playerPrivateIdentity.findUnique({ where: { documentFingerprint: identity.documentFingerprint }, select: { player: { select: { passport: { select: { id: true } } } } } });
    if (existing?.player.passport) return existing.player.passport.id;
    const result = await this.passports.createDraft({
      actorIdentityId,
      managementContext: definition.context as ManagementContext,
      ...(definition.context === 'ACADEMY' ? { academyId } : {}),
      ...(definition.context === 'LEGAL_REPRESENTATIVE' ? { representative: { legalName: `Representante ${definition.owner}`, documentType: 'CC', documentNumber: `NTREV-${definition.owner}-REP`, relationship: 'LEGAL_GUARDIAN', authorityConfirmed: true } as const } : {}),
      privateIdentity: this.privateInput(definition),
      profile: definition.profile,
    });
    if (result.outcome !== 'created') throw new Error(`review-passport-${definition.key}-${result.outcome}`);
    return result.passportId;
  }

  private async ensureHistoricalTutorPassport(definition: PassportDefinition, tutorIdentityId: string): Promise<string> {
    const stored = this.privateIdentities.createPrivateIdentity(this.privateInput(definition));
    const existing = await this.prisma.playerPrivateIdentity.findUnique({ where: { documentFingerprint: stored.documentFingerprint }, select: { player: { select: { passport: { select: { id: true } }, initialTutorResponsibility: { select: { id: true, tutorIdentityId: true } } } } } });
    if (existing?.player.passport && existing.player.initialTutorResponsibility?.tutorIdentityId === tutorIdentityId) {
      await this.tutorReconciliation.reconcile(tutorIdentityId, existing.player.initialTutorResponsibility.id, true);
      return existing.player.passport.id;
    }
    if (existing) throw new Error('review-historical-tutor-conflict');
    const created = await this.passportTransactions.execute(async (tx) => {
      const player = await tx.player.create({ data: {} });
      await tx.playerPrivateIdentity.create({ data: { playerId: player.id, ...stored } });
      const passport = await tx.playerPassport.create({ data: { playerId: player.id, originKind: 'TUTOR', ...definition.profile, createdByIdentityId: tutorIdentityId, version: 1 } });
      const responsibility = await tx.initialTutorResponsibility.create({ data: { playerId: player.id, tutorIdentityId } });
      await this.traces.record(tx, { passportId: passport.id, actorIdentityId: tutorIdentityId, action: 'CREATED', outcome: 'APPLIED', resultingState: 'DRAFT' });
      return { passportId: passport.id, responsibilityId: responsibility.id };
    });
    await this.tutorReconciliation.reconcile(tutorIdentityId, created.responsibilityId, true);
    return created.passportId;
  }

  private async advance(passportId: string, target: PassportLifecycleState, actorIdentityId: string, analystIdentityId: string, administratorIdentityId: string): Promise<void> {
    let current = await this.prisma.playerPassport.findUniqueOrThrow({ where: { id: passportId }, select: { state: true } });
    if (current.state === target) return;
    if (current.state === 'DRAFT' && target !== 'DRAFT') {
      const result = await this.passportTransactions.execute((tx) => this.transitions.submit(tx, { passportId, actorIdentityId }));
      if (result.outcome !== 'applied') throw new Error(`review-submit-${result.outcome}`);
      current = { state: result.state };
    }
    if (target === 'RETURNED_FOR_CORRECTION' && current.state === 'IN_REVIEW') {
      const result = await this.passportTransactions.execute((tx) => this.transitions.returnForCorrection(tx, { passportId, analystIdentityId, reason: 'Ajustar informacion deportiva declarada' }));
      if (result.outcome !== 'applied') throw new Error(`review-return-${result.outcome}`);
      current = { state: result.state };
    }
    if (current.state === 'RETURNED_FOR_CORRECTION' && ['IN_REVIEW', 'APPROVED', 'ACTIVE'].includes(target)) {
      const result = await this.passportTransactions.execute((tx) => this.transitions.submit(tx, { passportId, actorIdentityId }));
      if (result.outcome !== 'applied') throw new Error(`review-resubmit-${result.outcome}`);
      current = { state: result.state };
    }
    if (current.state === 'IN_REVIEW' && ['APPROVED', 'ACTIVE'].includes(target)) {
      const result = await this.passportTransactions.execute((tx) => this.transitions.approve(tx, { passportId, analystIdentityId }));
      if (result.outcome !== 'applied') throw new Error(`review-approve-${result.outcome}`);
      current = { state: result.state };
    }
    if (current.state === 'APPROVED' && target === 'ACTIVE') {
      const result = await this.passportTransactions.execute((tx) => this.transitions.activate(tx, { passportId, administratorIdentityId }));
      if (result.outcome !== 'applied') throw new Error(`review-activate-${result.outcome}`);
      current = { state: result.state };
    }
    if (current.state !== target) throw new Error(`review-cannot-rewind-${passportId}-${current.state}-${target}`);
  }

  private privateInput(definition: PassportDefinition): PrivateIdentityInput {
    return { legalName: definition.legalName, dateOfBirth: definition.dateOfBirth, documentType: 'TI', documentNumber: definition.documentNumber };
  }

  private requiredIdentity(identities: ReadonlyMap<AccountKey, string>, key: AccountKey): string {
    const identityId = identities.get(key);
    if (!identityId) throw new Error(`review-identity-missing-${key}`);
    return identityId;
  }
}
