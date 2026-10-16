import { Controller, Get, Header, Param, Query, Req, UseFilters, UseGuards } from '@nestjs/common';

import { AuthenticationGuard, type RequestActor } from '../../authentication/authentication.guard.js';
import { AnalystWorkspaceAccessError } from '../application/analyst-workspace-access.js';
import { AnalystOverview } from '../application/analyst-overview.js';
import { AnalystPassports } from '../application/analyst-passports.js';
import { AnalystMatches } from '../application/analyst-matches.js';
import { AnalystWorkspaceExceptionFilter } from './analyst-workspace-exception.filter.js';
import { AnalystWorkspaceQueryError } from './analyst-workspace-query.error.js';

@Controller('analyst/workspace')
@UseGuards(AuthenticationGuard)
@UseFilters(AnalystWorkspaceExceptionFilter)
export class AnalystWorkspaceController {
  constructor(private readonly query: AnalystOverview, private readonly passportQuery: AnalystPassports,
    private readonly matchQuery: AnalystMatches) {}

  @Get('overview')
  @Header('Cache-Control', 'no-store')
  overview(@Req() request: { actor: RequestActor }) {
    return this.query.get(request.actor.identityId);
  }

  @Get('passports')
  @Header('Cache-Control', 'no-store')
  passports(@Req() request: { actor: RequestActor }, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    if (cursor !== undefined && (cursor.length > 500 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor))) {
      throw new AnalystWorkspaceQueryError();
    }
    if (limit !== undefined && (!/^[1-9][0-9]*$/.test(limit) || Number(limit) > 50)) throw new AnalystWorkspaceQueryError();
    return this.passportQuery.list(request.actor.identityId, { limit: limit === undefined ? 20 : Number(limit), ...(cursor ? { cursor } : {}) });
  }

  @Get('passports/:passportId')
  @Header('Cache-Control', 'no-store')
  passport(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(passportId)) {
      throw new AnalystWorkspaceAccessError('NOT_FOUND');
    }
    return this.passportQuery.detail(request.actor.identityId, passportId);
  }

  @Get('matches')
  @Header('Cache-Control', 'no-store')
  matches(@Req() request: { actor: RequestActor }, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    if (cursor !== undefined && (cursor.length > 500 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor))) {
      throw new AnalystWorkspaceQueryError();
    }
    if (limit !== undefined && (!/^[1-9][0-9]*$/.test(limit) || Number(limit) > 50)) throw new AnalystWorkspaceQueryError();
    return this.matchQuery.list(request.actor.identityId, { limit: limit === undefined ? 20 : Number(limit), ...(cursor ? { cursor } : {}) });
  }

  @Get('matches/:matchId')
  @Header('Cache-Control', 'no-store')
  match(@Req() request: { actor: RequestActor }, @Param('matchId') matchId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId)) {
      throw new AnalystWorkspaceAccessError('NOT_FOUND');
    }
    return this.matchQuery.detail(request.actor.identityId, matchId);
  }
}
