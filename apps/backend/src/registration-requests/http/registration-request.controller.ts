import { randomUUID } from 'node:crypto';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Readable } from 'node:stream';
import Busboy from 'busboy';
import type { IncomingHttpHeaders } from 'node:http';

import { AuthenticationGuard, type RequestActor } from '../../authentication/authentication.guard.js';
import { PublicRoute } from '../../authentication/public-route.decorator.js';
import type { RegistrationEvidenceCategory } from '../../generated/prisma/client.js';
import { ApplicantRequestService } from '../application/applicant-request.service.js';
import type { RegistrationRequestType } from '../domain/registration-request.types.js';
import {
  parseAcademyAdultPlayerCreate, parseAcademyMinorPlayerCreate, parseAdditionalAcademyAccountCreate, parseFormalAcademyCreate,
  parseNaturalPersonAcademyCreate, parsePersonalAdultCreate, parseRepresentedMinorCreate, parseRequestListQuery, parseRequestUpdate, parseTransitionCommand,
  parseIdentityConflictValidation,
  type SafeParseResult,
} from './registration-request.dto.js';
import { RegistrationRequestExceptionFilter, RegistrationRequestHttpError } from './registration-request-exception.filter.js';

type MultipartRequest = Readable & Readonly<{ actor: RequestActor; headers: IncomingHttpHeaders }>;

@Controller()
@UseGuards(AuthenticationGuard)
@UseFilters(RegistrationRequestExceptionFilter)
export class RegistrationRequestController {
  constructor(private readonly requests: ApplicantRequestService) {}

  @Post('registration-requests/personal-adult') @PublicRoute()
  createPersonalAdult(@Body() body: unknown) { return this.create('PERSONAL_ADULT', parsePersonalAdultCreate(body)); }
  @Post('registration-requests/represented-minor') @PublicRoute()
  createRepresentedMinor(@Body() body: unknown) { return this.create('REPRESENTED_MINOR', parseRepresentedMinorCreate(body)); }
  @Post('registration-requests/academies/formal') @PublicRoute()
  createFormalAcademy(@Body() body: unknown) { return this.create('FORMAL_ACADEMY', parseFormalAcademyCreate(body)); }
  @Post('registration-requests/academies/natural-person') @PublicRoute()
  createNaturalAcademy(@Body() body: unknown) { return this.create('NATURAL_PERSON_ACADEMY', parseNaturalPersonAcademyCreate(body)); }

  @Post('registration-requests/validate-identity') @PublicRoute() @HttpCode(200)
  async validatePublicIdentity(@Body() body: unknown) {
    const parsed = this.valid(parseIdentityConflictValidation(body));
    const result = await this.requests.validatePublicIdentity(parsed.requestType, this.conflictChecks(parsed.checks));
    if (result.outcome === 'not-found') throw new RegistrationRequestHttpError('not-found');
    if (result.outcome === 'conflict') throw new RegistrationRequestHttpError('validation', [this.conflictIssue(result.field)]);
    return { data: { available: true } };
  }

  @Post('academies/:academyId/registration-requests/validate-identity') @HttpCode(200)
  async validateAcademyIdentity(@Req() request: { actor: RequestActor }, @Param('academyId') academyId: string, @Body() body: unknown) {
    const parsed = this.valid(parseIdentityConflictValidation(body));
    const result = await this.requests.validateAcademyIdentity(request.actor.identityId, academyId, parsed.requestType, this.conflictChecks(parsed.checks));
    if (result.outcome === 'not-found') throw new RegistrationRequestHttpError('not-found');
    if (result.outcome === 'conflict') throw new RegistrationRequestHttpError('validation', [this.conflictIssue(result.field)]);
    return { data: { available: true } };
  }

  @Get('registration-requests/:requestId')
  async detail(@Req() request: { actor: RequestActor }, @Param('requestId') requestId: string) {
    const result = await this.requests.detailOwn(request.actor.identityId, requestId);
    if (result.outcome !== 'found') throw new RegistrationRequestHttpError('not-found');
    return { data: result.request };
  }

  @Patch('registration-requests/:requestId')
  async update(@Req() request: { actor: RequestActor }, @Param('requestId') requestId: string, @Body() body: unknown) {
    const parsed = this.valid(parseRequestUpdate(body));
    this.transition(await this.requests.update(request.actor.identityId, requestId, { ...parsed, idempotencyKey: randomUUID() }));
    return this.detail(request, requestId);
  }

  @Post('registration-requests/:requestId/submit')
  @HttpCode(200)
  async submit(@Req() request: { actor: RequestActor }, @Param('requestId') requestId: string, @Body() body: unknown) { this.transition(await this.requests.submit(request.actor.identityId, requestId, this.valid(parseTransitionCommand(body)))); return this.detail(request, requestId); }

  @Post('registration-requests/:requestId/resubmit')
  @HttpCode(200)
  async resubmit(@Req() request: { actor: RequestActor }, @Param('requestId') requestId: string, @Body() body: unknown) { this.transition(await this.requests.resubmit(request.actor.identityId, requestId, this.valid(parseTransitionCommand(body)))); return this.detail(request, requestId); }

  @Post('registration-requests/:requestId/evidence')
  async upload(@Req() request: MultipartRequest, @Param('requestId') requestId: string) {
    const result = await this.parseMultipartUpload(request, requestId);
    if (result.outcome === 'not-found') throw new RegistrationRequestHttpError('not-found');
    if (result.outcome === 'denied') throw new RegistrationRequestHttpError('not-found');
    if (result.outcome === 'conflict') throw new RegistrationRequestHttpError('stale-version');
    if (result.outcome === 'rejected') throw new RegistrationRequestHttpError(result.evidence.reason === 'ITEM_TOO_LARGE' || result.evidence.reason === 'REQUEST_TOTAL_TOO_LARGE' ? 'upload-too-large' : 'unsupported-evidence');
    return { data: result.evidence };
  }

  private parseMultipartUpload(request: MultipartRequest, requestId: string): Promise<Awaited<ReturnType<ApplicantRequestService['uploadEvidence']>>> {
    return new Promise((resolve, reject) => {
      let category: string | undefined;
      let expectedVersion: number | undefined;
      let upload: ReturnType<ApplicantRequestService['uploadEvidence']> | undefined;
      let fileSeen = false;
      let parser: ReturnType<typeof Busboy>;
      try { parser = Busboy({ headers: request.headers, limits: { files: 1, fields: 2 } }); }
      catch { reject(new RegistrationRequestHttpError('validation', [{ field: 'file', code: 'invalid_multipart' }])); return; }
      parser.on('field', (name, value) => {
        if (name === 'category') category = value;
        if (name === 'expectedVersion' && /^\d+$/.test(value)) expectedVersion = Number(value);
      });
      parser.on('file', (name, stream, info) => {
        fileSeen = true;
        if (name !== 'file' || !category || !Number.isInteger(expectedVersion)) {
          stream.resume();
          return;
        }
        upload = this.requests.uploadEvidence(request.actor.identityId, requestId, {
          expectedVersion: expectedVersion!, category: category as RegistrationEvidenceCategory,
          fileName: info.filename, declaredMime: info.mimeType, body: stream,
        });
      });
      parser.once('error', () => reject(new RegistrationRequestHttpError('validation', [{ field: 'file', code: 'invalid_multipart' }])));
      parser.once('close', () => {
        if (!fileSeen || !upload) { reject(new RegistrationRequestHttpError('validation', [{ field: 'file', code: 'invalid' }])); return; }
        void upload.then(resolve, reject);
      });
      request.pipe(parser);
    });
  }

  @Delete('registration-requests/:requestId/evidence/:evidenceId') @HttpCode(204)
  async retire(@Req() request: { actor: RequestActor }, @Param('requestId') requestId: string, @Param('evidenceId') evidenceId: string, @Query('expectedVersion') expectedVersion: string) {
    const version = Number(expectedVersion);
    if (!Number.isInteger(version) || version < 0) throw new RegistrationRequestHttpError('validation', [{ field: 'expectedVersion', code: 'invalid' }]);
    const result = await this.requests.retireEvidence(request.actor.identityId, requestId, evidenceId, version);
    if (result.outcome !== 'retired') throw new RegistrationRequestHttpError('not-found');
  }

  @Get('registration-requests/:requestId/deletion')
  async deletion(@Req() request: { actor: RequestActor }, @Param('requestId') requestId: string) { return { data: this.found(await this.requests.deletionStatus(request.actor.identityId, requestId)).deletion }; }

  @Post('academies/:academyId/registration-requests/accounts')
  createAccount(@Req() request: { actor: RequestActor }, @Param('academyId') academyId: string, @Body() body: unknown) { return this.createAcademy(request.actor.identityId, academyId, 'ADDITIONAL_ACADEMY_ACCOUNT', parseAdditionalAcademyAccountCreate(body)); }
  @Post('academies/:academyId/registration-requests/players/adult')
  createAdultPlayer(@Req() request: { actor: RequestActor }, @Param('academyId') academyId: string, @Body() body: unknown) { return this.createAcademy(request.actor.identityId, academyId, 'ACADEMY_ADULT_PLAYER', parseAcademyAdultPlayerCreate(body)); }
  @Post('academies/:academyId/registration-requests/players/minor')
  createMinorPlayer(@Req() request: { actor: RequestActor }, @Param('academyId') academyId: string, @Body() body: unknown) { return this.createAcademy(request.actor.identityId, academyId, 'ACADEMY_MINOR_PLAYER', parseAcademyMinorPlayerCreate(body)); }

  @Get('academies/:academyId/registration-requests')
  async listAcademy(@Req() request: { actor: RequestActor }, @Param('academyId') academyId: string, @Query() query: unknown) {
    const parsed = this.valid(parseRequestListQuery(query));
    const result = await this.requests.listAcademy(request.actor.identityId, academyId, { limit: parsed.limit, ...(parsed.cursor ? { cursor: parsed.cursor } : {}) });
    if ('outcome' in result) throw new RegistrationRequestHttpError('not-found');
    return { data: result.items, pagination: { hasMore: Boolean(result.nextCursor), ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}) } };
  }

  private async create(type: RegistrationRequestType, parsed: SafeParseResult<unknown>) { const result = await this.requests.createPublic(type, this.valid(parsed)); if (result.outcome === 'conflict' && result.field) throw new RegistrationRequestHttpError('validation', [this.conflictIssue(result.field)]); this.transition(result); if (result.outcome !== 'created') throw new RegistrationRequestHttpError('storage-unavailable'); return { data: result.data }; }
  private async createAcademy(identityId: string, academyId: string, type: RegistrationRequestType, parsed: SafeParseResult<unknown>) { const result = await this.requests.createAcademy(identityId, academyId, type, this.valid(parsed)); if (result.outcome === 'conflict' && result.field) throw new RegistrationRequestHttpError('validation', [this.conflictIssue(result.field)]); this.transition(result); if (result.outcome !== 'created') throw new RegistrationRequestHttpError('storage-unavailable'); return { data: result.data }; }
  private conflictChecks(checks: readonly ({ field: string; documentType: string; documentNumber: string } | { field: 'nit'; nit: string } | { field: 'academy.academyName'; academyName: string })[]) { const nit = checks.find((check): check is { field: 'nit'; nit: string } => 'nit' in check); const academyName = checks.find((check): check is { field: 'academy.academyName'; academyName: string } => 'academyName' in check); return { documents: checks.flatMap((check) => 'documentNumber' in check ? [{ field: check.field, documentType: check.documentType, documentNumber: check.documentNumber }] : []), ...(nit ? { nit: { field: 'nit', value: nit.nit } } : {}), ...(academyName ? { academyName: { field: academyName.field, value: academyName.academyName } } : {}) }; }
  private conflictIssue(field: string) { return { field, code: field === 'nit' ? 'nit_in_use' : field === 'academy.academyName' ? 'academy_name_in_use' : field === 'credentials.email' ? 'email_in_use' : 'document_in_use' }; }
  private valid<T>(parsed: SafeParseResult<T>): T { if (!parsed.ok) throw new RegistrationRequestHttpError('validation', parsed.issues); return parsed.value; }
  private found<T extends Readonly<{ outcome: string }>>(result: T) { if (result.outcome !== 'found') throw new RegistrationRequestHttpError('not-found'); return result;
  }
  private transition<T extends Readonly<{ outcome: string }>>(result: T) { if (result.outcome === 'not-found') throw new RegistrationRequestHttpError('not-found'); if (result.outcome === 'stale') throw new RegistrationRequestHttpError('stale-version'); if (result.outcome === 'invalid-transition' || result.outcome === 'invalid') throw new RegistrationRequestHttpError('validation'); if (result.outcome === 'conflict') throw new RegistrationRequestHttpError('duplicate-conflict'); if (result.outcome === 'unavailable') throw new RegistrationRequestHttpError('storage-unavailable'); return result; }
}
