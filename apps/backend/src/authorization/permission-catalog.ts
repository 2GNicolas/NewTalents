export const permissionCatalog = Object.freeze({
  'foundation.internal.evaluate': Object.freeze({ roles: ['ADMINISTRATOR', 'ANALYST'] as const, academy: false, tutor: false, anonymous: false }),
  'foundation.tutor.related-resource': Object.freeze({ roles: ['TUTOR'] as const, academy: false, tutor: true, anonymous: false }),
  'foundation.academy.scoped-resource': Object.freeze({ roles: ['ACADEMY_USER'] as const, academy: true, tutor: false, anonymous: false }),
  'foundation.public.read': Object.freeze({ roles: [] as const, academy: false, tutor: false, anonymous: true }),
  'foundation.privileged.role-change': Object.freeze({ roles: ['ADMINISTRATOR'] as const, academy: false, tutor: false, anonymous: false }),
  'foundation.privileged.membership-change': Object.freeze({ roles: ['ADMINISTRATOR'] as const, academy: false, tutor: false, anonymous: false }),
});
export type Permission = keyof typeof permissionCatalog;
export const isPermission = (value: unknown): value is Permission => typeof value === 'string' && value in permissionCatalog;
