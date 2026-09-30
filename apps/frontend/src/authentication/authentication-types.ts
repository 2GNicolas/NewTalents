export type SessionAccessProjection = Readonly<{
  classification: 'pending-onboarding' | 'product';
  capabilities: readonly string[];
  requestId?: string;
  academyId?: string;
}>;

export type SessionMaterial = Readonly<{
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  access?: SessionAccessProjection;
}>;

export type AuthenticationResult<T> =
  | Readonly<{ kind: 'success'; value: T }>
  | Readonly<{ kind: 'generic-authentication-failure' }>
  | Readonly<{ kind: 'throttled'; retryAfterSeconds?: number }>
  | Readonly<{ kind: 'rejected-refresh' }>
  | Readonly<{ kind: 'unavailable-backend' }>
  | Readonly<{ kind: 'connectivity-failure' }>
  | Readonly<{ kind: 'invalid-request' }>;

export type LoginInput = Readonly<{ email: string; password: string }>;
export type InitialAccessInput = Readonly<{ email: string; temporaryCredential: string; newPassword: string }>;
