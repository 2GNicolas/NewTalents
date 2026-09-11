---

description: "Dependency-ordered implementation tasks for the Project Runtime Foundation"
---

# Tasks: Project Runtime Foundation

**Input**: Design documents from `/specs/001-project-runtime-foundation/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`,
`contracts/health.openapi.yaml`, and the project constitution

**Tests**: Verification is required by the specification and plan. Story-level test tasks appear
before the implementation they verify and must fail for the expected reason before implementation.

**Organization**: Tasks follow the required technical dependency order and retain `[US1]` through
`[US4]` traceability wherever a task implements or verifies a user story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Safe to execute in parallel because the task owns different files and has no unfinished
  dependency on another parallel task.
- **[Story]**: User story served by the task. Setup and shared foundation tasks have no story label.
- Every task names its exact target file or directory.

## Phase 1: Root Monorepo Foundation

**Purpose**: Establish the reproducible npm-workspaces boundary, pinned toolchain, shared command
surface, and source-control protections required by every story.

- [X] T001 Create the private npm workspace root with `workspaces: ["apps/*"]`, `engines.node: ">=24.11.0 <25"`, an exact npm `10.8.0` engine, `packageManager: "npm@10.8.0"`, error-level `devEngines.packageManager` enforcement, and delegating scripts for workspace startup, database lifecycle, Prisma generation, health, type-check, tests, configuration, and foundation verification in `package.json` (FR-001, FR-002, FR-003, FR-022)
- [X] T002 [P] Create the ESM backend workspace manifest with `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, and `@nestjs/testing` `11.1.8`; `@nestjs/cli 11.0.10`; `@nestjs/schematics 11.0.9`; `@nestjs/config` `12.0.0`; Zod `4.6.1`; Prisma CLI/client/PG adapter `7.10.0`; `pg` `8.23.0`; `reflect-metadata` `0.2.2`; RxJS `7.8.2`; TypeScript `5.9.3`; `ts-node 10.9.2`; `@types/node 24.13.4`; `@types/pg 8.23.1`; Vitest and coverage-v8 `5.0.0`; Supertest `7.2.2`; `@types/supertest 7.2.1`; and backend lifecycle/test scripts in `apps/backend/package.json` (FR-002, FR-003)
- [X] T003 [P] Create the frontend workspace manifest with Expo `~57.0.21`, React Native `0.86.3`, React and React DOM `19.2.3`, Expo Router `~57.0.20`, React Native Web `~0.21.0`, TypeScript `~6.0.3`, `@types/react ~19.2.2`, Jest `29.7.0`, `@types/jest 29.5.14`, `jest-expo ~57.0.5`, React Native Testing Library `14.0.1`, Test Renderer `1.2.0`, and web/Android/iOS/test scripts in `apps/frontend/package.json` (FR-002, FR-003, FR-005)
- [X] T004 [P] Pin the development runtime to Node.js `24.11.0` in `.nvmrc` (FR-002)
- [X] T005 [P] Enforce declared runtime compatibility during npm operations with `engine-strict=true` in `.npmrc` (FR-002, FR-021)
- [X] T006 Implement and test a cross-platform pre-dependency toolchain check that accepts Node `24.11.0` with npm `10.8.0`, rejects Node outside `>=24.11.0 <25` or a different npm version with a nonzero value-free diagnostic, and can run directly with Node before `npm ci` in `tools/verify-toolchain.mjs` and `tools/verify-toolchain.test.mjs` (FR-002, FR-021)
- [X] T007 [P] Ignore dependency directories, real `.env` variants while retaining `.env.example`, Expo state/output, generated Prisma client output, build artifacts, coverage/test output, logs, editor files, and local database artifacts in `.gitignore` (FR-012, FR-013)
- [X] T008 Generate with npm `10.8.0` and retain in source control the single root dependency resolution for both workspaces in `package-lock.json`, verifying no workspace-local lockfile exists under `apps/` (FR-001, FR-002)

**Checkpoint**: One pinned install surface exists and unsupported Node versions fail before a
partially prepared workspace is reported ready.

---

## Phase 2: Local PostgreSQL Foundation

**Purpose**: Provide the isolated, persistent PostgreSQL service that blocks database-dependent
backend work while requiring no host PostgreSQL installation.

- [X] T009 [P] Define `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` with placeholder-only `__REQUIRED__` values, define the non-secret required `POSTGRES_HOST_PORT=5433` example, and classify sensitive values in `docker/.env.example` (FR-012, FR-013, FR-024, FR-026)
- [X] T010 Write failing Node built-in tests for a missing `docker/.env`; missing, empty, `__REQUIRED__`, and `CHANGE_ME` values in any of the four PostgreSQL settings; malformed or out-of-range host ports; valid explicit values; and secret-free nonzero diagnostics in `docker/validate-environment.test.mjs` (FR-011, FR-013, FR-021, FR-024, FR-026)
- [X] T011 Implement the cross-platform Compose preflight in `docker/validate-environment.mjs`, validating `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and optional `POSTGRES_HOST_PORT` exactly as tested and exposing no supplied values (FR-011, FR-014, FR-021, FR-024, FR-026)
- [X] T012 Create service and container `new-talents-postgres` using `postgres:18.6-bookworm`, internal port `5432`, required `${POSTGRES_HOST_PORT}` interpolation, `pg_isready`, and named volume `new-talents-postgres-data:/var/lib/postgresql` in `docker/compose.yaml` (FR-024, FR-025, FR-026, FR-027)
- [X] T013 Wire `db:validate-env` before `db:up`, then validate startup, status/readiness, logs, stop, start, restart, and non-destructive down behavior through root scripts in `package.json`, confirming validation failure never invokes Compose, all commands target only `docker/compose.yaml`, volumes are never removed, and `apps/frontend` or `apps/backend` are never containerized (FR-021, FR-022, FR-024, FR-025, FR-026)

**Checkpoint**: Docker Compose can start a healthy PostgreSQL 18.6 service on host port 5433 by
default, and normal lifecycle operations retain the project-specific volume.

---

## Phase 3: User Story 3 — Backend Runtime Foundation (Priority: P1)

**Goal**: Start and stop a minimal NestJS process independently, with no business module or database
table requirement.

**Independent Test**: With syntactically valid runtime configuration, start the backend, confirm it
opens its HTTP listener, stop it gracefully, and confirm no business route or module is registered.

### Backend runner foundation

- [X] T014 [P] Configure strict TypeScript 6 ESM compilation with `module` and `moduleResolution` set to `NodeNext`, separate build output, and emitted `.js` suffixes for relative imports where NodeNext requires them in `apps/backend/tsconfig.json` and `apps/backend/tsconfig.build.json` (FR-002, FR-006)
- [X] T015 [P] Configure Vitest `5.0.0` for the Node ESM environment, unit/contract/integration discovery, coverage-v8, deterministic timeouts, and shared hooks only where needed in `apps/backend/vitest.config.ts` and `apps/backend/test/setup.ts` so red tests fail for missing behavior rather than runner setup (FR-002, FR-006)

### Tests for User Story 3

- [X] T016 [US3] Write a failing bootstrap integration test covering successful listener startup, nonzero startup failure, graceful shutdown, and absence of business routes in `apps/backend/test/integration/bootstrap.e2e-spec.ts` (FR-006, FR-021, FR-023)

### Implementation for User Story 3

- [X] T017 [P] Configure the ESM backend workflow to use project-local Nest CLI with the standard TypeScript compiler for production compilation and development watch, an explicit emitted `main.js` entry for ESM startup, and Node for compiled startup without code-generation side effects in `apps/backend/package.json` and `apps/backend/nest-cli.json` (FR-006)
- [X] T018 [US3] Create the minimal composition root with no business imports in `apps/backend/src/app.module.ts` (FR-006, FR-023)
- [X] T019 [US3] Bootstrap the NestJS HTTP process, enable shutdown hooks, return nonzero on startup failure, and omit a global DTO validation pipe because this feature has no payload-bearing endpoint in `apps/backend/src/main.ts` (FR-006, FR-021, FR-023)

**Checkpoint**: The backend process boundary works independently; health and database readiness are
not yet claimed.

---

## Phase 4: User Story 4 — Backend Configuration and Prisma Connectivity (Priority: P2)

**Goal**: Validate environment-specific backend configuration and provide safe, bounded PostgreSQL
connectivity without models, migrations, seeds, or startup dependence on database availability.

**Independent Test**: Valid configuration lets the backend serve while a real PostgreSQL `SELECT 1`
reports connectivity; missing, empty, malformed, placeholder, production-inappropriate, rejected-
credential, and unavailable-database cases produce distinct secret-free failures.

### Tests for User Story 4

- [X] T020 [P] [US4] Write failing table-driven tests for `NODE_ENV` (`development`, `test`, or `production`; no implicit production fallback), `PORT` (valid TCP port; non-empty; not a placeholder), `DATABASE_URL` (`postgresql:` or `postgres:` with credentials and database; not a placeholder), and `ALLOWED_ORIGINS` (comma-delimited absolute origins; no implicit `*`; explicit in production) in `apps/backend/src/config/environment.schema.spec.ts` (FR-009, FR-010, FR-011, FR-015, FR-016, SC-002)
- [X] T021 [P] [US4] Write failing unit tests for one tagged static `SELECT 1`, a five-second upper bound, rejected credentials, unavailable infrastructure, sanitized error classification, and client shutdown in `apps/backend/src/database/database-readiness.service.spec.ts` (FR-014, FR-017, FR-018, FR-020)

### Implementation for User Story 4

- [X] T022 [P] [US4] Define placeholder-only backend values and label `DATABASE_URL` sensitive while documenting every variable's exposure boundary in `apps/backend/.env.example` (FR-009, FR-012, FR-013, FR-015, FR-016, FR-017)
- [X] T023 [P] [US4] Implement the exact `BackendRuntimeConfiguration` constraints from `data-model.md`, including empty and `__REQUIRED__`/`CHANGE_ME` rejection, in `apps/backend/src/config/environment.schema.ts` (FR-010, FR-011, FR-015, FR-016)
- [X] T024 [US4] Load one immutable, typed, fail-fast configuration object without echoing supplied values in `apps/backend/src/config/config.module.ts` (FR-009, FR-010, FR-011, FR-014)
- [X] T025 [P] [US4] Parse `ALLOWED_ORIGINS` into explicit absolute origins and reject wildcard or implicit production origins in `apps/backend/src/config/cors.config.ts` (FR-015, FR-016)
- [X] T026 [US4] Apply validated port and explicit CORS settings before listening while keeping diagnostics value-free in `apps/backend/src/main.ts` (FR-010, FR-014, FR-016, FR-021)
- [X] T027 [P] [US4] Define only the Prisma client generator and PostgreSQL datasource, with zero models and zero business enums, in `apps/backend/prisma/schema.prisma` (FR-017, FR-019, FR-023, FR-027)
- [X] T028 [P] [US4] Configure Prisma 7 schema location and generated-client output in `apps/backend/prisma.config.ts`, separating generation from runtime `DATABASE_URL` loading so generation requires neither a usable local/production credential nor database reachability and runtime retains no development or production credential default (FR-012, FR-015, FR-017)
- [X] T029 [US4] Add the explicit `prisma:generate` command and backend prebuild/prestart preparation in `apps/backend/package.json`, generate the client into the ignored output declared by `apps/backend/prisma/schema.prisma`, and verify this succeeds after `npm ci` without contacting PostgreSQL or creating a migration, seed, table, model, or enum (FR-001, FR-017, FR-019, FR-027)
- [X] T030 [US4] Create one application-scoped Prisma client using `@prisma/adapter-pg` and the validated connection URL in `apps/backend/src/database/prisma.service.ts` (FR-017, FR-018)
- [X] T031 [US4] Implement the authenticated tagged `SELECT 1` probe with a five-second timeout and sanitized categories for unavailable, rejected, and timed-out connections in `apps/backend/src/database/database-readiness.service.ts` (FR-014, FR-018, FR-020)
- [X] T032 [US4] Export only the Prisma lifecycle service and database-readiness capability from `apps/backend/src/database/database.module.ts` (FR-017, FR-018, FR-023)
- [X] T033 [US4] Integrate validated configuration and database modules while allowing liveness-serving startup when PostgreSQL is unavailable and closing Prisma cleanly on process shutdown in `apps/backend/src/app.module.ts` (FR-006, FR-010, FR-018, FR-020, FR-021)
- [X] T034 [US4] Map configuration failures to nonzero startup and database probe failures to fixed sanitized categories without connection strings, credentials, driver messages, or stacks in `apps/backend/src/config/safe-diagnostic.ts` (FR-011, FR-014, FR-020, FR-021)

**Checkpoint**: Configuration fails fast before listening; a database outage does not kill the
serving process but prevents database readiness; Prisma has no domain schema.

---

## Phase 5: User Stories 3 and 4 — Liveness and Readiness

**Goal**: Implement the exact health contract with process-only liveness and configuration-plus-
PostgreSQL readiness.

**Independent Test**: Liveness returns its fixed HTTP 200 response whenever Nest serves, while
readiness returns HTTP 200 only after a real bounded PostgreSQL query and HTTP 503 for unavailable,
rejected, or timed-out database access.

### Contract tests

- [X] T035 [P] [US3] Write a failing contract test for `GET /health/live` requiring HTTP 200, `application/json`, `Cache-Control: no-store`, exactly `{ "status": "ok" }`, no PostgreSQL call, and no undocumented error response in `apps/backend/test/contract/liveness.contract-spec.ts` (FR-007, FR-008)
- [X] T036 [P] [US4] Write a failing contract test for `GET /health/ready` requiring HTTP 200 with exactly `{ "status": "ready" }` after successful bounded `SELECT 1`; HTTP 503 with exactly `{ "status": "unavailable" }` for unavailable, rejected, refused, timed-out, or unexpected probe failure; an internal five-second timeout; `Cache-Control: no-store`; and no HTTP 500 outcome in `apps/backend/test/contract/readiness.contract-spec.ts` (FR-008, FR-018, FR-020)

### Health implementation

- [X] T037 [US3] Implement process-only `GET /health/live` without a Prisma or PostgreSQL dependency in `apps/backend/src/health/liveness.controller.ts` (FR-007, FR-008)
- [X] T038 [US4] Convert the database probe result into only `ready` or `unavailable` readiness states in `apps/backend/src/health/readiness.service.ts` (FR-008, FR-018, FR-020)
- [X] T039 [US4] Implement `GET /health/ready` with HTTP 200/503 behavior matching `contracts/health.openapi.yaml` in `apps/backend/src/health/readiness.controller.ts` (FR-007, FR-008, FR-018, FR-020)
- [X] T040 [P] [US3] Add the shared JSON and `Cache-Control: no-store` health response policy without extra response fields in `apps/backend/src/health/health-response.interceptor.ts` (FR-008, FR-014)
- [X] T041 [P] [US4] Convert every unexpected readiness failure to HTTP 503 with exactly `{ "status": "unavailable" }`, while preserving process-only liveness and exposing no environment values, credentials, connection strings, stack traces, query text, versions, hosts, or ports, in `apps/backend/src/health/health-exception.filter.ts` (FR-008, FR-014, FR-020)
- [X] T042 [US3] Register only liveness, readiness, the health response policy, and safe health error handling in `apps/backend/src/health/health.module.ts` and `apps/backend/src/app.module.ts` (FR-006, FR-007, FR-008, FR-023)

**Checkpoint**: Liveness and readiness are observably distinct and conform to the approved OpenAPI
contract without exposing infrastructure details.

---

## Phase 6: User Story 2 — Frontend Runtime Foundation (Priority: P1)

**Goal**: Start one neutral Expo Router entry on web, Android, and iOS with explicit public
configuration and no product navigation or simulated product capability.

**Independent Test**: With a valid public API URL, each supported target renders the responsive
neutral ready entry; missing, empty, malformed, or placeholder configuration renders a clear safe
failure and never reports ready.

### Frontend runner foundation

- [X] T043 [P] Configure Jest `29.7.0` with the `jest-expo ~57.0.5` preset, Expo-compatible transforms and environment, React Native Testing Library `14.0.1`, Test Renderer `1.2.0`, and shared setup only where needed in `apps/frontend/jest.config.cjs` and `apps/frontend/tests/setup.ts` so red tests fail for missing behavior rather than runner setup (FR-002, FR-005)

### Tests for User Story 2

- [X] T044 [P] [US2] Write failing table-driven tests requiring `EXPO_PUBLIC_API_BASE_URL` to be HTTP or HTTPS, non-empty, and not a placeholder sentinel, and confirming no credential/token variable is accepted in `apps/frontend/src/config/public-environment.spec.ts` (FR-009, FR-010, FR-011, FR-012, FR-013)
- [X] T045 [P] [US2] Write failing rendering tests for the neutral ready state, safe configuration-failure state, responsive narrow/wide layout, and absence of product navigation or simulated modules in `apps/frontend/tests/runtime-entry.spec.tsx` (FR-004, FR-005, FR-023)

### Implementation for User Story 2

- [X] T046 [P] [US2] Configure Expo-compatible strict TypeScript and test typing in `apps/frontend/tsconfig.json` (FR-002, FR-005)
- [X] T047 [P] [US2] Configure Expo SDK 57 application metadata, Expo Router entry, and web/Android/iOS targets without product routes in `apps/frontend/app.json` (FR-003, FR-004, FR-005)
- [X] T048 [P] [US2] Define only `EXPO_PUBLIC_API_BASE_URL=__REQUIRED__` and document that every `EXPO_PUBLIC_*` value is bundled public data and cannot contain a secret in `apps/frontend/.env.example` (FR-009, FR-012, FR-013)
- [X] T049 [US2] Implement eager public configuration validation and a value-free error result in `apps/frontend/src/config/public-environment.ts` (FR-010, FR-011, FR-014)
- [X] T050 [P] [US2] Implement a minimal Expo Router shell with no product stack, tabs, protected routes, or placeholder modules in `apps/frontend/app/_layout.tsx` (FR-004, FR-005, FR-023)
- [X] T051 [US2] Render only a responsive, accessible neutral runtime-ready confirmation after successful validation and a distinct safe non-ready message after failure in `apps/frontend/app/index.tsx` (FR-004, FR-005, FR-010, FR-011)
- [X] T052 [US2] Verify Expo's compatibility matrix with Expo Doctor and `expo install --fix`, retaining Expo SDK 57, React Native 0.86.3, React 19.2.3, Expo Router 57, and the single root resolution in `apps/frontend/package.json` and `package-lock.json` (FR-002, FR-005)

**Checkpoint**: The frontend starts independently on each supported target and exposes only the
neutral foundation state or a safe configuration failure.

---

## Phase 7: Automated Verification

**Purpose**: Prove the complete foundation behavior against real PostgreSQL, the health contract,
the frontend targets, secret boundaries, and source-control constraints.

- [X] T053 [US4] Add a real-container integration test proving authenticated Prisma `SELECT 1` succeeds without creating or requiring any table in `apps/backend/test/integration/postgresql-connectivity.e2e-spec.ts` (FR-017, FR-018, FR-019)
- [X] T054 [US4] Add sequential real-container readiness cases for stopped PostgreSQL, rejected credentials, refused connections, and the internal five-second query timeout, each producing the exact HTTP 503 response within 15 seconds and restoring shared Compose state afterward, in `apps/backend/test/integration/postgresql-failures.e2e-spec.ts` (FR-020, SC-004)
- [X] T055 [US4] Add a sequential persistence test that uses an isolated test database, creates a uniquely named technical probe table and marker, performs normal Compose stop/start, verifies retention, drops the table in guaranteed `finally` cleanup, verifies its absence, and confirms no Prisma model, migration, seed, application startup, readiness, or ordinary connectivity path creates a database object in `apps/backend/test/integration/postgresql-persistence.e2e-spec.ts` (FR-019, FR-025, FR-027)
- [X] T056 [P] [US3] Add health response and captured-log assertions that supplied secrets, database URLs, credentials, queries, stack traces, hosts, ports, and dependency versions never appear in `apps/backend/test/contract/health-disclosure.contract-spec.ts` (FR-008, FR-014, SC-005)
- [X] T057 [P] [US4] Add an OpenAPI consistency test that validates both implemented paths, methods, status codes, headers, and closed response schemas against `specs/001-project-runtime-foundation/contracts/health.openapi.yaml` in `apps/backend/test/contract/openapi-health.contract-spec.ts` (FR-007, FR-008, FR-020)
- [X] T058 [US3] Add an integration timing assertion that starts measurement after the backend reports its running state and verifies a successful `GET /health/live` response is observed within 10 seconds in `apps/backend/test/integration/backend-health-timing.e2e-spec.ts` (SC-003)
- [X] T059 [P] [US2] Add an Expo Web startup smoke test confirming the configured neutral entry becomes usable and an invalid configuration never reports ready in `apps/frontend/tests/smoke/web-startup.spec.ts` (FR-004, FR-010, SC-006)
- [X] T060 [P] [US2] Add Android and iOS bundle/start smoke verification using only supported host targets and record intentional host-platform skips without converting them to passes in `apps/frontend/tests/smoke/native-targets.spec.ts` (FR-003, FR-005, SC-006)
- [X] T061 Wire root `typecheck`, `test`, `verify:config`, `verify:foundation`, `prisma:generate`, `health:live`, `health:ready`, `db:validate-env`, and `db:verify-persistence` scripts to the completed workspace, preflight, and sequential real-container checks in `package.json` (FR-001, FR-018, FR-021, FR-022)
- [X] T062 Verify one root lockfile, ignored real environment files, placeholder-only committed examples, zero Prisma models/migrations/seeds, zero tracked usable credentials, and zero business modules through `package-lock.json`, `.gitignore`, `apps/backend/prisma/`, `apps/backend/.env.example`, `apps/frontend/.env.example`, and `docker/.env.example` (FR-012, FR-013, FR-019, FR-023, FR-027)

**Checkpoint**: Automated checks cover the four user stories, use real PostgreSQL where required,
and demonstrate the security, contract, persistence, and scope boundaries.

---

## Phase 8: User Story 1 — Local Documentation and Final Feature Validation (Priority: P1)

**Goal**: Make the complete foundation reproducible from a clean supported checkout using only
versioned instructions.

**Independent Test**: A contributor follows only the documented process from a clean supported
environment, prepares dependencies, starts PostgreSQL and both runtimes, and verifies
configuration, liveness, readiness, persistence, and target startup within 30 minutes without
undocumented assistance.

### Documentation and validation for User Story 1

- [X] T063 [US1] Document prerequisites, exact Node/npm checks, `npm ci`, environment preparation and sensitivity, PostgreSQL lifecycle, backend/frontend startup, health verification, database troubleshooting, normal non-destructive shutdown, and platform limitations without duplicating architecture content in `docs/desarrollo/entorno-local.md` (FR-001, FR-002, FR-022)
- [X] T064 [P] [US1] Add a concise contributor entry point that links to the local workflow and identifies the independent frontend, backend, and PostgreSQL boundaries in `README.md` (FR-001, FR-003, FR-022)
- [X] T065 [US1] Reconcile one documented successful clean dependency installation using the approved Node.js and npm versions with one successful aggregate foundation verification after the final Nest CLI restoration; document the Windows recovery procedure for an interrupted installation, preserve failed and interrupted attempts as superseded historical evidence, and confirm that no unresolved technical blocker remains in `docs/desarrollo/entorno-local.md` (SC-001, SC-003, SC-004, SC-006, SC-007)
- [X] T066 [US1] Perform the final requirement and scope audit across `package.json`, `apps/frontend/`, `apps/backend/`, `docker/`, and `docs/desarrollo/entorno-local.md`, confirming all FR-001 through FR-027 and SC-001 through SC-008 are evidenced and no excluded business, authentication, deployment, managed-database, or CI/CD capability exists (FR-023, FR-027, SC-008)

**Checkpoint**: Feature 001 is reproducible, independently verifiable, documented, and still contains
only the approved runtime foundation.

---

## Dependencies and Execution Order

### Phase dependencies

```text
Phase 1 Root monorepo
  ├── Phase 2 Local PostgreSQL
  │     └── Phase 3 Backend runtime
  │           └── Phase 4 Configuration and Prisma
  │                 └── Phase 5 Liveness and readiness
  └── Phase 6 Frontend runtime

Phase 5 + Phase 6
  └── Phase 7 Automated verification
        └── Phase 8 Documentation and final validation
```

- Phase 1 has no dependency and establishes all workspace manifests, toolchain verification, and
  the only lockfile.
- Phase 2 depends on the root workspace manifest, completes the database command surface, and blocks
  real connectivity work.
- Phase 3 depends on the workspace and produces the minimal serving backend process.
- Phase 4 depends on the backend process and local PostgreSQL contract.
- Phase 5 depends on validated configuration and the bounded database probe.
- Phase 6 depends only on Phase 1 and proceeds independently of Phases 2–5; its public API URL is
  configuration input and backend availability is not required to validate the frontend itself.
- Phase 7 joins the completed backend/database and frontend tracks and runs integrated,
  real-container, and cross-platform checks.
- Phase 8 depends on the final command surface and verification suite so instructions are executable.

### User story traceability

- **US1 — Repeatable local workspace**: Phase 1 establishes the mechanism; Phase 8 documents and
  directly validates it.
- **US2 — Frontend foundation**: Phase 6 implements it; Phase 7 verifies web and available native
  targets.
- **US3 — Backend foundation**: Phase 3 creates the process; Phase 5 adds process-only liveness;
  Phase 7 verifies disclosure safety.
- **US4 — Configuration and database readiness**: Phase 2 provides PostgreSQL; Phase 4 adds
  validation and Prisma connectivity; Phase 5 adds readiness; Phase 7 verifies real failure and
  persistence cases.

### Within-phase dependencies

- T008 waits for T001–T007 so the single lockfile resolves both complete workspace manifests after
  the actual toolchain is accepted.
- T010 fails for the expected validator behavior before T011; T012 may proceed beside T010–T011,
  and T013 waits for T009–T012.
- T014–T015 establish backend compilation and test execution before T016 is written and fails for
  missing runtime behavior; T019 waits for T017–T018.
- T020–T021 are written and fail before their Phase 4 implementations. T024 waits for T023; T026
  waits for T024–T025; T029 waits for T027–T028; T030 waits for T029; T031 waits for T030; T032 waits
  for T030–T031; T033 waits for T024, T026, and T032; T034 completes before Phase 4 verification.
- T035–T036 are written and fail before T037–T042. T038 waits for T031; T039 waits for T038; T042
  waits for T037–T041.
- T043 establishes the frontend runner before T044–T045 are written and fail for missing behavior.
  T051 waits for T049–T050; T052 waits for the frontend manifest and lockfile updates.
- T053, T054, and T055 execute serially because they share the fixed Compose service, container,
  port, and volume. T056–T060 may be authored in parallel after their implementation dependencies;
  T058 runs without overlapping a shared backend process. T061 waits for their command interfaces,
  and T062 runs after T061.
- T063 and T064 may begin together; T065 waits for T063 and the full verification suite; T066 is the
  final task.

## Parallel Execution Examples

### Root workspace

After T001 establishes the root contract, T002–T007 own distinct files and can be assigned together:

```text
T002 apps/backend/package.json
T003 apps/frontend/package.json
T004 .nvmrc
T005 .npmrc
T007 .gitignore
```

### Backend configuration and Prisma

Write T020 and T021 concurrently. After those tests fail as expected, these independent file groups
can proceed concurrently:

```text
T022 apps/backend/.env.example
T023 apps/backend/src/config/environment.schema.ts
T025 apps/backend/src/config/cors.config.ts
T027 apps/backend/prisma/schema.prisma
T028 apps/backend/prisma.config.ts
```

### Health

T035 and T036 can be written concurrently. Afterward T037, T040, and T041 own independent health
files; readiness implementation T038–T039 remains sequential because the controller depends on the
service.

### Frontend

T044 and T045 can be written concurrently. Then T046–T048 and T050 can proceed concurrently before
T049 and T051 complete configuration behavior and rendering.

### Automated verification

T053–T055 own separate files but their real-container execution is explicitly serial because they
share `new-talents-postgres`, host port `5433`, and `new-talents-postgres-data`. T056–T060 file
authoring remains parallel-safe, while any execution that uses a shared backend or Compose state is
serialized. T058 runs after the backend health implementation and without a competing backend
process.

## Implementation Strategy

### Foundation-first increment

1. Complete Phase 1 and verify the single install surface.
2. After Phase 1, start the frontend Phase 6 track independently while the backend/database track
   completes Phases 2–5.
3. On the backend/database track, verify PostgreSQL lifecycle, the backend process, configuration,
   connectivity, liveness, and readiness at their phase checkpoints.
4. On the frontend track, validate the neutral runtime without depending on backend implementation.
5. Join both tracks for Phases 7–8 and run the integrated clean-checkout acceptance procedure.

### Suggested MVP checkpoint

The smallest useful runtime-foundation checkpoint is Phases 1–3: a reproducible monorepo, isolated
PostgreSQL service, and independently starting backend process. It is not Feature 001 complete and
must not be presented as database-ready or frontend-ready until the remaining phases pass.

### Scope control

- Do not add authentication, authorization, users, roles, permissions, sessions, tokens, guards, or
  protected routes.
- Do not add Prisma models, business enums, migrations, seeds, placeholder domain entities, or
  application tables.
- Do not add product navigation, product screens, a design system, state management, or future
  module placeholders.
- Do not add deployment, production hosting, managed databases, CI/CD, FEM, or tournament work.
- A task that requires any excluded capability must stop and return to specification/clarification
  instead of expanding this file.

## Notes

- Every `[P]` marker denotes file-level independence, not permission to ignore phase prerequisites.
- Tests listed before implementation must first fail for the intended missing behavior.
- Root commands delegate to workspace or Docker Compose commands; no Nx, Turborepo, or custom
  monorepo orchestrator is introduced.
- `pg_isready` is container health only; backend readiness requires the Prisma `SELECT 1` path.
- Normal database shutdown never removes `new-talents-postgres-data`.
