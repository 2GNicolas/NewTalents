import { BadRequestException, Body, Controller, Get, Header, Headers, HttpCode, Param, Post, Req, UseFilters, UseGuards } from '@nestjs/common';

import { AuthenticationGuard, type RequestActor } from '../../authentication/authentication.guard.js';
import { AnalystMatchUploadAccessError } from '../application/analyst-match-upload-access.js';
import { AnalystMatchCapture } from '../application/analyst-match-capture.js';
import { ConfirmAnalystMatchUpload } from '../application/confirm-analyst-match-upload.js';
import { AnalystMatchUploadExceptionFilter } from './analyst-match-upload-exception.filter.js';

@Controller('analyst/workspace')
@UseGuards(AuthenticationGuard)
@UseFilters(AnalystMatchUploadExceptionFilter)
export class AnalystMatchUploadController {
  constructor(private readonly query: AnalystMatchCapture, private readonly command: ConfirmAnalystMatchUpload) {}

  @Get('matches/:matchId/capture')
  @Header('Cache-Control', 'no-store')
  capture(@Req() request: { actor: RequestActor }, @Param('matchId') matchId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId)) {
      throw new AnalystMatchUploadAccessError('NOT_FOUND');
    }
    return this.query.get(request.actor.identityId, matchId);
  }

  @Post('matches/:matchId/capture/confirm')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  confirm(@Req() request: { actor: RequestActor }, @Param('matchId') matchId: string,
    @Headers('idempotency-key') loadId: string | undefined, @Body() body: unknown) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(matchId)) throw new AnalystMatchUploadAccessError('NOT_FOUND');
    if (!loadId || !uuid.test(loadId)) throw new BadRequestException();
    return this.command.confirm(request.actor.identityId, matchId, loadId, body);
  }
}
