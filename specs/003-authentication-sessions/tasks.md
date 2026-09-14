---
description: "Dependency-ordered implementation tasks for Authentication, Sessions, and Protected Requests"
---

# Tasks: Authentication, Sessions, and Protected Requests

**Input**: Design documents from `/specs/003-authentication-sessions/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`quickstart.md`, `contracts/authentication.openapi.yaml`, and
`contracts/administrator-operations.md`

**Tests**: Tests are required by the approved plan. Each new behavior's focused test MUST fail for
the expected pre-implementation reason before its implementation task. PostgreSQL suites sharing
database state, schema, session families, or Administrator state run sequentially using isolated
fixtures and targeted cleanup only.

## Phase 1: Dependencies, Configuration, and Persistence Foundation

**Purpose**: Establish the version-pinned security dependencies, fail-closed configuration, and
Feature 003 persistence foundation before any credential or session behavior.

- [X] T001 Add exact direct backend dependencies `argon2@0.45.1` and `jose@6.2.12` with their lockfile resolution in `apps/backend/package.json` and `package-lock.json`; do not upgrade unrelated packages (plan dependency decision).
- [X] T002 [P] Write failing security-configuration tests for placeholder rejection, secret redaction, issuer/audience, HS256 secret, 15-minute access lifetime, 30-day refresh lifetime, 24-hour temporary lifetime, five/15-minute attempt controls, trusted-proxy mode, and retention settings in `apps/backend/src/config/environment.schema.spec.ts` (FR-009, FR-010, FR-024).
- [X] T003 Write failing PostgreSQL schema/constraint tests with isolated fixtures and targeted cleanup for the Feature 003 credential, temporary-credential, session, refresh-history, attempt-control, and immutable-security-event rules in `apps/backend/test/integration/authentication-schema.e2e-spec.ts` (FR-019, FR-025, FR-028–FR-036).
- [X] T004 Implement validated, redacted Feature 003 security configuration and placeholder-only local examples in `apps/backend/src/config/environment.schema.ts`, `apps/backend/src/config/safe-diagnostic.ts`, and `apps/backend/.env.example` (FR-009, FR-010, FR-024).
- [X] T005 Define the minimum Feature 003 Prisma models, enums, foreign keys, and lookup indexes—one credential per identity, a unique normalized email key, refresh digest uniqueness, session-by-identity lookup, attempt-window lookup, and append-only security-event references—in `apps/backend/prisma/schema.prisma` (FR-001–FR-007, FR-019, FR-025).
- [X] T006 Create reviewed Feature 003 migration SQL for the partial single-active temporary-credential invariant, append-only security-event protection, and first-initialization/recovery predicates in `apps/backend/prisma/migrations/*/migration.sql` (FR-026, FR-028–FR-036, SC-007–SC-010).
- [X] T007 Generate the Prisma client and apply the Feature 003 migration serially against isolated local PostgreSQL using `apps/backend/prisma/schema.prisma` and `apps/backend/prisma/migrations/`; preserve existing Feature 001 and Feature 002 schema behavior (FR-024).
- [X] T008 Verify Feature 003 configuration and persistence constraints sequentially, including existing health schema regression, in `apps/backend/src/config/environment.schema.spec.ts` and `apps/backend/test/integration/authentication-schema.e2e-spec.ts` (SC-005, SC-007–SC-012).

**Checkpoint**: Exact dependencies, fail-closed security configuration, generated client, reviewed migration,
and real PostgreSQL invariants are available; stop before credential behavior.

## Phase 2: Credential and Temporary-Credential Lifecycle

**Purpose**: Deliver controlled credential state, Administrator-authorized provisioning, one-time
temporary credentials, and atomic first-use replacement.

**Independent Test**: An authorized Administrator provisions an initial temporary credential only
for an existing eligible identity; it is disclosed once, cannot alter identity/roles, and a valid
first-use replacement atomically enables the first reusable session while every unsafe path leaves
no partial state.

- [X] T009 [P] [US6] Write failing unit tests for Argon2id permanent/temporary hashing (19 MiB, two iterations, parallelism one), 12–128-character no-normalization/no-truncation password validation, one-time disclosure, and secret-safe values in `apps/backend/src/authentication/credential.service.spec.ts` (FR-005, FR-019, FR-029–FR-031).
- [X] T010 [US6] Write failing real PostgreSQL lifecycle tests using unique fixtures for existing-identity-only provisioning, Administrator authorization, reissue invalidation, 24-hour expiry, consumption, current eligibility, first-use replacement, audit redaction, and rollback in `apps/backend/test/integration/credential-lifecycle.e2e-spec.ts` (FR-001–FR-006, FR-025, FR-027–FR-033, SC-008–SC-009).
- [X] T011 [US6] Implement Argon2id password and temporary-credential hashing/verification with PHC output and no plaintext logging in `apps/backend/src/authentication/credential.service.ts` (FR-005, FR-019, FR-025).
- [X] T012 [US6] Implement temporary-credential creation, one-time intentional return, expiry/consumption/invalidation/reissue state, and Feature 002 evaluator-based Administrator authorization in `apps/backend/src/authentication/temporary-credential.service.ts` (FR-027–FR-033, SC-008).
- [X] T013 [US6] Implement the Serializable, complete-operation first-use replacement that validates current eligibility, consumes the temporary credential, stores the permanent Argon2id hash, creates the first reusable session through a transaction-scoped collaborator, and writes immutable redacted evidence in `apps/backend/src/authentication/credential-replacement.service.ts` (FR-005–FR-006, FR-025, FR-030–FR-031, SC-009).
- [X] T014 [US6] Apply the approved bounded retry helper—three total attempts, waits of 50 ms and 100 ms, no jitter, and retries only for `P2034`—to the complete replacement/provisioning atomic operations in `apps/backend/src/authentication/authentication-transaction.service.ts` (FR-031, SC-009).
- [X] T015 [US6] Verify unit and sequential PostgreSQL credential lifecycle coverage, including no identity/role mutation, no partial activation/session after failure, and one-time secret-safe disclosure in `apps/backend/src/authentication/credential.service.spec.ts` and `apps/backend/test/integration/credential-lifecycle.e2e-spec.ts` (FR-004, FR-025, FR-028–FR-033).

**Checkpoint**: Existing eligible identities can receive and replace an initial temporary credential
safely; general password changes and recovery remain absent.

## Phase 3: Sessions, Access Tokens, and Refresh Rotation

**Purpose**: Deliver independent server-backed session families, minimal access JWTs, opaque refresh
rotation, replay containment, and scoped logout.

**Independent Test**: Two sessions for one active identity remain independent; a refresh token
rotates exactly once, replay revokes only its family, and current/all logout changes exactly the
requested session set.

- [X] T016 [P] [US2] Write failing unit tests for 256-bit opaque refresh generation, SHA-256 digesting, minimal HS256 JWT claims (`sub`, session ID, token ID, `iat`, `exp`, issuer, audience, explicit access type), strict issuer/audience/type/algorithm validation, and 15-minute access expiry in `apps/backend/src/authentication/token.service.spec.ts` (FR-006, FR-011–FR-019).
- [X] T017 [US2] Write failing real PostgreSQL integration tests with separate Prisma clients for independent families, 30-day expiry, atomic refresh rotation, concurrent refresh, consumed-token reuse, affected-family-only revocation, current logout, all logout, and identity deactivation in `apps/backend/test/integration/session-rotation.e2e-spec.ts` (FR-007, FR-016–FR-023, SC-002–SC-004).
- [X] T018 [US2] Implement minimal HS256 access-token issuance and verification using `jose@6.2.12`, configured issuer/audience/signing secret, and no role, permission, membership, relationship, or sensitive claims in `apps/backend/src/authentication/token.service.ts` (FR-006, FR-011–FR-015).
- [X] T019 [US2] Implement session-family creation, current session/identity validation, expiry, revocation, current logout, all-session logout, and deactivation effects in `apps/backend/src/authentication/session.service.ts` (FR-007, FR-013, FR-020–FR-023, SC-003–SC-004).
- [X] T020 [US2] Implement opaque refresh issuance, digest-only history, Serializable conditional consumption, successor linking, affected-family reuse detection/revocation, and the complete-operation `P2034` policy in `apps/backend/src/authentication/refresh-token.service.ts` (FR-016–FR-019, FR-022, SC-002).
- [X] T021 [US3] Add scoped current-session and all-session closure application behavior with immutable redacted security events in `apps/backend/src/authentication/session.service.ts` (FR-020–FR-025, SC-003).
- [X] T022 [US2] Verify sequential session, refresh, concurrency, replay, logout, and deactivation coverage in `apps/backend/src/authentication/token.service.spec.ts` and `apps/backend/test/integration/session-rotation.e2e-spec.ts` (SC-002–SC-004).

**Checkpoint**: Tokens establish identity/session context only; server-side session and identity state
remain mandatory for every continued access or renewal.

## Phase 4: Login and Abuse Protection

**Purpose**: Deliver generic credential login and persistent, privacy-preserving abuse controls.

**Independent Test**: Valid permanent credentials create a session; unknown email, bad password,
inactive or ineligible identity return the same safe response; five failures in 15 minutes throttle,
then success or time expiry restores normal eligibility.

- [X] T023 [P] [US4] Write failing unit tests for normalized identity-key/source-address digests, trusted-proxy address extraction, five failures in 15 minutes, automatic window expiry, successful-login clearing, and generic throttled output in `apps/backend/src/authentication/attempt-control.service.spec.ts` (FR-008–FR-010, SC-001, SC-005).
- [X] T024 [P] [US1] Write failing unit tests for constant-behavior practical credential verification, active eligible-role checks, generic unknown/invalid/inactive/ineligible outcomes, session issuance, and redacted login events in `apps/backend/src/authentication/authentication.service.spec.ts` (FR-001–FR-010, FR-025, SC-001, SC-005).
- [X] T025 [US4] Write failing real PostgreSQL integration tests with targeted cleanup for persisted attempt windows across service instances, identity-key/source-address controls, throttling, auto-recovery, and no permanent lockout in `apps/backend/test/integration/login-abuse.e2e-spec.ts` (FR-008–FR-010, SC-001, SC-005).
- [X] T026 [US4] Implement persisted normalized-identity/source-address attempt controls, trusted-proxy validation, bounded retention cleanup, generic throttling, and success clearing in `apps/backend/src/authentication/attempt-control.service.ts` (FR-008–FR-010).
- [X] T027 [US1] Implement credential-login orchestration using the credential, session, attempt-control, and security-event boundaries without creating identities/roles or exposing cause-specific login failures in `apps/backend/src/authentication/authentication.service.ts` (FR-001–FR-010, FR-025, SC-001, SC-005).
- [X] T028 [US1] Verify unit and sequential PostgreSQL login/abuse behavior, including inactive identity, multiple eligible roles, generic response equality, clearing after success, and automatic recovery in `apps/backend/src/authentication/authentication.service.spec.ts`, `apps/backend/src/authentication/attempt-control.service.spec.ts`, and `apps/backend/test/integration/login-abuse.e2e-spec.ts` (SC-001, SC-005).

**Checkpoint**: Login is generic, stateful, and abuse-aware without public registration,
credential recovery, or account enumeration.

## Phase 5: HTTP Authentication and Authorization Boundary

**Purpose**: Expose only the seven approved JSON operations while enforcing a default-deny Bearer
boundary that delegates current authorization to Feature 002 and preserves public health routes.

**Independent Test**: Each approved operation conforms to OpenAPI; malformed/missing/invalid access
credentials deny safely; health remains public; protected actions receive only an authenticated
identity/session actor context and Feature 002 makes the authorization decision.

- [X] T029 [P] [US1] Write failing OpenAPI contract tests for exactly `/auth/login`, `/auth/initial-credential/replace`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `/auth/credentials/provision`, and `/auth/credentials/reissue`, their JSON schemas, no-store headers, and stable errors in `apps/backend/test/contract/authentication.contract-spec.ts` (FR-006, FR-008–FR-009, FR-019, FR-029).
- [X] T030 [P] [US1] Write failing guard and authorization-delegation unit tests for missing/malformed Bearer input, signature/issuer/audience/type/expiry failures, revoked/expired session, inactive identity, explicit public metadata, actor-context shape, and no token-role authorization in `apps/backend/src/authentication/authentication.guard.spec.ts` (FR-011–FR-015, FR-024, SC-004, SC-006).
- [X] T031 [US1] Write failing HTTP integration tests for the seven approved operations, generic authentication failure, invalid input, insufficient authorization, throttling, refresh reuse, no-store issuance responses, and unchanged health routes in `apps/backend/test/integration/authentication-http.e2e-spec.ts` (FR-008–FR-009, FR-013–FR-014, FR-024, SC-005–SC-006, SC-011).
- [X] T032 [US1] Implement request DTO validation, stable safe error mapping, no-store response policy, and only the seven OpenAPI controllers in `apps/backend/src/authentication/authentication.controller.ts`, `apps/backend/src/authentication/authentication.dto.ts`, and `apps/backend/src/authentication/authentication-error.filter.ts` (FR-008–FR-009, FR-019, FR-029).
- [X] T033 [US1] Implement strict Bearer access-token guard, explicit public-route metadata, and identity/session-only request actor context in `apps/backend/src/authentication/authentication.guard.ts` and `apps/backend/src/authentication/public-route.decorator.ts` (FR-011–FR-013, FR-024).
- [X] T034 [US1] Implement the current-fact authorization adapter that delegates to existing `AuthorizationService` without role-string checks or permission-catalog duplication in `apps/backend/src/authentication/authorization.adapter.ts` (FR-012–FR-015, SC-006).
- [X] T035 [US1] Assemble the authentication module, controller, guard, adapter, and existing Feature 002 imports while leaving the health module and controllers unchanged in `apps/backend/src/authentication/authentication.module.ts` (FR-014, FR-024).
- [X] T036 [US1] Verify the OpenAPI contract, guard, delegation, HTTP, and health-preservation suites sequentially in `apps/backend/test/contract/authentication.contract-spec.ts`, `apps/backend/src/authentication/authentication.guard.spec.ts`, and `apps/backend/test/integration/authentication-http.e2e-spec.ts` (SC-005, SC-006, SC-011).

**Checkpoint**: Only the approved HTTP surface exists; public health is unchanged and protected
authorization remains Feature 002-owned.

## Phase 6: Administrator Initialization and Recovery

**Purpose**: Deliver separate, non-public, explicitly confirmed operator modes for first-ever
Administrator initialization and emergency recovery.

**Independent Test**: First initialization succeeds only before any Administrator assignment; recovery
succeeds only with no active eligible Administrator; both are atomic, secret-safe, immutable-audited,
and never issue a reusable application session.

- [X] T037 [P] [US5] Write failing unit tests for hidden interactive credential entry, explicit confirmation, no secret output, no session issuance, unsafe-input refusal, and duplicate first-initialization refusal in `apps/backend/src/authentication/administrator-operator.command.spec.ts` (FR-025–FR-026, SC-007).
- [X] T038 [P] [US7] Write failing unit tests for explicit recovery mode, no-active-eligible-Administrator predicate, recovery refusal while one is active, historical-preservation behavior, and no implicit old-Administrator reactivation in `apps/backend/src/authentication/administrator-recovery.service.spec.ts` (FR-034–FR-036, SC-010).
- [X] T039 [US5] Write failing real PostgreSQL integration/concurrency/rollback tests with isolated fixtures for first-ever initialization, historical duplicate prevention, atomic identity/credential/role/audit creation, recovery eligibility, repeated-recovery refusal, incompatible-session revocation, and immutable redacted evidence in `apps/backend/test/integration/administrator-bootstrap-recovery.e2e-spec.ts` (FR-025–FR-026, FR-034–FR-036, SC-007, SC-010).
- [X] T040 [US5] Implement the controlled first-ever initialization application service using the complete Serializable `P2034` retry operation, explicit values, minimum identity/credential/Administrator role state, immutable audit, no session issuance, and safe duplicate refusal in `apps/backend/src/authentication/administrator-bootstrap.service.ts` (FR-025–FR-026, SC-007).
- [X] T041 [US7] Implement controlled emergency recovery with explicit confirmation, no-active-eligible-Administrator check, explicitly identified recovery state, history preservation, incompatible-session safety revocation, immutable redacted audit, and repeated-recovery refusal in `apps/backend/src/authentication/administrator-recovery.service.ts` (FR-034–FR-036, SC-010).
- [X] T042 [US5] Implement the non-HTTP interactive operator command that selects explicit initialization or recovery mode, hides credential input, prints no secrets, and invokes only the approved services in `apps/backend/src/authentication/administrator-operator.command.ts` (FR-025–FR-026, FR-034–FR-036).
- [X] T043 [US7] Verify sequential unit, PostgreSQL integration, concurrency, rollback, audit-redaction, history-preservation, and no-session evidence in `apps/backend/src/authentication/administrator-operator.command.spec.ts`, `apps/backend/src/authentication/administrator-recovery.service.spec.ts`, and `apps/backend/test/integration/administrator-bootstrap-recovery.e2e-spec.ts` (SC-007, SC-010).

**Checkpoint**: Bootstrap and recovery are distinct, non-public, controlled operations with no
implicit privilege escalation and no reusable session issuance.

## Phase 7: Integration, Documentation, and Final Verification

**Purpose**: Integrate only approved modules, document safe operation, and prove all Feature 003,
Feature 002, and Feature 001 boundaries remain intact.

- [X] T044 Integrate the completed authentication module and controlled operator command without changing Feature 002 authorization semantics or health behavior in `apps/backend/src/app.module.ts` and `apps/backend/src/main.ts` (FR-014, FR-024).
- [X] T045 [P] Document local configuration placeholders, token/temporary-credential non-disclosure, supported HTTP contract, non-public operator modes, cleanup retention, and deferred frontend storage in `docs/desarrollo/autenticacion-sesiones.md` (FR-019, FR-024–FR-026, FR-033–FR-036).
- [X] T046 Regenerate Prisma client, apply Feature 003 migration against isolated PostgreSQL, and verify migration/schema behavior serially in `apps/backend/prisma/schema.prisma`, `apps/backend/prisma/migrations/`, and `apps/backend/test/integration/authentication-schema.e2e-spec.ts` (FR-019, FR-025–FR-036).
- [X] T047 Run all Feature 003 unit suites and the existing Feature 002 identity, role, academy-membership, concurrency, authorization, and privileged-change suites in `apps/backend/src/authentication/`, `apps/backend/src/identity/`, `apps/backend/src/academy-membership/`, `apps/backend/src/authorization/`, and `apps/backend/src/privileged-changes/` (FR-001–FR-036, SC-001–SC-010).
- [X] T048 Run Feature 003 PostgreSQL integration suites sequentially with isolated fixtures and targeted cleanup, followed by existing Feature 001/002 PostgreSQL suites, in `apps/backend/test/integration/` (FR-001–FR-036, SC-001–SC-011).
- [X] T049 Run Feature 003 and existing health HTTP contract suites, confirming no extra HTTP operation and public liveness/readiness preservation, in `apps/backend/test/contract/` and `apps/backend/test/integration/authentication-http.e2e-spec.ts` (FR-013–FR-014, FR-024, SC-005–SC-006, SC-011).
- [X] T050 Run backend typecheck and Nest CLI build after Prisma generation in `apps/backend/package.json` and `apps/backend/tsconfig.json` (FR-001–FR-036).
- [X] T051 Execute the Feature 003 scenarios in `specs/003-authentication-sessions/quickstart.md`, preserving the PostgreSQL volume and without repeated clean-install or intentionally interrupted-install exercises (SC-001–SC-011).
- [X] T052 Perform final scope, secret-disclosure, contract, and traceability audit against `specs/003-authentication-sessions/spec.md`, `specs/003-authentication-sessions/plan.md`, `specs/003-authentication-sessions/contracts/`, and `specs/003-authentication-sessions/tasks.md`; confirm FR-001–FR-036 and SC-001–SC-012 have passing implementation evidence and no excluded authentication/product scope was introduced (SC-012).

**Checkpoint**: Feature 003 is fully verified, documented, backend-only, traceable, and ready for
delivery review.

## Dependencies and Execution Order

`Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7`.

- Phase 1 blocks every later phase because credentials, sessions, and configuration require the
  schema and validated security settings.
- Phase 2 provides permanent and temporary credential behavior required by login and first-use
  session creation.
- Phase 3 provides the session/token boundary consumed by login, HTTP protection, and Administrator
  operations.
- Phase 4 requires Phase 2 and Phase 3 services for credential login and session issuance.
- Phase 5 requires the completed service boundaries from Phases 2–4; it must not redefine their
  business logic.
- Phase 6 reuses Phase 2 credential services and Feature 002 role/audit boundaries, but its
  operator modes remain non-HTTP.
- Phase 7 verifies every completed phase in dependency order. PostgreSQL verification is always
  serialized where state can overlap.

## User Story Dependencies

| Story | Phase | Depends on |
|---|---|---|
| US1 — Sign in and protected operation | 4–5 | Phases 1–3 |
| US2 — Safe renewal | 3 | Phases 1–2 |
| US3 — Current/all logout | 3 | Phases 1–2 |
| US4 — Unsafe attempt rejection | 4 | Phases 1–3 |
| US5 — First-ever Administrator initialization | 6 | Phases 1–3 and Feature 002 |
| US6 — Existing identity credential provisioning | 2 | Phase 1 and Feature 002 |
| US7 — Administrator recovery | 6 | Phases 1–3 and Feature 002 |

## Parallel Opportunities

- Phase 1: T002 may run in parallel with T003 because they own configuration and integration-test
  files, but migration application T007 remains serialized.
- Phase 2: T009 unit tests may be authored in parallel with T010's sequential PostgreSQL test.
- Phase 3: T016 unit tests may be authored in parallel with T017's sequential PostgreSQL test.
- Phase 4: T023 and T024 use separate unit-test files and may be authored in parallel; T025 remains
  serialized because it uses PostgreSQL.
- Phase 5: T029 and T030 use independent contract/unit files; T031 HTTP integration follows them.
- Phase 6: T037 and T038 use separate unit-test files; T039 remains serialized due to shared
  Administrator state.
- Phase 7: T045 documentation can proceed in parallel with T044 only after the public operation
  design is settled; verification tasks T046–T051 run in their stated order.

## Implementation Strategy

Implement one phase per future `$speckit-implement` invocation. A phase prompt authorizes all
technically necessary in-scope work needed to close that phase, including ordinary syntax, typing,
imports, Prisma, migration, transaction, test, fixture, cleanup, port, and module-wiring defects.
Stop only for a new product decision, material architecture change, dependency replacement,
destructive non-test-data operation, unavailable permission, or work outside the active phase.

Reuse successful evidence only when no later change invalidates it. If an execution quota or window
interrupts a phase, resume at the first unfinished task or verification rather than restarting the
phase. Do not add repeated clean-install or intentionally interrupted-install exercises.

## Requirement Coverage

| Coverage | Tasks |
|---|---|
| FR-001–FR-004 | T005, T010, T024, T027, T047, T052 |
| FR-005–FR-010 | T009–T015, T023–T028, T047, T052 |
| FR-011–FR-015 | T016, T018–T020, T029–T036, T049, T052 |
| FR-016–FR-023 | T016–T022, T047–T052 |
| FR-024–FR-026 | T002–T008, T029–T036, T037–T052 |
| FR-027–FR-033 | T009–T015, T029, T031–T032, T047, T052 |
| FR-034–FR-036 | T003, T006, T037–T043, T047–T052 |
| SC-001–SC-005 | T015, T022, T028, T036, T047–T052 |
| SC-006–SC-012 | T029–T036, T037–T052 |

## Format Validation

Every task uses the required `- [ ] T### [P?] [US?] description with path` format. Story labels
appear only on story tasks; setup, foundation, and final verification tasks remain unlabeled.
