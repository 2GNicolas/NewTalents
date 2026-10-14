import { Injectable } from '@nestjs/common';

import type { FirstMatchTransaction } from '../persistence/first-match.repository.js';

/** Live Feature 005 responsibility/academy facts; call inside the passport transaction. */
@Injectable()
export class FirstMatchAccess {
  async responsiblePassport(transaction: FirstMatchTransaction, passportId: string, actorIdentityId: string) {
    const passport = await transaction.playerPassport.findUnique({
      where: { id: passportId },
      select: { id: true, playerId: true, state: true, originAcademyId: true,
        responsibilities: { select: { kind: true, identityId: true, academyId: true } } },
    });
    if (!passport) return null;
    const identity = await transaction.identity.findUnique({
      where: { id: actorIdentityId },
      select: { status: true, roleAssignments: { where: { status: 'ACTIVE' }, select: { role: true } },
        memberships: { where: { status: 'ACTIVE' }, select: { academyId: true } } },
    });
    if (identity?.status !== 'ACTIVE') return null;
    const roles = new Set(identity.roleAssignments.map((assignment) => assignment.role));
    const userResponsible = roles.has('USER') && passport.responsibilities.some((item) =>
      item.identityId === actorIdentityId && (item.kind === 'SELF' || item.kind === 'LEGAL_REPRESENTATIVE'));
    const academyResponsible = roles.has('ACADEMY_USER') && Boolean(passport.originAcademyId)
      && passport.responsibilities.some((item) => item.kind === 'ACADEMY' && item.academyId === passport.originAcademyId)
      && identity.memberships.some((membership) => membership.academyId === passport.originAcademyId);
    return userResponsible || academyResponsible ? passport : null;
  }
}
