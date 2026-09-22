export const permissionCatalog = Object.freeze({
  'foundation.internal.evaluate': Object.freeze({ roles: ['ADMINISTRATOR', 'ANALYST'] as const, academy: false, tutor: false, anonymous: false }),
  'foundation.tutor.related-resource': Object.freeze({ roles: ['TUTOR'] as const, academy: false, tutor: true, anonymous: false }),
  'foundation.academy.scoped-resource': Object.freeze({ roles: ['ACADEMY_USER'] as const, academy: true, tutor: false, anonymous: false }),
  'foundation.public.read': Object.freeze({ roles: [] as const, academy: false, tutor: false, anonymous: true }),
  'foundation.privileged.role-change': Object.freeze({ roles: ['ADMINISTRATOR'] as const, academy: false, tutor: false, anonymous: false }),
  'foundation.privileged.membership-change': Object.freeze({ roles: ['ADMINISTRATOR'] as const, academy: false, tutor: false, anonymous: false }),
  'passport.tutor.create': Object.freeze({ roles: ['TUTOR'] as const, academy: false, tutor: false, anonymous: false }),
  'passport.particular.create': Object.freeze({ roles: ['USER'] as const, academy: false, tutor: false, particular: true, anonymous: false }),
  'passport.particular.manage': Object.freeze({ roles: ['USER'] as const, academy: false, tutor: false, particular: true, anonymous: false }),
  'passport.academy.create': Object.freeze({ roles: ['ACADEMY_USER'] as const, academy: true, tutor: false, anonymous: false }),
  'passport.tutor.manage': Object.freeze({ roles: ['TUTOR'] as const, academy: false, tutor: true, anonymous: false }),
  'passport.academy.manage': Object.freeze({ roles: ['ACADEMY_USER'] as const, academy: true, tutor: false, anonymous: false }),
  'passport.review': Object.freeze({ roles: ['ANALYST'] as const, academy: false, tutor: false, anonymous: false }),
  'passport.activate': Object.freeze({ roles: ['ADMINISTRATOR'] as const, academy: false, tutor: false, anonymous: false }),
  'passport.history.tutor': Object.freeze({ roles: ['TUTOR'] as const, academy: false, tutor: true, anonymous: false }),
  'passport.history.particular': Object.freeze({ roles: ['USER'] as const, academy: false, tutor: false, particular: true, anonymous: false }),
  'passport.history.academy': Object.freeze({ roles: ['ACADEMY_USER'] as const, academy: true, tutor: false, anonymous: false }),
  'passport.history.internal': Object.freeze({ roles: ['ANALYST', 'ADMINISTRATOR'] as const, academy: false, tutor: false, anonymous: false }),
});
export type Permission = keyof typeof permissionCatalog;
export const isPermission = (value: unknown): value is Permission => typeof value === 'string' && value in permissionCatalog;
