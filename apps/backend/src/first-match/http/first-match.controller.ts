import { Body, Controller, Get, Header, HttpCode, Param, Post, Put, Query, Req, UseFilters, UseGuards } from '@nestjs/common';

import { AuthenticationGuard, type RequestActor } from '../../authentication/authentication.guard.js';
import { FirstMatchCommand } from '../application/first-match-command.js';
import { FirstMatchQuery } from '../application/first-match-query.js';
import { parseCancelCommand, parseMatchDate, parseRescheduleCommand, parseScheduleCommand, validPassportId } from './first-match.dto.js';
import { FirstMatchExceptionFilter, FirstMatchHttpError } from './first-match-exception.filter.js';

@Controller('passports/:passportId/first-match')
@UseGuards(AuthenticationGuard)
@UseFilters(FirstMatchExceptionFilter)
export class FirstMatchController {
  constructor(private readonly query: FirstMatchQuery, private readonly command: FirstMatchCommand) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async get(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string) {
    if (!validPassportId(passportId)) throw new FirstMatchHttpError('not-found');
    const result = await this.query.get({ passportId, actorIdentityId: request.actor.identityId });
    if (result.outcome !== 'ok') throw new FirstMatchHttpError(result.outcome);
    return result.flow;
  }

  @Get('allowance')
  @Header('Cache-Control', 'no-store')
  async preview(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string,
    @Query('matchDate') rawMatchDate: unknown) {
    if (!validPassportId(passportId)) throw new FirstMatchHttpError('not-found');
    const matchDate = parseMatchDate(rawMatchDate);
    if (!matchDate) throw new FirstMatchHttpError('invalid');
    const result = await this.query.preview({ passportId, actorIdentityId: request.actor.identityId, matchDate });
    if (result.outcome !== 'ok') throw new FirstMatchHttpError(result.outcome);
    return result.availability;
  }

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async schedule(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string, @Body() body: unknown) {
    if (!validPassportId(passportId)) throw new FirstMatchHttpError('not-found');
    const parsed = parseScheduleCommand(body);
    if (!parsed.ok) throw new FirstMatchHttpError('invalid');
    const result = await this.command.schedule({ passportId, actorIdentityId: request.actor.identityId, ...parsed.value });
    if (result.outcome !== 'applied' && result.outcome !== 'idempotent') throw new FirstMatchHttpError(result.outcome);
    const current = await this.query.get({ passportId, actorIdentityId: request.actor.identityId });
    if (current.outcome !== 'ok') throw new FirstMatchHttpError(current.outcome);
    return current.flow;
  }

  @Put(':matchId')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async reschedule(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string,
    @Param('matchId') matchId: string, @Body() body: unknown) {
    if (!validPassportId(passportId) || !validPassportId(matchId)) throw new FirstMatchHttpError('not-found');
    const parsed = parseRescheduleCommand(body);
    if (!parsed.ok) throw new FirstMatchHttpError('invalid');
    const result = await this.command.reschedule({ passportId, matchId, actorIdentityId: request.actor.identityId, ...parsed.value });
    if (result.outcome !== 'applied' && result.outcome !== 'idempotent') throw new FirstMatchHttpError(result.outcome);
    const current = await this.query.get({ passportId, actorIdentityId: request.actor.identityId });
    if (current.outcome !== 'ok') throw new FirstMatchHttpError(current.outcome);
    return current.flow;
  }

  @Post(':matchId/cancel')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async cancel(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string,
    @Param('matchId') matchId: string, @Body() body: unknown) {
    if (!validPassportId(passportId) || !validPassportId(matchId)) throw new FirstMatchHttpError('not-found');
    const parsed = parseCancelCommand(body);
    if (!parsed.ok) throw new FirstMatchHttpError('invalid');
    const result = await this.command.cancel({ passportId, matchId, actorIdentityId: request.actor.identityId, ...parsed.value });
    if (result.outcome !== 'applied' && result.outcome !== 'idempotent') throw new FirstMatchHttpError(result.outcome);
    const current = await this.query.get({ passportId, actorIdentityId: request.actor.identityId });
    if (current.outcome !== 'ok') throw new FirstMatchHttpError(current.outcome);
    return current.flow;
  }
}
