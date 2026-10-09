export type SessionAccessProjection = Readonly<{
  classification: 'pending-onboarding' | 'product';
  capabilities: readonly string[];
  requestId?: string;
  academyId?: string;
}>;

export function projectSessionAccess(identity: Readonly<{
  roleAssignments: readonly Readonly<{ role?: string; status?: string }>[];
  memberships?: readonly Readonly<{ academyId: string; status: string }>[];
  registrationApplicantAccesses?: readonly Readonly<{ requestId: string; status: string; request?: Readonly<{ status: string }> }>[];
}>): SessionAccessProjection {
  const activeRoleAssignments = identity.roleAssignments.filter((assignment) => assignment.status === undefined || assignment.status === 'ACTIVE');
  const pending = identity.registrationApplicantAccesses?.find((access) => access.status === 'PENDING_ONBOARDING');
  if (activeRoleAssignments.length === 0 && pending) {
    const requestStatus = pending.request?.status;
    const editable = requestStatus === 'DRAFT' || requestStatus === 'REQUIRES_CORRECTION';
    const capabilities = [
      'registration.request.own.view',
      ...(editable ? ['registration.request.own.upload-evidence'] : []),
      ...(requestStatus === 'DRAFT' ? ['registration.request.own.update', 'registration.request.own.submit'] : []),
      ...(requestStatus === 'REQUIRES_CORRECTION' ? ['registration.request.own.correct', 'registration.request.own.resubmit'] : []),
    ];
    return Object.freeze({ classification: 'pending-onboarding', requestId: pending.requestId, capabilities: Object.freeze(capabilities) });
  }
  const academyUser = activeRoleAssignments.some((assignment) => assignment.role === 'ACADEMY_USER');
  const administrator = activeRoleAssignments.some((assignment) => assignment.role === 'ADMINISTRATOR');
  const analyst = activeRoleAssignments.some((assignment) => assignment.role === 'ANALYST');
  const academyId = academyUser ? identity.memberships?.find((membership) => membership.status === 'ACTIVE')?.academyId : undefined;
  const capabilities = [
    ...(academyUser ? [
      'registration.request.academy.list',
      'registration.request.academy.create-additional-account',
      'registration.request.academy.create-adult-player',
      'registration.request.academy.create-minor-player',
    ] : []),
    ...(administrator ? [
      'registration.review.list',
      'registration.review.progress',
      'registration.dossier.list',
      'registration.dossier.view',
      'passport.custody.list',
      'passport.custody.view',
      'passport.custody.list-analysts',
      'passport.custody.assign',
      'passport.custody.change',
      'passport.custody.remove',
      'passport.allowance.list',
      'passport.allowance.view',
      'passport.allowance.read',
      'passport.allowance.write',
      'passport.allowance.history',
    ] : []),
    ...(analyst ? ['passport.review'] : []),
  ];
  return Object.freeze({
    classification: 'product',
    capabilities: Object.freeze(capabilities),
    ...(academyId ? { academyId } : {}),
  });
}
