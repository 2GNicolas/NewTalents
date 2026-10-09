import { Injectable, Optional } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { colombiaLocalDate, type CalendarDate } from '../domain/allowance-period.js';
import { AdministratorAllowanceAuthorization } from './administrator-allowance-authorization.js';
import { resolveAllowancePeriod, type AllowanceRuleRevision } from './allowance-period-query.js';

@Injectable()
export class AllowanceQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AdministratorAllowanceAuthorization,
    @Optional() private readonly clock: () => Date = () => new Date(),
  ) {}

  async get(input: Readonly<{ administratorId: string; passportId: string }>) {
    const passport = await this.prisma.playerPassport.findUnique({ where: { id: input.passportId }, select: { state: true } });
    const decision = await this.authorization.authorize(input.administratorId, 'passport.allowance.read', {
      exists: Boolean(passport), active: passport?.state === 'ACTIVE',
    });
    if (!decision.allowed || !passport) return { outcome: 'not-found' as const };

    const colombiaToday = colombiaLocalDate(this.clock());
    const allowance = await this.prisma.passportMatchAllowance.findUnique({
      where: { passportId: input.passportId },
      select: { activatedOn: true, version: true, revisions: {
        orderBy: { sequence: 'asc' },
        select: { sequence: true, cadence: true, matchLimit: true, effectiveOn: true, confirmedAt: true },
      } },
    });
    if (!allowance) return { passportId: input.passportId, canConfigure: passport.state === 'ACTIVE', colombiaToday, configuration: null };

    const revisions: AllowanceRuleRevision[] = allowance.revisions.map((revision) => ({
      sequence: revision.sequence, cadence: revision.cadence,
      matchLimit: Number(revision.matchLimit), effectiveOn: dateOnly(revision.effectiveOn),
    }));
    const activatedOn = dateOnly(allowance.activatedOn);
    const current = resolveAllowancePeriod({ passportId: input.passportId, activatedOn, revisions }, colombiaToday);
    const currentRevision = [...allowance.revisions].reverse().find((revision) => dateOnly(revision.effectiveOn) <= colombiaToday);
    const pending = allowance.revisions.filter((revision) => dateOnly(revision.effectiveOn) > colombiaToday).at(-1);
    return {
      passportId: input.passportId,
      canConfigure: passport.state === 'ACTIVE',
      colombiaToday,
      configuration: {
        version: allowance.version,
        activatedOn,
        currentRule: current && currentRevision ? { cadence: current.cadence, matchLimit: current.matchLimit,
          effectiveOn: dateOnly(currentRevision.effectiveOn) } : null,
        currentPeriod: current?.period ?? null,
        pendingRule: pending ? { cadence: pending.cadence, matchLimit: Number(pending.matchLimit), effectiveOn: dateOnly(pending.effectiveOn) } : null,
        lastModifiedAt: allowance.revisions.at(-1)?.confirmedAt.toISOString() ?? null,
      },
    };
  }
}

function dateOnly(value: Date): CalendarDate {
  return value.toISOString().slice(0, 10);
}
