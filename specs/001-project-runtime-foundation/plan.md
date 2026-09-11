# Implementation Plan: Project Runtime Foundation

**Branch**: `001-project-runtime-foundation` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-project-runtime-foundation/spec.md`

## Summary

Establish a reproducible npm-workspaces monorepo with two independently runnable application
boundaries: an Expo React Native frontend for web, Android, and iOS, and a NestJS backend exposing
only liveness and PostgreSQL-backed readiness. Local PostgreSQL is provisioned through Docker
Compose with persistent named storage; Prisma is initialized inside the backend solely for typed
connectivity and future migrations, with no models, tables, migrations, seeds, authentication, or
product behavior in this feature.

## Technical Context

**Language/Version**: Node.js `24.11.0` LTS; npm `10.8.0`; backend TypeScript `5.9.3`;
frontend TypeScript `~6.0.3`

**Primary Dependencies**: Expo `~57.0.21`, React Native `0.86.3`, React and React DOM `19.2.3`,
Expo Router `~57.0.20`, React Native Web `~0.21.0`; `@nestjs/common`, `@nestjs/core`,
`@nestjs/platform-express`, and `@nestjs/testing` `11.1.8`; `@nestjs/config` `12.0.0`, Zod `4.6.1`,
`reflect-metadata` `0.2.2`, RxJS `7.8.2`; Prisma
CLI/client/PG adapter `7.10.0`, `pg` `8.23.0`

**Tooling Dependencies**: Frontend `@types/react ~19.2.2`, `@types/jest 29.5.14`; backend
`@nestjs/cli 11.0.10`, `@nestjs/schematics 11.0.9`, `ts-node 10.9.2`, `@types/node 24.13.4`,
`@types/pg 8.23.1`, `@types/supertest 7.2.1`; frontend TypeScript `~6.0.3` and backend
TypeScript `5.9.3`

**Storage**: PostgreSQL `18.6` using `postgres:18.6-bookworm` in Docker Compose; project-specific
named volume; Prisma schema with generator and datasource only and no business models or migrations

**Testing**: Frontend: Jest `29.7.0`, `jest-expo ~57.0.5`, React Native Testing Library `14.0.1`,
Test Renderer `1.2.0`, Expo Doctor, type-check and target smoke checks. Backend: Vitest `5.0.0`,
`@vitest/coverage-v8 5.0.0`, `@nestjs/testing 11.1.8`, Supertest `7.2.2`, unit, HTTP contract,
configuration-failure, and PostgreSQL integration checks

**Target Platform**: Expo Web in supported evergreen browsers; Android and iOS through Expo's SDK
57 supported targets; backend on Node.js 24.11.0 LTS for local Windows/macOS/Linux development; Docker
Desktop or a compatible Docker Engine with Compose v2

**Project Type**: Cross-platform frontend plus HTTP API in an npm-workspaces monorepo

**Performance Goals**: Complete clean local setup and startup in at most 30 minutes; verify backend
health within 10 seconds after startup; return a distinct unavailable database result within 15
seconds; keep the readiness database probe itself bounded to 5 seconds

**Constraints**: No business modules or UI; no authentication; no business database schema; no
host PostgreSQL requirement; no containerized frontend/backend; no secret or internal detail in
health/error output; environment-specific configuration must fail fast; production has no implicit
development defaults; all dependency resolutions are committed through one root lockfile

**Scale/Scope**: One repository, two application workspaces, one local PostgreSQL service, two
health endpoints, three target frontend platforms, configuration examples, root orchestration
commands, and foundation-only documentation

## Constitution Check

*GATE: Passed before Phase 0 research and passed again after Phase 1 design.*

| Principle / gate | Result | Evidence |
|------------------|--------|----------|
| I. Specification-driven development | PASS | The approved and clarified Feature 001 specification bounds this plan; implementation is not started. |
| II. Incremental and bounded delivery | PASS | Scope is limited to executable runtime, configuration, health, and local database foundations. |
| III. Player-centered product scope | PASS | No product capability or competing domain object is introduced. |
| IV. FEM separation | PASS | FEM code, contracts, formulas, and data are absent. |
| V. Evidence-based football information | PASS | No football metric or public football information is produced. |
| VI. Privacy and authorization | PASS | No identity or private data is introduced; diagnostics explicitly suppress secrets. |
| VII. Explicit architecture planning | PASS | Framework, package, configuration, persistence, and failure decisions are recorded in this plan and research. |
| VIII. Cross-platform consistency | PASS | One neutral Expo entry is verified on web, Android, and iOS without product UI. |
| IX. Quality and verification | PASS | Unit, contract, integration, failure, target smoke, and clean-checkout checks are planned. |
| X. Documentation authority | PASS | Constitution, specification, architecture, and planning decisions retain their assigned authority. |
| XI. Controlled change management | PASS | No approved scope or governance rule is silently changed. |
| XII. AI assistant behavior | PASS | Work remains in the planning phase; no tasks or application code are generated. |

Post-design re-check: the health contract, technical state model, and quickstart add no business
behavior and preserve all gates. No constitution exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/001-project-runtime-foundation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── health.openapi.yaml
└── tasks.md                       # Created later by $speckit-tasks, not by this plan
```

### Source Code (repository root)

```text
.
├── package.json                   # Private npm workspace and root command surface
├── package-lock.json              # Single committed dependency resolution
├── .nvmrc                         # Exact Node.js development version
├── .gitignore                     # Runtime env, dependency, build, and tool output exclusions
├── apps/
│   ├── frontend/
│   │   ├── app/
│   │   │   ├── _layout.tsx        # Minimal Expo Router shell
│   │   │   └── index.tsx          # Neutral startup confirmation only
│   │   ├── src/
│   │   │   └── config/            # Public frontend configuration validation
│   │   ├── tests/
│   │   │   └── setup.ts
│   │   ├── jest.config.cjs
│   │   ├── .env.example
│   │   ├── app.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── backend/
│       ├── prisma/
│       │   └── schema.prisma      # Generator and datasource; zero models
│       ├── src/
│       │   ├── config/            # Fail-fast environment validation
│       │   ├── database/          # One Prisma client and bounded connectivity probe
│       │   ├── health/            # Separate liveness and readiness capabilities
│       │   ├── app.module.ts
│       │   └── main.ts
│       ├── test/
│       │   ├── contract/
│       │   ├── integration/
│       │   └── setup.ts
│       ├── .env.example
│       ├── package.json
│       ├── prisma.config.ts
│       ├── tsconfig.json
│       └── vitest.config.ts
├── docker/
│   ├── compose.yaml               # PostgreSQL only
│   ├── .env.example               # Placeholder local database values
│   ├── validate-environment.mjs   # Cross-platform Compose preflight
│   └── validate-environment.test.mjs
├── tools/
│   ├── verify-toolchain.mjs       # Exact Node/npm preflight
│   └── verify-toolchain.test.mjs
└── docs/                          # Existing project documentation and design references, unchanged
```

**Structure Decision**: Use npm workspaces rooted at `apps/*` with `apps/frontend` and
`apps/backend` as the only application packages. Keep local infrastructure in the architecture-
approved `docker/` path. Do not add a shared package until a later feature establishes a real
cross-application contract; the health OpenAPI document remains a planning contract, not a runtime
package. Docker Compose manages PostgreSQL only, preserving independent host execution for both
applications.

## Planned Implementation Boundaries

### Root workspace and commands

- The root package is private and owns `workspaces: ["apps/*"]`, the exact npm package-manager
  declaration, and aggregate scripts for install verification, type-check, test, frontend target
  startup, backend startup, local database lifecycle, liveness, and readiness.
- Root metadata declares `engines.node: ">=24.11.0 <25"`, `packageManager: "npm@10.8.0"`, an exact
  npm `10.8.0` engine expectation, and
  error-level npm development-engine enforcement. A cross-platform Node preflight verifies actual
  `node --version` and `npm --version` before dependency preparation; `.npmrc` retains
  `engine-strict=true` for workspace dependency checks.
- Workspace scripts remain the implementation authority for application-specific actions. Root
  scripts delegate through npm workspaces or Docker Compose and do not introduce a custom CLI.
- Backend type checking uses TypeScript directly. Nest CLI `11.0.10` uses the standard TypeScript
  compiler for both production compilation and development watch, preserving emitted decorator
  metadata in both paths; compiled startup uses Node directly. Nest Schematics `11.0.9` and the
  compatible Angular DevKit 19 line are included; neither SWC nor Webpack is enabled. Its ESM
  `entryFile` is `main.js`, so Nest starts the emitted `dist/main.js` rather than relying on a
  CommonJS extension lookup.
- A single root lockfile is committed. Generated `node_modules`, Expo output, coverage, build output,
  and all real environment files are ignored.

### Test-runner and module boundaries

- The backend uses `apps/backend/vitest.config.ts` with a Node environment, explicit inclusion of
  unit, contract, and integration suites, and `apps/backend/test/setup.ts` only for deterministic
  shared hooks. The package and TypeScript configurations use ESM with `module` and
  `moduleResolution` set to `NodeNext`; relative TypeScript imports include the emitted `.js`
  extension where NodeNext requires it.
- The frontend uses `apps/frontend/jest.config.cjs` with the `jest-expo` preset and
  `apps/frontend/tests/setup.ts` for React Native Testing Library setup. Its test environment is the
  Expo-compatible Jest environment, with transforms and setup loaded before behavioral tests.
- Runner configuration is established before red tests are authored so failures demonstrate missing
  behavior rather than an unconfigured test harness.

### Configuration boundaries

- `apps/frontend/.env` is ignored. Its committed example contains only explicit placeholders. Only
  names prefixed `EXPO_PUBLIC_` may enter the frontend bundle, and they MUST be treated as public.
- `apps/backend/.env` is ignored. Startup validates `NODE_ENV`, `PORT`, `DATABASE_URL`, and
  `ALLOWED_ORIGINS` before listening. Placeholder sentinels, empty values, malformed URLs, invalid
  ports, and unrestricted origins are rejected. Errors name only the category or variable name.
- `docker/.env` is ignored. Compose requires PostgreSQL database, user, password, and host-port
  values from it. The committed example declares the non-secret local host port `5433`, which may
  be changed explicitly; PostgreSQL remains on `5432` inside the Compose network.
- Every database lifecycle command first runs a cross-platform Node.js preflight. It rejects a
  missing `docker/.env`; missing, empty, `__REQUIRED__`, or `CHANGE_ME` values for `POSTGRES_DB`,
  `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_HOST_PORT`; and a malformed or out-of-range
  `POSTGRES_HOST_PORT`. `db:up` cannot invoke Compose when this validation fails.
- No development value is silently promoted into a production-designated environment. Production
  startup requires every value explicitly, and wildcard origins are never inferred.

### Local PostgreSQL and Prisma

- Compose uses service `new-talents-postgres`, container name `new-talents-postgres`, image
  `postgres:18.6-bookworm`, and named volume `new-talents-postgres-data` mounted at
  `/var/lib/postgresql`, which is the PostgreSQL 18 image's version-aware data parent.
- The container healthcheck uses `pg_isready` only to sequence local infrastructure. Backend
  readiness performs its own authenticated, bounded `SELECT 1` and is the application-level proof
  of connectivity.
- Prisma 7 is configured inside the backend with `@prisma/adapter-pg`. The schema has a generator
  and PostgreSQL datasource but no `model`, enum, business migration, or seed. The foundation may
  generate the client and run a static safe raw query; it may not create database objects.
- The backend owns an explicit `prisma:generate` command. Backend build and start preparation invoke
  it before TypeScript consumes the generated client. Generation works after `npm ci` without a
  reachable database, migrations, tables, or usable local/production credentials; runtime database
  configuration remains exclusively validated at backend startup.
- Normal stop/start and `docker compose down` preserve the named volume. Destructive volume removal
  is not part of normal commands or validation.

### Health behavior

- `GET /health/live` checks only that the NestJS process can serve requests and returns HTTP 200
  with exactly `{ "status": "ok" }`, without calling PostgreSQL.
- `GET /health/ready` confirms validated startup configuration and executes the bounded PostgreSQL
  connectivity query with an internal five-second timeout. It returns HTTP 200 with exactly
  `{ "status": "ready" }`; unavailable, rejected, refused, timed-out, and unexpected probe failures
  are converted to HTTP 503 with exactly `{ "status": "unavailable" }`. No undocumented HTTP 500
  health response is exposed.
- Both responses are JSON, include `Cache-Control: no-store`, and expose no credentials, URLs,
  query text, stack traces, driver messages, dependency versions, host details, or business data.

## Verification Strategy

1. From a clean checkout, verify the exact Node/npm versions through the cross-platform preflight,
   including a controlled rejection outside the supported Node range, then run `npm ci` and
   generate the Prisma client with no database credentials or reachability.
2. Confirm missing, empty, malformed, placeholder, and production-inappropriate configuration stops
   the affected runtime with a nonzero outcome and redacted diagnostic.
3. Start PostgreSQL without host PostgreSQL, wait for container health, and verify backend readiness
   through the authenticated application query.
4. Prove persistence in an isolated test database by creating a uniquely named technical probe
   table and marker, stop/start the service, confirm the marker remains, and use a guaranteed
   `finally` cleanup to drop the probe table and verify its absence. The application and ordinary
   connectivity path never create it or any other database object; Prisma migrations, models, and
   seeds remain absent.
5. Verify liveness remains process-only while readiness changes to HTTP 503 when PostgreSQL is
   stopped, unreachable, rejects credentials, or exceeds the five-second probe timeout; separately
   verify a successful health response within 10 seconds after the backend reaches its running state.
6. Run frontend type, unit, and neutral-entry smoke checks for web, Android, and iOS. Confirm no
   product navigation, product screens, simulated capabilities, or secret-valued public variable.
7. Run backend unit, HTTP contract, configuration-failure, and PostgreSQL integration checks. Inspect
   health responses and logs for secret or internal-detail leakage.
8. Treat frontend and backend implementation as independent tracks after the root workspace exists;
   integrate them only in the combined verification phase.
9. Record one complete documented clean setup and aggregate foundation verification, covering
   dependencies, configuration, supported frontend targets, backend health, PostgreSQL startup,
   and database readiness. Verify Node inside and outside the supported range,
   frontend-before-backend, backend-before-frontend, and each runtime started independently.

## Complexity Tracking

No constitution violations or approved exceptions require tracking.
