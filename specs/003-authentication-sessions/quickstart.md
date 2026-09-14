# Quickstart: Authentication, Sessions, and Protected Requests Validation

## Prerequisites

Use the Feature 001 local baseline with Node `24.11.0`, npm `10.8.0`, PostgreSQL through Docker
Compose, and real local-only environment files. Feature 003 adds required security configuration
with placeholder-only examples; startup must reject missing, malformed, or placeholder values
without printing them.

After implementation, prepare and start the existing baseline:

```powershell
npm ci
npm run db:up
npm run prisma:generate
npm run dev:backend
```

In a separate terminal, retain the existing health checks:

```powershell
npm run health:live
npm run health:ready
```

Expected: both health operations remain HTTP 200 and do not require credentials.

## Controlled Administrator operations

Build the backend first, then run one of these commands from the repository root in an interactive
terminal:

```powershell
npm run build:backend
npm run admin:initialize
npm run admin:recover
```

The commands start a Nest application context but no HTTP listener. They request the email and a
non-echoed password interactively, show the selected mode and non-sensitive email, and require
typing `CONFIRM`. They accept no password argument. Exit `0` means applied, `2` means refusal or
cancellation, and `1` means an operational failure. Use only controlled operator values; automated
verification uses fixtures and must not initialize or recover a real Administrator.

## Planned contract validation

Use the versioned [HTTP contract](./contracts/authentication.openapi.yaml) after implementation.

1. Bootstrap an Administrator only through the non-public
   [operator contract](./contracts/administrator-operations.md); prove the normal initialization
   refuses any prior Administrator assignment.
2. Use the Administrator access credential to provision an initial temporary credential for an
   existing eligible identity. Confirm the response is `Cache-Control: no-store`, the plaintext
   value appears only in that response, and no identity or role changes.
3. Replace the temporary credential during first access. Confirm no normal reusable session is
   returned before replacement succeeds; then confirm the successful response intentionally issues
   one access token and one refresh token.
4. Validate protected access with `Authorization: Bearer <access-token>`. Confirm missing,
   malformed, wrong issuer/audience/type/signature, expired, revoked-session, and inactive-identity
   credentials fail safely.
5. Renew once with the refresh-token JSON request. Confirm rotation replaces it. Reuse the earlier
   value and confirm only its session family is revoked; an unrelated session for the same identity
   remains usable.
6. Confirm current-session logout affects one family and all-session logout affects every active
   family for that identity.
7. Trigger six failed sign-in attempts in the configured 15-minute window and confirm generic
   throttling; confirm a successful authentication clears the window and time expiry restores
   eligibility without permanent lockout.
8. Verify emergency recovery only with no active eligible Administrator, explicit confirmation, and
   preserved history; verify rejection whenever an active eligible Administrator exists.

## Planned automated verification

Run tests sequentially where PostgreSQL state is shared:

```powershell
npm run typecheck
npm run test --workspace=@new-talents/backend
npm run test:contract --workspace=@new-talents/backend
npm run test:integration --workspace=@new-talents/backend
npm run build --workspace=@new-talents/backend
```

The Feature 003 suites add unit coverage for hashing, claims, guards, safe errors, and redaction;
real PostgreSQL integration coverage for credentials, temporary replacement, sessions, rotation,
reuse, logout, deactivation, rate limiting, bootstrap, recovery, rollback, constraints, and
`P2034` retry. Existing Feature 001 health and Feature 002 identity/authorization suites remain
required regressions.

## Cleanup

Use normal repository database lifecycle commands. Do not remove the PostgreSQL persistent volume
for validation. Do not record secrets, temporary credentials, tokens, hashes, or connection strings
in shell history, test fixtures, logs, or documentation.
