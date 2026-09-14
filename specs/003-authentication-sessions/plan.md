# Implementation Plan: Authentication, Sessions, and Protected Requests

**Branch**: `feature/003-authentication-sessions` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

## Summary

Add the smallest backend authentication foundation that validates email/password credentials, creates independent session families, issues 15-minute HS256 access JWTs and 30-day opaque refresh tokens, rotates refresh tokens safely, and delegates every authorization-sensitive decision to the existing Feature 002 evaluator. The feature adds the approved HTTP operations, controlled Administrator credential provisioning, mandatory initial temporary-credential replacement, and non-public first-ever initialization/recovery operator modes. It adds no frontend authentication, registration, generic ACL, or product workflow.

## Technical Context

**Language/Version**: Node.js `24.11.0`, npm `10.8.0`, TypeScript `5.9.3`

**Primary Dependencies**: Existing NestJS `11.1.8`, Nest CLI `11.0.10`, Prisma `7.10.0`, PostgreSQL driver `pg 8.23.0`, Zod `4.6.1`, Vitest `5.0.0`; planned direct backend additions are `argon2@0.45.1` and `jose@6.2.12`, both exact-pinned after implementation approval.

**Storage**: PostgreSQL `18.6`; Prisma models and reviewed migration SQL for protected credentials, temporary credentials, session families, refresh history, persisted attempt controls, and immutable authentication security events. Existing Feature 002 identity, role, membership, and privileged-audit records remain authoritative.

**Testing**: Vitest unit, HTTP contract, and real PostgreSQL integration tests; shared PostgreSQL state runs sequentially. Existing Feature 001 health and Feature 002 identity/authorization suites are regression requirements.

**Target Platform**: Existing host-run NestJS backend on Windows development and Linux deployment direction, with Docker Compose PostgreSQL. Expo Web/native consume JSON contracts later; their credential persistence is explicitly deferred.

**Project Type**: Backend REST service and controlled local operator command in the npm-workspaces monorepo.

**Performance Goals**: A valid protected request verifies the JWT plus current session/identity state within normal local backend responsiveness; temporary credentials expire in 24 hours, access JWTs in 15 minutes, refresh tokens in 30 days, and attempted-login eligibility restores after the 15-minute policy window.

**Constraints**: Argon2id parameters: 19 MiB memory, 2 iterations, parallelism 1; passwords 12–128 characters without normalization/truncation or composition rules; opaque refresh tokens have at least 256 bits entropy and only their SHA-256 digest persists; five failed attempts per 15 minutes by normalized identity key and source-address key; transactions use Serializable isolation where required with Feature 002's 3-attempt `P2034` policy (50 ms then 100 ms, no jitter).

**Scale/Scope**: One backend, unlimited independent session families per identity in this feature, seven approved HTTP operations, and two non-public operator modes. No distributed authentication, identity provider, secret manager, message broker, Redis, frontend storage, or session-count limit.

## Constitution Check

| Gate | Result | Evidence |
|---|---|---|
| Bounded delivery | PASS | Only Feature 003 authentication/session/security boundary operations are designed; excluded workflows remain excluded. |
| Player/FEM scope | PASS | No player, passport, match, FEM, statistics, video, or public-product behavior is added. |
| Privacy and authorization | PASS | Passwords/temporary values are secret-free outside intentional one-time issuance; active server state and Feature 002 evaluator remain authoritative. |
| Explicit architecture | PASS | Dependencies, persistence, security contracts, transaction boundaries, error policy, and command boundary are documented. |
| Quality | PASS | Unit, contract, PostgreSQL transaction/concurrency, security-redaction, and Feature 001/002 regressions are specified. |
| Documentation and change control | PASS | The approved Feature 003 spec, research, data model, HTTP contract, operator contract, and validation guide are mutually traceable. |

Post-design re-check: PASS. The prior two product decisions are resolved in the specification; no constitution exception is required.

## Architecture and Design Decisions

- Add `apps/backend/src/authentication/` as the bounded authentication module. It owns credentials, temporary replacement, session families, refresh history, throttling, JWT issuance/validation, and security events. It imports the existing Database, Identity, Authorization, and Privileged-Changes boundaries but does not redesign them.
- Add thin HTTP controllers only for the seven approved operations: login, first-use replacement, refresh, current logout, all-session logout, credential provision, and credential reissue. The separate local operator command is not HTTP.
- Use a Bearer access-token guard. It accepts access tokens only through the `Authorization` header, verifies strict HS256 issuer/audience/type claims, resolves session and identity current state from PostgreSQL, and attaches only identity/session actor context. Public metadata is explicit; health controllers stay explicitly public and unchanged.
- Add an authorization adapter that collects current Feature 002 facts and invokes the existing `AuthorizationService`. It must not inspect controller role strings, trust token roles, or copy the permission catalog.
- Use `argon2` for permanent and temporary passwords. Store PHC output only. Use Node crypto for opaque refresh-token generation and SHA-256 digest lookup. Use `jose` to issue/verify the minimal HS256 JWT claim set. Never log request passwords, temporary credentials, refresh tokens, JWTs, hashes, signing material, or database configuration.
- Validate `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_SIGNING_SECRET`, access/refresh/temporary lifetimes, attempt window/limit, trusted-proxy mode, and cleanup retention through the existing Zod configuration boundary. Examples use placeholders; startup diagnostics redact sensitive values.
- Use one short Serializable transaction for every atomic business operation: temporary replacement, refresh rotation/reuse revocation, current/all session revocation groups, first initialization, and recovery. Retry the complete operation only on `P2034`: initial plus two retries, delays 50 ms then 100 ms, no jitter. No nested Prisma interactive transaction is permitted.
- Maintain 90 days of terminal session/refresh operational history and 24 hours beyond expiry for attempt windows. Immutable security events are never removed by this feature's cleanup. Exact job scheduling is deferred.
- Future signing-key rotation uses an explicit key identifier and bounded dual verification window after a documented configuration change; Feature 003 implements one configured active key only.

## Project Structure

```text
specs/003-authentication-sessions/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── authentication.openapi.yaml
    └── administrator-operations.md

apps/backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── authentication/
│   │   ├── authentication.module.ts
│   │   ├── authentication.controller.ts
│   │   ├── authentication.service.ts
│   │   ├── credential.service.ts
│   │   ├── session.service.ts
│   │   ├── token.service.ts
│   │   ├── authentication.guard.ts
│   │   ├── authorization.adapter.ts
│   │   ├── attempt-control.service.ts
│   │   ├── security-event.service.ts
│   │   └── administrator-operator.command.ts
│   ├── config/
│   └── app.module.ts
└── test/
    ├── contract/authentication.contract-spec.ts
    └── integration/authentication.e2e-spec.ts
```

**Structure Decision**: The backend authentication module is the only new product module. Existing configuration, database, identity, authorization, and health modules remain their owners. The operator command shares application services but is an explicit non-HTTP boundary. TocoYVoy's compatible REST/OpenAPI direction is used only as an architectural reference; its frontend storage, roles, and product behavior are not imported.

## Planned Implementation Sequence

1. Add exact-pinned dependencies after compatibility confirmation; extend redacting configuration and examples with placeholder-only security variables.
2. Add Prisma models, reviewed constraints/migration SQL, client generation, and real PostgreSQL integrity tests for credentials, sessions, refresh history, attempts, and events.
3. Implement password/temporary credential services, persistent attempt control, and immutable security events with unit and rollback coverage.
4. Implement session families, opaque refresh rotation/reuse detection, JWT issuing/verification, and current identity/session validation with concurrency coverage.
5. Add Bearer guard, explicit public metadata, authorization adapter, and the seven approved HTTP operations conforming to OpenAPI; preserve health behavior.
6. Add controlled first-ever initialization and explicit recovery operator modes, including confirmation, safe diagnostics, atomicity, duplicate/recovery eligibility, and no-session rules.
7. Run sequential integration/contract tests, typecheck, Nest build, Feature 001 health, and Feature 002 authorization regressions; update local development documentation during implementation.

Each block remains task-level work; this plan authorizes no implementation itself.

## Complexity Tracking

No constitution violation or complexity exception is required. The added credential/session records, guard, and operator command are necessary to meet Feature 003's explicit authentication, revocation, recovery, and audit requirements; a stateless JWT-only design or a generic external identity system would not satisfy them.

