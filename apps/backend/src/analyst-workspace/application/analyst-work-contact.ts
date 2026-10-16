import { Injectable } from '@nestjs/common';

import type { AnalystReadScope } from './analyst-workspace-access.js';
import type { AnalystWorkspaceNameDecryptor } from './analyst-overview.js';

export type WorkContact = Readonly<{ availability: 'UNAVAILABLE' }> | Readonly<{
  availability: 'AVAILABLE'; kind: 'SELF' | 'LEGAL_REPRESENTATIVE' | 'ACADEMY_RESPONSIBLE';
  phone?: string; email?: string;
}>;
const unavailable: WorkContact = { availability: 'UNAVAILABLE' };

@Injectable()
export class AnalystWorkContact {
  constructor(private readonly cipher: AnalystWorkspaceNameDecryptor) {}

  async forPassport(scope: AnalystReadScope): Promise<WorkContact> {
    if (!scope.passportId) throw new Error('Passport read scope required');
    const passport = await scope.tx.playerPassport.findFirst({
      where: { id: scope.passportId, state: 'ACTIVE', custody: { currentAnalystIdentityId: scope.actorIdentityId } },
      select: { playerId: true, originKind: true, originAcademyId: true,
        responsibilities: { select: { kind: true, identityId: true, academyId: true } } },
    });
    if (!passport) return unavailable;
    let identityId: string;
    let encryptedPhone: string | null = null;
    let kind: 'SELF' | 'LEGAL_REPRESENTATIVE' | 'ACADEMY_RESPONSIBLE';
    if (passport.originKind === 'ACADEMY') {
      const academyId = passport.originAcademyId;
      if (!academyId || passport.responsibilities.filter((r) => r.kind === 'ACADEMY' && r.academyId === academyId).length !== 1) return unavailable;
      const requests = await scope.tx.registrationRequest.findMany({
        where: { academyContextId: academyId, status: 'APPROVED', type: { in: ['FORMAL_ACADEMY', 'NATURAL_PERSON_ACADEMY'] } },
        select: { formalAcademyDetail: { select: { responsibleApplicant: { select: { identityId: true, encryptedPhone: true } } } },
          naturalPersonAcademyDetail: { select: { responsibleApplicant: { select: { identityId: true, encryptedPhone: true } } } } },
      });
      if (requests.length !== 1) return unavailable;
      const applicant = requests[0]!.formalAcademyDetail?.responsibleApplicant ?? requests[0]!.naturalPersonAcademyDetail?.responsibleApplicant;
      if (!applicant?.identityId) return unavailable;
      const membership = await scope.tx.academyMembership.findMany({ where: {
        academyId, identityId: applicant.identityId, status: 'ACTIVE', endedAt: null,
      }, select: { id: true } });
      if (membership.length !== 1) return unavailable;
      identityId = applicant.identityId;
      encryptedPhone = applicant.encryptedPhone;
      kind = 'ACADEMY_RESPONSIBLE';
    } else {
      kind = passport.originKind === 'PARTICULAR' ? 'SELF' : 'LEGAL_REPRESENTATIVE';
      const candidates = passport.responsibilities.filter((r) => r.kind === kind && r.identityId);
      if (candidates.length !== 1) return unavailable;
      identityId = candidates[0]!.identityId!;
      const applicants = await scope.tx.registrationRequestApplicant.findMany({
        where: { identityId, request: { status: 'APPROVED', type: kind === 'SELF' ? 'PERSONAL_ADULT' : 'REPRESENTED_MINOR',
          players: { some: { linkedPlayerId: passport.playerId } } } },
        select: { encryptedPhone: true },
      });
      if (applicants.length === 1) encryptedPhone = applicants[0]!.encryptedPhone;
    }
    const identity = await scope.tx.identity.findUnique({ where: { id: identityId }, select: {
      status: true, roleAssignments: { where: { role: 'ACADEMY_USER', status: 'ACTIVE' }, select: { id: true } },
      authenticationCredential: { select: { normalizedEmail: true, status: true } },
    } });
    if (identity?.status !== 'ACTIVE' || (kind === 'ACADEMY_RESPONSIBLE' && identity.roleAssignments.length === 0)) return unavailable;
    const phone = encryptedPhone ? this.cipher.decrypt(encryptedPhone).trim() : '';
    const email = identity.authenticationCredential?.status === 'ACTIVE' ? identity.authenticationCredential.normalizedEmail.trim() : '';
    if (!phone && !email) return unavailable;
    return { availability: 'AVAILABLE', kind, ...(phone ? { phone } : {}), ...(email ? { email } : {}) };
  }
}
