export type SessionAccessProjection = Readonly<{
  classification: 'pending-onboarding' | 'product';
  capabilities: readonly string[];
  requestId?: string;
  academyId?: string;
}>;

export function projectSessionAccess(identity: Readonly<{
  roleAssignments: readonly Readonly<{ role?: string }>[];
  memberships?: readonly Readonly<{ academyId: string; status: string }>[];
  registrationApplicantAccesses?: readonly Readonly<{ requestId: string; status: string; request?: Readonly<{ status: string }> }>[];
}>): SessionAccessProjection {
  const pending = identity.registrationApplicantAccesses?.find((access) => access.status === 'PENDING_ONBOARDING');
  if (identity.roleAssignments.length === 0 && pending) {
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
  const academyUser = identity.roleAssignments.some((assignment) => assignment.role === 'ACADEMY_USER');
  const administrator = identity.roleAssignments.some((assignment) => assignment.role === 'ADMINISTRATOR');
  const academyId = academyUser ? identity.memberships?.find((membership) => membership.status === 'ACTIVE')?.academyId : undefined;
  const capabilities = [
    ...(academyUser ? [
      'registration.request.academy.list',
      'registration.request.academy.create-additional-account',
      'registration.request.academy.create-adult-player',
      'registration.request.academy.create-minor-player',
    ] : []),
    ...(administrator ? ['registration.review.list'] : []),
  ];
  return Object.freeze({
    classification: 'product',
    capabilities: Object.freeze(capabilities),
    ...(academyId ? { academyId } : {}),
  });
}
