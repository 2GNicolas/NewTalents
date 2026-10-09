import { Body, Controller, Get, Header, HttpCode, Optional, Param, Put, Query, Req, UseFilters, UseGuards } from '@nestjs/common';

import { AuthenticationGuard, type RequestActor } from '../../authentication/authentication.guard.js';
import { AdminPassportsQuery } from '../application/admin-passports-query.js';
import { AllowanceCommand, type ConfirmAllowanceInput } from '../application/allowance-command.js';
import { AllowanceQuery } from '../application/allowance-query.js';
import { AllowanceHistory } from '../application/allowance-history.js';
import { parseAdminPassportsQuery, parseAllowanceCommand, validPassportId } from './admin-allowance.dto.js';
import { AdminAllowanceExceptionFilter, AdminAllowanceHttpError } from './admin-allowance-exception.filter.js';

@Controller('admin/passports')
@UseGuards(AuthenticationGuard)
@UseFilters(AdminAllowanceExceptionFilter)
export class AdminAllowanceController {
  constructor(private readonly passports: AdminPassportsQuery, private readonly allowances: AllowanceQuery, private readonly commands: AllowanceCommand,
    @Optional() private readonly history?: AllowanceHistory) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Req() request: { actor: RequestActor }, @Query() query: unknown) {
    const parsed = parseAdminPassportsQuery(query);
    if (!parsed.ok) throw new AdminAllowanceHttpError('invalid');
    const page = await this.passports.list({ administratorId: request.actor.identityId, limit: parsed.value.limit,
      ...(parsed.value.cursor ? { cursor: parsed.value.cursor } : {}) });
    if ('outcome' in page) throw new AdminAllowanceHttpError(page.outcome === 'denied' ? 'denied' : 'invalid');
    return { items: page.items.map(card), nextCursor: page.nextCursor ?? null };
  }

  @Get(':passportId')
  @Header('Cache-Control', 'no-store')
  async detail(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string) {
    if (!validPassportId(passportId)) throw new AdminAllowanceHttpError('not-found');
    const passport = await this.passports.detail({ administratorId: request.actor.identityId, passportId });
    if ('outcome' in passport) throw new AdminAllowanceHttpError('not-found');
    const allowance = await this.allowances.get({ administratorId: request.actor.identityId, passportId });
    if ('outcome' in allowance) throw new AdminAllowanceHttpError('not-found');
    return { passport: card(passport), allowance: envelope(allowance) };
  }

  @Get(':passportId/match-allowance')
  @Header('Cache-Control', 'no-store')
  async allowance(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string) {
    if (!validPassportId(passportId)) throw new AdminAllowanceHttpError('not-found');
    const result = await this.allowances.get({ administratorId: request.actor.identityId, passportId });
    if ('outcome' in result) throw new AdminAllowanceHttpError('not-found');
    return envelope(result);
  }

  @Get(':passportId/match-allowance/history')
  @Header('Cache-Control', 'no-store')
  async allowanceHistory(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string, @Query() query: unknown) {
    if (!validPassportId(passportId)) throw new AdminAllowanceHttpError('not-found');
    const parsed = parseAdminPassportsQuery(query);
    if (!parsed.ok) throw new AdminAllowanceHttpError('invalid');
    if (!this.history) throw new AdminAllowanceHttpError('unavailable');
    const result = await this.history.list({ administratorId: request.actor.identityId, passportId,
      limit: parsed.value.limit, ...(parsed.value.cursor ? { cursor: parsed.value.cursor } : {}) });
    if ('outcome' in result) throw new AdminAllowanceHttpError(result.outcome === 'not-found' ? 'not-found' : 'invalid');
    return result;
  }

  @Put(':passportId/match-allowance')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async confirm(@Req() request: { actor: RequestActor }, @Param('passportId') passportId: string, @Body() body: unknown) {
    if (!validPassportId(passportId)) throw new AdminAllowanceHttpError('not-found');
    const parsed = parseAllowanceCommand(body);
    if (!parsed.ok) throw new AdminAllowanceHttpError('invalid');
    const command = { passportId, administratorIdentityId: request.actor.identityId, ...parsed.value } as ConfirmAllowanceInput;
    const result = parsed.value.expectedVersion === 0
      ? await this.commands.create(command as Parameters<AllowanceCommand['create']>[0])
      : await this.commands.confirm(command);
    if (result.outcome === 'applied' || result.outcome === 'idempotent') return { configuration: result.configuration, colombiaToday: result.colombiaToday };
    if (result.outcome === 'conflict' || result.outcome === 'idempotency-conflict') {
      const latest = await this.allowances.get({ administratorId: request.actor.identityId, passportId });
      throw new AdminAllowanceHttpError(result.outcome, 'outcome' in latest ? undefined : envelope(latest));
    }
    const mapped = result.outcome === 'ineligible-passport' ? 'ineligible' : result.outcome;
    throw new AdminAllowanceHttpError(mapped);
  }
}

function card(item: { passportId: string; playerLabel: string; maskedReference: string; lifecycleState: string; canConfigure: boolean }) {
  return { id: item.passportId, playerLabel: item.playerLabel, maskedReference: item.maskedReference,
    state: item.lifecycleState, canConfigure: item.canConfigure };
}

function envelope(result: { colombiaToday: string; configuration: null | {
  version: number; activatedOn: string; currentRule: { cadence: string; matchLimit: number } | null;
  currentPeriod: { start: string; endExclusive: string } | null;
  pendingRule: { cadence: string; matchLimit: number; effectiveOn: string } | null;
  lastModifiedAt: string | null;
} }) {
  const value = result.configuration;
  if (!value) return { configuration: null, colombiaToday: result.colombiaToday };
  return { colombiaToday: result.colombiaToday, configuration: {
    version: value.version, activatedOn: value.activatedOn,
    currentRule: value.currentRule ? { ...value.currentRule, effectiveOn: 'effectiveOn' in value.currentRule ? value.currentRule.effectiveOn : value.activatedOn } : null,
    currentPeriod: value.currentPeriod ? { start: value.currentPeriod.start, endExclusive: value.currentPeriod.endExclusive } : null,
    pendingRule: value.pendingRule, lastModifiedAt: value.lastModifiedAt,
  } };
}
