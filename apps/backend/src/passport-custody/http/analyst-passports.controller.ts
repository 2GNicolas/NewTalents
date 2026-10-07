import { Controller, Get, Header, Query, Req, UseFilters, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { AuthenticationGuard, type RequestActor } from '../../authentication/authentication.guard.js';
import { AnalystPassportsQueryService } from '../application/analyst-passports-query.service.js';
import { PassportCustodyExceptionFilter, PassportCustodyHttpError } from './passport-custody-exception.filter.js';

const querySchema = z.object({
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

@Controller('analyst/passports')
@UseGuards(AuthenticationGuard)
@UseFilters(PassportCustodyExceptionFilter)
export class AnalystPassportsController {
  constructor(private readonly queries: AnalystPassportsQueryService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Req() request: { actor: RequestActor }, @Query() query: unknown) {
    const parsed = querySchema.safeParse(query);
    if (!parsed.success) throw new PassportCustodyHttpError('validation', parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), code: issue.code })));
    const result = await this.queries.list({ identityId: request.actor.identityId, limit: parsed.data.limit, ...(parsed.data.cursor ? { cursor: parsed.data.cursor } : {}) });
    if ('outcome' in result) throw new PassportCustodyHttpError(result.outcome === 'forbidden' ? 'forbidden' : result.outcome === 'invalid-cursor' ? 'validation' : 'unavailable');
    return { data: result.items, pagination: { hasMore: Boolean(result.nextCursor), ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}) } };
  }
}
