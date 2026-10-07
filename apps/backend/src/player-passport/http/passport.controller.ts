import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';

import { Query } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  PassportLifecycleAction,
  PassportLifecycleOutcome,
  PassportLifecycleState,
  PassportOrigin,
  type DominantFoot,
} from '../../generated/prisma/client.js';
import { PassportAuthorizationAdapter } from '../passport-authorization/passport-authorization.adapter.js';
import { DuplicateReviewService } from '../duplicate-review/duplicate-review.service.js';
import { PassportLifecycleService } from '../passport-lifecycle/passport-lifecycle.service.js';
import { PassportTransitionService, type PassportApprovalResult, type PassportTransitionResult } from '../passport-lifecycle/passport-transition.service.js';
import { PassportTransactionRunner } from '../passport-lifecycle/transaction-runner.js';
import { decryptPassportValue } from '../player-private-identity/passport-crypto.js';
import type { PassportKeyMaterial } from '../player-private-identity/passport-keys.js';
import { AuthenticationGuard, type RequestActor } from '../../authentication/authentication.guard.js';
import { PASSPORT_KEY_MATERIAL } from '../passport-key.token.js';
import {
  derivePassportCapabilities,
  toPassportInternalStatusResponse,
  toPassportListResponse,
  toPassportPresentationResponse,
  toPassportStatusResponse,
  toPassportSummaryResponse,
  type LifecycleEventProjection,
  type PassportCollectionAction,
  type PassportCapabilityContext,
  type PossibleDuplicateSignalProjection,
  type PassportStatusProjection,
} from './passport-presentation-mapper.js';
import { mapInternalPassportHistory, mapOrdinaryPassportHistory } from '../presentation/passport-history.mapper.js';
import { PlayerPassportService } from '../player-passport.service.js';
import { RepresentativeConfirmationService } from '../representation/representative-confirmation.service.js';
import {
  parseCreateDraftRequest,
  parseEditDraftRequest,
  parseListAcademyId,
  parseListContext,
  parseRepresentationConfirmationRequest,
  parseResolveDuplicateRequest,
  parseReturnRequest,
  parseVersionRequest,
} from './passport.dto.js';

type Response = { setHeader(name: string, value: string): Response; status(code: number): Response };

type PassportProjection = Readonly<{
  id: string;
  playerId: string;
  state: PassportLifecycleState;
  originKind: PassportOrigin;
  position: string;
  ageCategory: string;
  city: string;
  country: string;
  dominantFoot: DominantFoot;
  createdByIdentityId: string;
  originAcademyId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

const PASSPORT_SELECT = {
  id: true,
  playerId: true,
  state: true,
  originKind: true,
  position: true,
  ageCategory: true,
  city: true,
  country: true,
  dominantFoot: true,
  createdByIdentityId: true,
  originAcademyId: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;

const SIGNAL_SELECT = {
  id: true,
  status: true,
  resolution: true,
  createdAt: true,
  resolvedAt: true,
  resolvedByIdentityId: true,
} as const;

const EVENT_SELECT = {
  id: true,
  action: true,
  outcome: true,
  actorIdentityId: true,
  priorState: true,
  resultingState: true,
  details: true,
  createdAt: true,
} as const;

@Controller('passports')
@UseGuards(AuthenticationGuard)
export class PassportController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: PassportAuthorizationAdapter,
    private readonly lifecycle: PassportLifecycleService,
    private readonly transitions: PassportTransitionService,
    private readonly duplicates: DuplicateReviewService,
    private readonly transactionRunner: PassportTransactionRunner,
    private readonly passports: PlayerPassportService,
    @Inject(PASSPORT_KEY_MATERIAL) private readonly passportKeys: PassportKeyMaterial,
  ) {}

  @Get()
  async list(@Req() request: { actor: RequestActor }, @Query('context') rawContext: unknown, @Query('academyId') rawAcademyId: unknown, @Res({ passthrough: true }) response: Response) {
    this.noStore(response);
    const context = parseListContext(rawContext);
    if (!context) return this.error(response, 400, 'invalid_request');
    const academyId = parseListAcademyId(context, rawAcademyId);
    if (academyId === null) return this.error(response, 400, 'invalid_request');
    const [collectionCapabilities, reviewAccess, activationAccess] = await Promise.all([
      this.collectionCapabilities(request.actor.identityId),
      this.canReview(request.actor.identityId),
      this.canActivate(request.actor.identityId),
    ]);
    if (!collectionCapabilities.includes('create') && !reviewAccess.allowed && !activationAccess.allowed) {
      return this.error(response, 403, 'forbidden');
    }

    const passports = await this.passports.listAccessible(request.actor.identityId, context, academyId);
    const summaries: ReturnType<typeof toPassportSummaryResponse>[] = [];
    for (const passport of passports as PassportProjection[]) {
      const capabilities = await this.accessibleCapabilities(request.actor.identityId, passport);
      if (capabilities) summaries.push(toPassportSummaryResponse(await this.enrichPassport(passport), capabilities));
    }
    return toPassportListResponse(summaries, collectionCapabilities, context);
  }

  @Post('drafts')
  async createDraft(@Req() request: { actor: RequestActor }, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    this.noStore(response);
    const parsed = parseCreateDraftRequest(body);
    if (!parsed.ok) return this.error(response, 400, 'invalid_request');

    if (parsed.value.managementContext) {
      const result = await this.passports.createDraft({
        actorIdentityId: request.actor.identityId,
        managementContext: parsed.value.managementContext,
        ...(parsed.value.academyId ? { academyId: parsed.value.academyId } : {}),
        ...(parsed.value.representativeConfirmationId ? { representativeConfirmationId: parsed.value.representativeConfirmationId } : {}),
        ...(parsed.value.representative ? { representative: parsed.value.representative } : {}),
        privateIdentity: { legalName: parsed.value.legalName, dateOfBirth: parsed.value.dateOfBirth, documentType: parsed.value.documentType, documentNumber: parsed.value.documentNumber },
        profile: { position: parsed.value.position, ageCategory: parsed.value.ageCategory, city: parsed.value.city, country: parsed.value.country, dominantFoot: parsed.value.dominantFoot },
      });
      if (result.outcome === 'invalid') return this.error(response, 400, 'invalid_request');
      if (result.outcome === 'forbidden') return this.error(response, 403, 'forbidden');
      if (result.outcome === 'duplicate-document' || result.outcome === 'conflict') return this.error(response, 409, 'conflict');
      if (result.outcome === 'unavailable') return this.error(response, 500, 'internal_error');
      if (result.outcome !== 'created') return this.error(response, 500, 'internal_error');
      const correctivePassport = await this.loadPassport(result.passportId);
      if (!correctivePassport) return this.error(response, 500, 'internal_error');
      response.status(201);
      return toPassportStatusResponse(await this.enrichPassport(correctivePassport), await this.capabilitiesFor(request.actor.identityId, correctivePassport));
    }

    const tutorCreate = await this.authorization.authorize({ identityId: request.actor.identityId, permission: 'passport.tutor.create' });
    let origin: PassportOrigin;
    let academyId: string | null = null;
    if (tutorCreate.allowed) {
      origin = PassportOrigin.TUTOR;
    } else {
      const academyCreate = await this.authorization.authorize({ identityId: request.actor.identityId, permission: 'passport.academy.create' });
      if (!academyCreate.allowed) return this.error(response, 403, 'forbidden');
      academyId = await this.authorization.activeAcademyId(request.actor.identityId);
      if (!academyId) return this.error(response, 403, 'forbidden');
      origin = PassportOrigin.ACADEMY;
    }

    const created = await this.lifecycle.createDraft({
      actorIdentityId: request.actor.identityId,
      origin,
      academyId,
      privateIdentity: {
        legalName: parsed.value.legalName,
        dateOfBirth: parsed.value.dateOfBirth,
        documentType: parsed.value.documentType,
        documentNumber: parsed.value.documentNumber,
      },
      profile: {
        position: parsed.value.position,
        ageCategory: parsed.value.ageCategory,
        city: parsed.value.city,
        country: parsed.value.country,
        dominantFoot: parsed.value.dominantFoot,
      },
    });

    if (created.outcome === 'invalid') return this.error(response, 400, 'invalid_request');
    if (created.outcome === 'duplicate-document') return this.error(response, 409, 'duplicate_passport');
    if (created.outcome === 'unavailable') return this.error(response, 500, 'internal_error');

    const passport = await this.loadPassport(created.passportId);
    if (!passport) return this.error(response, 500, 'internal_error');
    const capabilities = await this.capabilitiesFor(request.actor.identityId, passport);
    response.status(201);
    return toPassportStatusResponse(await this.enrichPassport(passport), capabilities);
  }

  @Get(':passportId')
  async status(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string, @Res({ passthrough: true }) response: Response) {
    this.noStore(response);
    const passport = await this.loadPassport(passportId);
    if (!passport) return this.error(response, 404, 'passport_not_found');

    const context = await this.authorizationContext(request.actor.identityId, passport);
    if (!context.manage && !context.review && !context.activate) return this.error(response, 404, 'passport_not_found');
    const capabilities = derivePassportCapabilities(context);

    if (context.manage) {
      const status: PassportStatusProjection = { ...passport };
      if (passport.state === PassportLifecycleState.RETURNED_FOR_CORRECTION) {
        const latestReturn = await this.prisma.passportReviewReturn.findFirst({
          where: { passportId },
          orderBy: { createdAt: 'desc' },
          select: { reason: true },
        });
        if (latestReturn) status.correctionReason = latestReturn.reason;
      }
      return toPassportStatusResponse(await this.enrichPassport(status as PassportProjection), capabilities);
    }

    const signals = await this.loadSignals(passportId);
    return toPassportInternalStatusResponse(await this.enrichPassport(passport), capabilities, signals);
  }

  @Get(':passportId/presentation')
  async presentation(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string, @Res({ passthrough: true }) response: Response) {
    this.noStore(response);
    const passport = await this.loadPassport(passportId);
    if (!passport) return this.error(response, 404, 'passport_not_found');

    const context = await this.authorizationContext(request.actor.identityId, passport);
    if (!context.manage && !context.review && !context.activate) return this.error(response, 404, 'passport_not_found');
    const displayName = await this.loadDisplayName(passport.playerId);
    const academyOriginName = passport.originAcademyId ? await this.loadAcademyName(passport.originAcademyId) : null;
    return toPassportPresentationResponse({ ...passport, displayName, academyOriginName }, derivePassportCapabilities(context));
  }

  @Get(':passportId/draft')
  async privateDraft(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string, @Res({ passthrough: true }) response: Response) {
    this.noStore(response);
    if (!await this.canManage(request.actor.identityId, passportId)) return this.error(response, 404, 'passport_not_found');
    const draft = await this.passports.editableDraft(passportId);
    return draft ?? this.error(response, 409, 'invalid_state');
  }

  @Patch(':passportId/draft')
  async edit(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    this.noStore(response);
    const parsed = parseEditDraftRequest(body);
    if (!parsed.ok) return this.error(response, 400, 'invalid_request');

    const passport = await this.loadPassport(passportId);
    if (!passport) return this.error(response, 404, 'passport_not_found');
    if (!await this.canManage(request.actor.identityId, passportId)) return this.error(response, 403, 'forbidden');

    if (parsed.value.legalName !== undefined || parsed.value.dateOfBirth !== undefined || parsed.value.documentType !== undefined || parsed.value.documentNumber !== undefined || parsed.value.expectedVersion !== undefined) {
      const result = await this.passports.updateDraft(passportId, {
        actorIdentityId: request.actor.identityId,
        ...(parsed.value.expectedVersion === undefined ? {} : { expectedVersion: parsed.value.expectedVersion }),
        privateIdentity: {
          ...(parsed.value.legalName === undefined ? {} : { legalName: parsed.value.legalName }),
          ...(parsed.value.dateOfBirth === undefined ? {} : { dateOfBirth: parsed.value.dateOfBirth }),
          ...(parsed.value.documentType === undefined ? {} : { documentType: parsed.value.documentType }),
          ...(parsed.value.documentNumber === undefined ? {} : { documentNumber: parsed.value.documentNumber }),
        },
        profile: {
          ...(parsed.value.position === undefined ? {} : { position: parsed.value.position }),
          ...(parsed.value.ageCategory === undefined ? {} : { ageCategory: parsed.value.ageCategory }),
          ...(parsed.value.city === undefined ? {} : { city: parsed.value.city }),
          ...(parsed.value.country === undefined ? {} : { country: parsed.value.country }),
          ...(parsed.value.dominantFoot === undefined ? {} : { dominantFoot: parsed.value.dominantFoot }),
        },
      });
      if (result.outcome === 'conflict' || result.outcome === 'duplicate-document') return this.error(response, 409, 'conflict');
      if (result.outcome !== 'applied') return this.error(response, result.outcome === 'invalid-state' ? 409 : 500, result.outcome === 'invalid-state' ? 'invalid_state' : 'internal_error');
      const updatedPrivateDraft = await this.loadPassport(passportId);
      if (!updatedPrivateDraft) return this.error(response, 500, 'internal_error');
      return toPassportStatusResponse(await this.enrichPassport(updatedPrivateDraft), derivePassportCapabilities(await this.authorizationContext(request.actor.identityId, updatedPrivateDraft)));
    }

    const result = await this.transactionRunner.execute((transaction) => this.transitions.edit(transaction, {
      passportId,
      actorIdentityId: request.actor.identityId,
      profile: parsed.value,
    }));
    if (result.outcome !== 'applied') return this.transitionError(response, result);

    const updated = await this.loadPassport(passportId);
    if (!updated) return this.error(response, 500, 'internal_error');
    return toPassportStatusResponse(await this.enrichPassport(updated), derivePassportCapabilities(await this.authorizationContext(request.actor.identityId, updated)));
  }

  @Post(':passportId/submit')
  @HttpCode(200)
  async submit(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    this.noStore(response);
    const parsed = parseVersionRequest(body);
    if (!parsed.ok) return this.error(response, 400, 'invalid_request');
    const passport = await this.loadPassport(passportId);
    if (!passport) return this.error(response, 404, 'passport_not_found');
    if (!await this.canManage(request.actor.identityId, passportId)) return this.error(response, 403, 'forbidden');
    if (!await this.passports.ageAuthorityCompatible(passportId)) return this.error(response, 409, 'authority_not_available');

    const result = await this.transactionRunner.execute((transaction) => this.transitions.submit(transaction, {
      passportId,
      actorIdentityId: request.actor.identityId,
      ...parsed.value,
    }));
    if (result.outcome !== 'applied') return this.transitionError(response, result);

    const updated = await this.loadPassport(passportId);
    if (!updated) return this.error(response, 500, 'internal_error');
    return toPassportStatusResponse(await this.enrichPassport(updated), derivePassportCapabilities(await this.authorizationContext(request.actor.identityId, updated)));
  }

  @Post(':passportId/return')
  @HttpCode(200)
  async returnForCorrection(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    this.noStore(response);
    const parsed = parseReturnRequest(body);
    if (!parsed.ok) return this.error(response, 400, 'invalid_request');

    const passport = await this.loadPassport(passportId);
    if (!passport) return this.error(response, 404, 'passport_not_found');
    if (!(await this.canReview(request.actor.identityId, passportId)).allowed) return this.error(response, 403, 'forbidden');

    const result = await this.transactionRunner.execute((transaction) => this.transitions.returnForCorrection(transaction, {
      passportId,
      analystIdentityId: request.actor.identityId,
      reason: parsed.value.reason,
      ...(parsed.value.expectedVersion === undefined ? {} : { expectedVersion: parsed.value.expectedVersion }),
    }));
    if (result.outcome !== 'applied') return this.transitionError(response, result);

    const updated = await this.loadPassport(passportId);
    if (!updated) return this.error(response, 500, 'internal_error');
    return toPassportStatusResponse(await this.enrichPassport(updated), derivePassportCapabilities(await this.authorizationContext(request.actor.identityId, updated)));
  }

  @Post(':passportId/possible-duplicate/resolve')
  @HttpCode(200)
  async resolvePossibleDuplicate(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    this.noStore(response);
    const parsed = parseResolveDuplicateRequest(body);
    if (!parsed.ok) return this.error(response, 400, 'invalid_request');

    const passport = await this.loadPassport(passportId);
    if (!passport) return this.error(response, 404, 'passport_not_found');
    if (!(await this.canReview(request.actor.identityId, passportId)).allowed) return this.error(response, 403, 'forbidden');

    const result = await this.transactionRunner.execute(async (transaction) => {
      const signal = await transaction.passportPossibleDuplicateSignal.findFirst({
        where: { passportId, status: 'UNRESOLVED' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!signal) return { outcome: 'invalid-state' as const };
      return this.duplicates.resolve(transaction, {
        passportId,
        signalId: signal.id,
        analystIdentityId: request.actor.identityId,
        resolution: parsed.value.resolution,
        ...(parsed.value.correctionReason === undefined ? {} : { correctionReason: parsed.value.correctionReason }),
        ...(parsed.value.expectedVersion === undefined ? {} : { expectedVersion: parsed.value.expectedVersion }),
      });
    });

    if (result.outcome === 'resolved') {
      const updated = await this.loadPassport(passportId);
      if (!updated) return this.error(response, 500, 'internal_error');
      const context = await this.authorizationContext(request.actor.identityId, updated);
      return toPassportInternalStatusResponse(await this.enrichPassport(updated), derivePassportCapabilities(context), await this.loadSignals(passportId));
    }
    if (result.outcome === 'not-found') return this.error(response, 404, 'passport_not_found');
    if (result.outcome === 'invalid' || result.outcome === 'missing-reason') return this.error(response, 400, 'invalid_request');
    if (result.outcome === 'invalid-state') return this.error(response, 409, 'invalid_state');
    return this.error(response, 500, 'internal_error');
  }

  @Post(':passportId/approve')
  @HttpCode(200)
  async approve(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    this.noStore(response);
    const parsed = parseVersionRequest(body);
    if (!parsed.ok) return this.error(response, 400, 'invalid_request');
    const passport = await this.loadPassport(passportId);
    if (!passport) return this.error(response, 404, 'passport_not_found');
    if (!(await this.canReview(request.actor.identityId, passportId)).allowed) return this.error(response, 403, 'forbidden');

    const result = await this.transactionRunner.execute((transaction) => this.transitions.approve(transaction, {
      passportId,
      analystIdentityId: request.actor.identityId,
      ...parsed.value,
    }));
    if (result.outcome !== 'applied') return this.approvalError(response, result);

    const updated = await this.loadPassport(passportId);
    if (!updated) return this.error(response, 500, 'internal_error');
    return toPassportInternalStatusResponse(await this.enrichPassport(updated), derivePassportCapabilities(await this.authorizationContext(request.actor.identityId, updated)), await this.loadSignals(passportId));
  }

  @Post(':passportId/activate')
  @HttpCode(200)
  async activate(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    this.noStore(response);
    const parsed = parseVersionRequest(body);
    if (!parsed.ok) return this.error(response, 400, 'invalid_request');
    const passport = await this.loadPassport(passportId);
    if (!passport) return this.error(response, 404, 'passport_not_found');
    if (!(await this.canActivate(request.actor.identityId)).allowed) return this.error(response, 403, 'forbidden');

    const result = await this.transactionRunner.execute((transaction) => this.transitions.activate(transaction, {
      passportId,
      administratorIdentityId: request.actor.identityId,
      ...parsed.value,
    }));
    if (result.outcome !== 'applied') return this.activationError(response, result);

    const updated = await this.loadPassport(passportId);
    if (!updated) return this.error(response, 500, 'internal_error');
    return toPassportInternalStatusResponse(await this.enrichPassport(updated), derivePassportCapabilities(await this.authorizationContext(request.actor.identityId, updated)), await this.loadSignals(passportId));
  }

  @Get(':passportId/history')
  async history(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string, @Res({ passthrough: true }) response: Response) {
    this.noStore(response);
    const passport = await this.loadPassport(passportId);
    if (!passport) return this.error(response, 404, 'passport_not_found');
    if (!await this.canViewOrdinaryHistory(request.actor.identityId, passportId)) return this.error(response, 404, 'passport_not_found');

    const events = await this.prisma.passportLifecycleEvent.findMany({
      where: { passportId },
      orderBy: { createdAt: 'asc' },
      select: EVENT_SELECT,
    });
    return { passportId, events: mapOrdinaryPassportHistory(events as LifecycleEventProjection[]).map((event) => ({
      eventId: event.eventId,
      action: event.action === 'EDITED' ? 'MATERIAL_UPDATED' : event.action,
      occurredAt: event.createdAt,
      outcome: event.outcome === 'APPLIED' ? 'SUCCEEDED' : 'REJECTED',
      previousState: event.priorState ?? null,
      resultingState: event.resultingState ?? null,
      creatorSafeReason: null,
    })).filter((event) => ['CREATED', 'MATERIAL_UPDATED', 'SUBMITTED', 'RETURNED_FOR_CORRECTION', 'RESUBMITTED', 'APPROVED', 'ACTIVATED'].includes(event.action)) };
  }

  @Get([':passportId/internal-history', ':passportId/history/internal'])
  async internalHistory(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string, @Res({ passthrough: true }) response: Response) {
    this.noStore(response);
    const passport = await this.loadPassport(passportId);
    if (!passport) return this.error(response, 404, 'passport_not_found');
    const decision = await this.authorization.authorize({
      identityId: request.actor.identityId,
      permission: 'passport.history.internal',
      passportId,
    });
    if (!decision.allowed) return this.error(response, 404, 'passport_not_found');

    const events = await this.prisma.passportLifecycleEvent.findMany({
      where: { passportId },
      orderBy: { createdAt: 'asc' },
      select: EVENT_SELECT,
    });
    return { passportId, events: mapInternalPassportHistory(events as LifecycleEventProjection[]).map((event) => ({
      eventId: event.eventId,
      action: event.action === 'EDITED' ? 'MATERIAL_UPDATED' : event.action,
      occurredAt: event.createdAt,
      outcome: event.outcome === 'APPLIED' ? 'SUCCEEDED' : 'REJECTED',
      actorIdentityId: event.actorIdentityId,
      previousState: event.priorState ?? null,
      resultingState: event.resultingState ?? null,
      safeInternalResult: 'resolution' in event && typeof event.resolution === 'string' ? event.resolution : null,
    })) };
  }

  private async canViewOrdinaryHistory(identityId: string, passportId: string): Promise<boolean> {
    const decisions = await Promise.all([
      this.authorization.authorize({ identityId, permission: 'passport.history.particular', passportId }),
      this.authorization.authorize({ identityId, permission: 'passport.history.tutor', passportId }),
      this.authorization.authorize({ identityId, permission: 'passport.history.academy', passportId }),
    ]);
    return decisions.some((decision) => decision.allowed);
  }

  private async loadPassport(passportId: string): Promise<PassportProjection | null> {
    const passport = await this.prisma.playerPassport.findUnique({ where: { id: passportId }, select: PASSPORT_SELECT });
    return passport as PassportProjection | null;
  }

  private async enrichPassport<T extends PassportProjection>(passport: T): Promise<T & { displayName: string | null; academyOriginName: string | null }> {
    const [displayName, academyOriginName] = await Promise.all([
      this.loadDisplayName(passport.playerId),
      passport.originAcademyId ? this.loadAcademyName(passport.originAcademyId) : Promise.resolve(null),
    ]);
    return { ...passport, displayName, academyOriginName };
  }

  private async loadSignals(passportId: string): Promise<PossibleDuplicateSignalProjection[]> {
    const signals = await this.prisma.passportPossibleDuplicateSignal.findMany({
      where: { passportId },
      orderBy: { createdAt: 'asc' },
      select: SIGNAL_SELECT,
    });
    return signals as PossibleDuplicateSignalProjection[];
  }

  private async loadDisplayName(playerId: string): Promise<string | null> {
    const identity = await this.prisma.playerPrivateIdentity.findUnique({
      where: { playerId },
      select: { encryptedLegalName: true },
    });
    if (!identity) return null;
    try {
      return decryptPassportValue(this.passportKeys.privateEncryptionKey, identity.encryptedLegalName);
    } catch {
      return null;
    }
  }

  private async loadAcademyName(academyId: string): Promise<string | null> {
    const academy = await this.prisma.academy.findUnique({ where: { id: academyId }, select: { displayName: true } });
    return academy?.displayName ?? null;
  }

  private async canManage(identityId: string, passportId: string): Promise<boolean> {
    const particular = await this.authorization.authorize({ identityId, permission: 'passport.particular.manage', passportId });
    if (particular.allowed) return true;
    const tutor = await this.authorization.authorize({ identityId, permission: 'passport.tutor.manage', passportId });
    if (tutor.allowed) return true;
    const academy = await this.authorization.authorize({ identityId, permission: 'passport.academy.manage', passportId });
    return academy.allowed;
  }

  private canReview(identityId: string, passportId?: string) {
    return this.authorization.authorize({ identityId, permission: 'passport.review', ...(passportId ? { passportId } : {}) });
  }

  private canActivate(identityId: string) {
    return this.authorization.authorize({ identityId, permission: 'passport.activate' });
  }

  private async authorizationContext(identityId: string, passport: PassportProjection): Promise<PassportCapabilityContext> {
    const [particularManage, tutorManage, academyManage, review, activate, particularHistory, tutorHistory, academyHistory, internalHistory, unresolved, confirmedExisting] = await Promise.all([
      this.authorization.authorize({ identityId, permission: 'passport.particular.manage', passportId: passport.id }),
      this.authorization.authorize({ identityId, permission: 'passport.tutor.manage', passportId: passport.id }),
      this.authorization.authorize({ identityId, permission: 'passport.academy.manage', passportId: passport.id }),
      this.authorization.authorize({ identityId, permission: 'passport.review', passportId: passport.id }),
      this.authorization.authorize({ identityId, permission: 'passport.activate', passportId: passport.id }),
      this.authorization.authorize({ identityId, permission: 'passport.history.particular', passportId: passport.id }),
      this.authorization.authorize({ identityId, permission: 'passport.history.tutor', passportId: passport.id }),
      this.authorization.authorize({ identityId, permission: 'passport.history.academy', passportId: passport.id }),
      this.authorization.authorize({ identityId, permission: 'passport.history.internal', passportId: passport.id }),
      this.prisma.passportPossibleDuplicateSignal.count({ where: { passportId: passport.id, status: 'UNRESOLVED' } }),
      this.prisma.passportPossibleDuplicateSignal.count({ where: { passportId: passport.id, resolution: 'CONFIRMED_EXISTING_PLAYER' } }),
    ]);

    return {
      manage: particularManage.allowed || tutorManage.allowed || academyManage.allowed,
      review: review.allowed,
      activate: activate.allowed,
      history: particularHistory.allowed || tutorHistory.allowed || academyHistory.allowed || internalHistory.allowed,
      state: passport.state,
      hasUnresolvedDuplicateSignal: unresolved > 0,
      hasConfirmedExistingPlayerResolution: confirmedExisting > 0,
    };
  }

  private async accessibleCapabilities(identityId: string, passport: PassportProjection): Promise<ReturnType<typeof derivePassportCapabilities> | null> {
    const context = await this.authorizationContext(identityId, passport);
    if (!context.manage && !context.review && !context.activate) return null;
    return derivePassportCapabilities(context);
  }

  private async capabilitiesFor(identityId: string, passport: PassportProjection) {
    return derivePassportCapabilities(await this.authorizationContext(identityId, passport));
  }

  private async collectionCapabilities(identityId: string): Promise<PassportCollectionAction[]> {
    const [particularCreate, tutorCreate, academyCreate] = await Promise.all([
      this.authorization.authorize({ identityId, permission: 'passport.particular.create' }),
      this.authorization.authorize({ identityId, permission: 'passport.tutor.create' }),
      this.authorization.authorize({ identityId, permission: 'passport.academy.create' }),
    ]);
    return particularCreate.allowed || tutorCreate.allowed || academyCreate.allowed ? ['create'] : [];
  }

  private transitionError(response: Response, result: PassportTransitionResult) {
    if (result.outcome === 'not-found') return this.error(response, 404, 'passport_not_found');
    if (result.outcome === 'invalid') return this.error(response, 400, 'invalid_request');
    if (result.outcome === 'invalid-state') return this.error(response, 409, 'invalid_state');
    return this.error(response, 500, 'internal_error');
  }

  private approvalError(response: Response, result: PassportApprovalResult) {
    if (result.outcome === 'not-found') return this.error(response, 404, 'passport_not_found');
    if (result.outcome === 'invalid') return this.error(response, 400, 'invalid_request');
    if (result.outcome === 'invalid-state') return this.error(response, 409, 'invalid_state');
    if (result.outcome === 'unresolved-duplicate') return this.error(response, 409, 'unresolved_duplicate_signal');
    return this.error(response, 500, 'internal_error');
  }

  private activationError(response: Response, result: PassportApprovalResult | Readonly<{ outcome: 'applied' | 'not-found' | 'invalid' | 'invalid-state' | 'unavailable' }>) {
    if (result.outcome === 'not-found') return this.error(response, 404, 'passport_not_found');
    if (result.outcome === 'invalid') return this.error(response, 400, 'invalid_request');
    if (result.outcome === 'invalid-state') return this.error(response, 409, 'invalid_state');
    return this.error(response, 500, 'internal_error');
  }

  private noStore(response: Response) {
    response.setHeader('Cache-Control', 'no-store');
  }

  private error(response: Response, status: number, error: string) {
    response.status(status);
    return { code: error, message: this.errorMessage(error) };
  }

  private errorMessage(code: string): string {
    if (code === 'passport_not_found') return 'Passport not found';
    if (code === 'forbidden') return 'Forbidden';
    if (code === 'invalid_request') return 'Invalid request';
    if (code === 'authority_not_available') return 'Authority not available';
    if (code === 'invalid_state') return 'Invalid lifecycle state';
    if (code === 'unresolved_duplicate_signal') return 'Duplicate review is required';
    if (code === 'conflict' || code === 'duplicate_passport') return 'Conflict';
    return 'Service unavailable';
  }
}

@Controller('passport-representation-confirmations')
@UseGuards(AuthenticationGuard)
export class PassportRepresentationController {
  constructor(
    private readonly authorization: PassportAuthorizationAdapter,
    private readonly confirmations: RepresentativeConfirmationService,
  ) {}

  @Post()
  async createRepresentativeConfirmation(@Req() request: { actor: RequestActor }, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    const parsed = parseRepresentationConfirmationRequest(body);
    if (!parsed.ok) { response.status(400); return { code: 'invalid_request', message: 'Invalid request' }; }
    const decision = await this.authorization.authorize({ identityId: request.actor.identityId, permission: 'passport.particular.create' });
    if (!decision.allowed) { response.status(403); return { code: 'forbidden', message: 'Forbidden' }; }
    const confirmation = await this.confirmations.createForPlayerDocument({
      representativeIdentityId: request.actor.identityId,
      legalName: parsed.value.representative.legalName,
      documentType: parsed.value.representative.documentType,
      documentNumber: parsed.value.representative.documentNumber,
      relationship: parsed.value.representative.relationship,
      playerDocumentType: parsed.value.playerDocument.documentType,
      playerDocumentNumber: parsed.value.playerDocument.documentNumber,
    });
    response.status(201);
    return { confirmationId: confirmation.id, expiresAt: confirmation.expiresAt.toISOString() };
  }
}
