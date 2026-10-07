import { Body, Controller, Get, Header, HttpCode, Optional, Param, Post, Query, Req, UseFilters, UseGuards } from '@nestjs/common';

import { AuthenticationGuard, type RequestActor } from '../../authentication/authentication.guard.js';
import { PassportCustodyCommandService } from '../application/passport-custody-command.service.js';
import { PassportCustodyDetailService } from '../application/passport-custody-detail.service.js';
import { PassportCustodyQueryService } from '../application/passport-custody-query.service.js';
import { PassportCustodyAuthorizationAdapter } from '../authorization/passport-custody-authorization.adapter.js';
import { parseAnalystQuery, parseAssignCustodyCommand, parseChangeCustodyCommand, parseCustodyPassportQuery, parseRemoveCustodyCommand } from './passport-custody.dto.js';
import { PassportCustodyExceptionFilter, PassportCustodyHttpError } from './passport-custody-exception.filter.js';

@Controller('admin/passport-custody')
@UseGuards(AuthenticationGuard)
@UseFilters(PassportCustodyExceptionFilter)
export class PassportCustodyController {
  constructor(
    private readonly queries: PassportCustodyQueryService,
    private readonly commands: PassportCustodyCommandService,
    private readonly authorization: PassportCustodyAuthorizationAdapter,
    @Optional() private readonly detailQueries?: PassportCustodyDetailService,
  ) {}

  @Get('analysts')
  @Header('Cache-Control', 'no-store')
  async analysts(@Req() request: { actor: RequestActor }, @Query() query: unknown) {
    const parsed = parseAnalystQuery(query);
    if (!parsed.ok) throw new PassportCustodyHttpError('validation', parsed.issues);
    const decision = await this.authorization.authorizeAdministrator(request.actor.identityId, 'passport.custody.list-analysts');
    if (!decision.allowed) throw new PassportCustodyHttpError('forbidden');
    const result = await this.queries.listAnalysts({
      limit: parsed.value.limit,
      ...(parsed.value.query === undefined ? {} : { query: parsed.value.query }),
      ...(parsed.value.cursor === undefined ? {} : { cursor: parsed.value.cursor }),
    });
    if ('outcome' in result) throw new PassportCustodyHttpError(result.outcome === 'invalid-cursor' ? 'validation' : 'unavailable');
    return { data: result.items, pagination: { hasMore: Boolean(result.nextCursor), ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}) } };
  }

  @Get('passports/:passportId')
  @Header('Cache-Control', 'no-store')
  async detail(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string) {
    if (!zUuid(passportId)) throw new PassportCustodyHttpError('not-found');
    const decision = await this.authorization.authorizeAdministrator(request.actor.identityId, 'passport.custody.view');
    if (!decision.allowed || !this.detailQueries) throw new PassportCustodyHttpError('not-found');
    const result = await this.detailQueries.get(passportId);
    if (result.outcome !== 'found') throw new PassportCustodyHttpError(result.outcome === 'not-found' ? 'not-found' : 'unavailable');
    const { creationMilestone: _presentationOnly, ...data } = result.detail;
    return { data };
  }

  @Get('passports')
  @Header('Cache-Control', 'no-store')
  async passports(@Req() request: { actor: RequestActor }, @Query() query: unknown) {
    const parsed = parseCustodyPassportQuery(query);
    if (!parsed.ok) throw new PassportCustodyHttpError('validation', parsed.issues);
    const decision = await this.authorization.authorizeAdministrator(request.actor.identityId, 'passport.custody.list');
    if (!decision.allowed) throw new PassportCustodyHttpError('forbidden');
    const result = await this.queries.listPassports({
      limit: parsed.value.limit,
      assignment: parsed.value.assignment,
      ...(parsed.value.query === undefined ? {} : { query: parsed.value.query }),
      ...(parsed.value.cursor === undefined ? {} : { cursor: parsed.value.cursor }),
      ...(parsed.value.analystId === undefined ? {} : { analystId: parsed.value.analystId }),
    });
    if ('outcome' in result) throw new PassportCustodyHttpError(result.outcome === 'invalid-cursor' ? 'validation' : 'unavailable');
    return { data: result.items, pagination: { hasMore: Boolean(result.nextCursor), ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}) } };
  }

  @Post('passports/:passportId/assign')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async assign(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string, @Body() body: unknown) {
    const parsed = parseAssignCustodyCommand(body);
    if (!parsed.ok || !zUuid(passportId)) throw new PassportCustodyHttpError('validation', parsed.ok ? [{ field: 'passportId', code: 'invalid_format' }] : parsed.issues);
    const decision = await this.authorization.authorizeAdministrator(request.actor.identityId, 'passport.custody.assign');
    if (!decision.allowed) throw new PassportCustodyHttpError('not-found');
    const result = await this.commands.assign({ passportId, administratorIdentityId: request.actor.identityId, ...parsed.value });
    return custodyCommandResponse(result);
  }

  @Post('passports/:passportId/change')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async change(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string, @Body() body: unknown) {
    const parsed = parseChangeCustodyCommand(body);
    if (!parsed.ok || !zUuid(passportId)) throw new PassportCustodyHttpError('validation', parsed.ok ? [{ field: 'passportId', code: 'invalid_format' }] : parsed.issues);
    const decision = await this.authorization.authorizeAdministrator(request.actor.identityId, 'passport.custody.change');
    if (!decision.allowed) throw new PassportCustodyHttpError('not-found');
    const result = await this.commands.change({ passportId, administratorIdentityId: request.actor.identityId, ...parsed.value });
    return custodyCommandResponse(result);
  }

  @Post('passports/:passportId/remove')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async remove(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string, @Body() body: unknown) {
    const parsed = parseRemoveCustodyCommand(body);
    if (!parsed.ok || !zUuid(passportId)) throw new PassportCustodyHttpError('validation', parsed.ok ? [{ field: 'passportId', code: 'invalid_format' }] : parsed.issues);
    const decision = await this.authorization.authorizeAdministrator(request.actor.identityId, 'passport.custody.remove');
    if (!decision.allowed) throw new PassportCustodyHttpError('not-found');
    const result = await this.commands.remove({ passportId, administratorIdentityId: request.actor.identityId, ...parsed.value });
    return custodyCommandResponse(result);
  }
}

const zUuid = (value: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function custodyCommandResponse(result: Awaited<ReturnType<PassportCustodyCommandService['change'] | PassportCustodyCommandService['remove']>>) {
  if (result.outcome !== 'applied' && result.outcome !== 'idempotent') {
    if (result.outcome === 'not-found') throw new PassportCustodyHttpError('not-found');
    if (result.outcome === 'invalid') throw new PassportCustodyHttpError('validation');
    if (result.outcome === 'unavailable') throw new PassportCustodyHttpError('unavailable');
    if (result.outcome === 'idempotency-conflict') throw new PassportCustodyHttpError('idempotency-conflict', [], result.current);
    throw new PassportCustodyHttpError('conflict', [], 'current' in result ? result.current : undefined);
  }
  return { data: { passportId: result.passportId, eventId: result.eventId, custody: result.custody }, idempotent: result.outcome === 'idempotent' };
}
