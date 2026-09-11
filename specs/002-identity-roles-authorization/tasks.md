---

description: "Dependency-ordered implementation tasks for Identity, Roles, and Authorization"
---

# Tasks: Identity, Roles, and Authorization

**Input**: Design documents from `/specs/002-identity-roles-authorization/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`, and
`contracts/authorization-evaluation.md`

**Tests**: Tests are required by the plan and MUST fail for the expected reason before each behavior
is implemented.

## Phase 1: Persistence Model and Migrations

**Entry condition**: Feature 001 runtime and local PostgreSQL baseline are available.

- [X] T001 [P] Define identity, role-assignment, academy, academy-membership, and authorization-change-record models with statuses, timestamps, actor references, foreign keys, and lookup indexes in `apps/backend/prisma/schema.prisma` (FR-001, FR-002, FR-005, FR-007, FR-019)
- [X] T002 Define reviewed Feature 002 migration SQL for partial unique active academy membership and duplicate active role-assignment prevention in `apps/backend/prisma/migrations/*/migration.sql` (FR-005, FR-012, SC-003)
- [X] T003 Generate the Prisma client and apply the Feature 002 migration against isolated local PostgreSQL in `apps/backend/prisma/schema.prisma` and `apps/backend/prisma/migrations/` (FR-001, FR-005)
- [X] T004 Write failing PostgreSQL migration/constraint tests for history, foreign keys, partial uniqueness, and Feature 001 health preservation in `apps/backend/test/integration/identity-schema.e2e-spec.ts` (FR-005, FR-019, SC-003)
- [X] T005 Verify T001–T004 against real PostgreSQL, including rejected simultaneous active memberships, in `apps/backend/test/integration/identity-schema.e2e-spec.ts` (FR-012, SC-003)

**Checkpoint**: Persistence is reviewable, migratable, historical, and database-backed; stop before Phase 2.

## Phase 2: Identity Lifecycle and Role Assignments

**Entry condition**: Phase 1 checkpoint passed.

- [X] T006 [P] Write failing identity lifecycle and role-history unit tests in `apps/backend/src/identity/identity.service.spec.ts` (FR-001, FR-002, FR-007, FR-011)
- [X] T007 [P] Write failing PostgreSQL role-assignment persistence tests for multiple roles, revocation, duplicate-active prevention, and history in `apps/backend/test/integration/role-assignment.e2e-spec.ts` (FR-002, FR-008, SC-001)
- [X] T008 [US1] Implement identity status lifecycle and opaque identity lookup in `apps/backend/src/identity/identity.service.ts` (FR-001, FR-011)
- [X] T009 [US1] Implement active/revoked historical role-assignment behavior without a single role field in `apps/backend/src/identity/role-assignment.service.ts` (FR-002, FR-007, FR-008)
- [X] T010 [US1] Export identity and role-assignment domain boundaries from `apps/backend/src/identity/identity.module.ts` (FR-021)
- [X] T011 [US1] Run Phase 2 unit and PostgreSQL role-assignment verification in `apps/backend/src/identity/identity.service.spec.ts` and `apps/backend/test/integration/role-assignment.e2e-spec.ts` (FR-001, FR-002, SC-001)

**Checkpoint**: Active identities and applicable role assignments are independently verifiable; stop before Phase 3.

## Phase 3: Academy Membership Integrity and History

**Entry condition**: Phases 1–2 passed.

- [X] T012 [P] Write failing membership lifecycle and historical-access unit tests in `apps/backend/src/academy-membership/academy-membership.service.spec.ts` (FR-005, FR-006, FR-012)
- [X] T013 Write failing real PostgreSQL tests for atomic transitions, rollback, and concurrent membership operations using separate clients in `apps/backend/test/integration/academy-membership-concurrency.e2e-spec.ts` (FR-005, FR-012, SC-003)
- [X] T014 [US2] Implement active membership creation, ending, and historical lookup in `apps/backend/src/academy-membership/academy-membership.service.ts` (FR-005, FR-006, FR-012)
- [X] T015 [US2] Implement short Serializable membership transition with bounded `P2034` retry and transaction-only reads/writes in `apps/backend/src/academy-membership/membership-transition.service.ts` (FR-012, FR-020, SC-003)
- [X] T016 [US2] Export the minimal academy-membership boundary in `apps/backend/src/academy-membership/academy-membership.module.ts` (FR-021)
- [X] T017 [US2] Verify history, inactive-membership denial, one-active constraint, concurrency, and rollback in `apps/backend/test/integration/academy-membership-concurrency.e2e-spec.ts` (FR-012, SC-003)

**Checkpoint**: Academy boundaries are concurrency-safe and historical; stop before Phase 4.

## Phase 4: Static Permission Catalog and Authorization Evaluator

**Entry condition**: Phases 1–3 passed.

- [X] T018 [P] Define the static permission catalog and action-context requirements in `apps/backend/src/authorization/permission-catalog.ts` (FR-008, FR-009, FR-021)
- [X] T019 [P] Define the versioned framework-independent request, decision, and safe denial category shapes in `apps/backend/src/authorization/authorization.contract.ts` (FR-003, FR-015, FR-022)
- [X] T020 [P] Write failing authorization matrix tests for active/inactive identities and roles, multi-role limits, anonymous context, tutor facts, academy facts, malformed context, and safe denials in `apps/backend/src/authorization/authorization.service.spec.ts` (FR-003, FR-008, FR-009, FR-011, FR-013, FR-015, FR-016, SC-001, SC-002, SC-005, SC-006)
- [X] T021 [US1] Implement default-deny authorization evaluation using only explicit caller context in `apps/backend/src/authorization/authorization.service.ts` (FR-008, FR-009, FR-010, FR-021, FR-022)
- [X] T022 [US2] Implement academy membership and caller-supplied tutor/resource relationship checks in `apps/backend/src/authorization/authorization.service.ts` (FR-012, FR-013, FR-014)
- [X] T023 [US4] Implement anonymous-public versus protected-information classification without creating an authenticated role in `apps/backend/src/authorization/authorization.service.ts` (FR-003, FR-015, FR-016)
- [X] T024 [US1] Export only the internal authorization contract and evaluator from `apps/backend/src/authorization/authorization.module.ts` (FR-010, FR-021)
- [X] T025 [US1] Verify the full authorization matrix and disclosure-safe denials in `apps/backend/src/authorization/authorization.service.spec.ts` (SC-001, SC-002, SC-005, SC-006)

**Checkpoint**: Authorization is transport-independent, default-deny, and independently testable; stop before Phase 5.

## Phase 5: Administrator-Only Privileged Changes and Traceability

**Entry condition**: Phases 1–4 passed.

- [X] T026 [P] Write failing privileged-change unit tests for Administrator-only role/membership operations, denied attempts, and audit failure in `apps/backend/src/privileged-changes/privileged-changes.service.spec.ts` (FR-017, FR-018, FR-020)
- [X] T027 Write failing PostgreSQL tests for transactional applied/denied trace records and rollback in `apps/backend/test/integration/privileged-changes.e2e-spec.ts` (FR-017, FR-018, FR-019, FR-020, SC-004)
- [X] T028 [US3] Implement Administrator-only assign/revoke privileged role operations in `apps/backend/src/privileged-changes/privileged-changes.service.ts` (FR-017, FR-019, FR-020)
- [X] T029 [US3] Implement Administrator-controlled assign/change/revoke Academy User membership operations in `apps/backend/src/privileged-changes/privileged-changes.service.ts` (FR-018, FR-019, FR-020)
- [X] T030 [US3] Persist redacted applied and denied change records atomically in `apps/backend/src/privileged-changes/change-audit.service.ts` (FR-019, FR-020, FR-022)
- [X] T031 [US3] Export privileged-change application services without bootstrap behavior in `apps/backend/src/privileged-changes/privileged-changes.module.ts` (FR-017, FR-023, FR-024)
- [X] T032 [US3] Verify Administrator-only behavior, trace completeness, denied-attempt safety, and rollback in `apps/backend/test/integration/privileged-changes.e2e-spec.ts` (SC-004)

**Checkpoint**: Privilege expansion is Administrator-only, atomic, and traceable; stop before Phase 6.

## Phase 6: Module Integration, Documentation, and Final Verification

**Entry condition**: Phases 1–5 passed.

- [X] T033 Integrate identity, academy-membership, authorization, and privileged-change modules without controllers in `apps/backend/src/app.module.ts` (FR-010, FR-021, FR-023)
- [X] T034 [P] Document Feature 002 prerequisites, migration workflow, internal-contract validation, and excluded authentication behavior in `docs/desarrollo/identidad-autorizacion.md` (FR-021, FR-023)
- [X] T035 Verify Prisma generation, migration application, backend type checks, all unit tests, sequential PostgreSQL integration tests, and Feature 001 liveness/readiness in `package.json` and `apps/backend/test/` (SC-001, SC-002, SC-003, SC-004)
- [X] T036 Perform final scope and traceability audit for FR-001–FR-024 and SC-001–SC-007 in `specs/002-identity-roles-authorization/tasks.md` (SC-007)

**Checkpoint**: Feature 002 is verified, documented, backend-only, and within approved scope.

## Dependencies and Execution Order

`Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6`.

- Persistence precedes all persistence-backed services.
- Identity/roles precede role evaluation; academy integrity precedes membership evaluation.
- Authorization precedes privileged-change authorization.
- PostgreSQL tests sharing state run sequentially or on isolated data and are never `[P]`.

## Parallel Examples

- Phase 2: T006 and T007 may be authored in parallel; T008 and T009 then complete before T010.
- Phase 4: T018, T019, and T020 own separate files and may run in parallel before T021.
- Phase 5: T026 and T027 may be authored in parallel; T028–T030 remain sequential.

## Requirement Coverage

| Coverage | Tasks |
|---|---|
| FR-001–FR-007 | T001–T011 |
| FR-008–FR-016 | T018–T025 |
| FR-017–FR-020 | T026–T032 |
| FR-021–FR-024 | T010, T016, T018–T24, T31–T36 |
| SC-001–SC-007 | T007, T013, T020, T025, T027, T032, T035–T036 |

## Implementation Strategy

Implement and validate only one checkpointed phase per future `$speckit-implement` invocation.
The smallest valuable increment is Phases 1–2; it is not authorization-complete until Phases 3–5
pass. Do not auto-continue to a later phase.
