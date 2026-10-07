import { Body, Controller, Get, Header, Param, Patch, Query, Req, UseFilters, UseGuards } from '@nestjs/common';

import { AuthenticationGuard, type RequestActor } from '../../authentication/authentication.guard.js';
import { AdminOperationalWorkspaceService } from '../review/admin-operational-workspace.service.js';
import { parseAdminOperationsQuery, parseAdminReviewProgressCommand } from './admin-registration-operations.dto.js';
import { RegistrationRequestExceptionFilter, RegistrationRequestHttpError } from './registration-request-exception.filter.js';

@Controller('admin/registration-requests')
@UseGuards(AuthenticationGuard)
@UseFilters(RegistrationRequestExceptionFilter)
export class AdminRegistrationOperationsController {
  constructor(private readonly workspace: AdminOperationalWorkspaceService) {}

  @Get('operations')
  @Header('Cache-Control', 'no-store')
  async operations(@Req() request: { actor: RequestActor }, @Query() query: unknown) {
    const parsed = parseAdminOperationsQuery(query);
    if (!parsed.ok) throw new RegistrationRequestHttpError('validation', parsed.issues);
    const result = await this.workspace.list(request.actor.identityId, {
      ...(parsed.value.query === undefined ? {} : { query: parsed.value.query }),
      ...(parsed.value.requestType === undefined ? {} : { requestType: parsed.value.requestType }),
    });
    if (result.outcome !== 'found') throw new RegistrationRequestHttpError('forbidden');
    return { data: { groups: result.groups } };
  }

  @Patch(':requestId/review-progress')
  @Header('Cache-Control', 'no-store')
  async reviewProgress(
    @Req() request: { actor: RequestActor },
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ) {
    const parsed = parseAdminReviewProgressCommand(body);
    if (!parsed.ok) throw new RegistrationRequestHttpError('validation', parsed.issues);
    const result = await this.workspace.updateProgress(request.actor.identityId, requestId, parsed.value);
    if (result.outcome === 'not-found') throw new RegistrationRequestHttpError('not-found');
    if (result.outcome === 'stale') throw new RegistrationRequestHttpError('stale-version');
    if (result.outcome !== 'updated') throw new RegistrationRequestHttpError('not-found');
    return { data: result.request };
  }
}
