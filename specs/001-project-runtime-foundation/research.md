# Phase 0 Research: Project Runtime Foundation

## Decision Summary

| Area | Decision | Pinning policy |
|------|----------|----------------|
| Runtime | Node.js 24.11.0 LTS | Exact in `.nvmrc`; engines `>=24.11.0 <25`; executable preflight |
| Package manager | npm 10.8.0 shared with TocoYVoy | Exact `packageManager` and npm engine; one root lockfile |
| Language | TypeScript 6.0.3 | `~6.0.3` in both workspaces |
| Frontend | Expo `~57.0.21` / React Native `0.86.3` / React `19.2.3` / Expo Router `~57.0.20` / React Native Web `~0.21.0` | Expo-compatible ranges plus exact lockfile |
| Backend | NestJS runtime/testing `11.1.8` / CLI `11.0.10` / Schematics `11.0.9` / Config `12.0.0` / Zod `4.6.1` | TocoYVoy-proven TypeScript compilation strategy and exact lockfile |
| Database access | Prisma 7.10.0 with PostgreSQL adapter and pg 8.23.0 | Exact aligned Prisma packages |
| Local database | PostgreSQL 18.6 Bookworm image | Exact image tag, never `latest` |
| Backend tests | Vitest `5.0.0` / coverage-v8 `5.0.0` / Nest testing `12.0.1` / Supertest `7.2.2` | Exact dev dependencies |
| Frontend tests | Jest `29.7.0` / jest-expo `~57.0.5` / React Native Testing Library `14.0.1` / Test Renderer `1.2.0` | Expo- and React-compatible pins plus lockfile |

## 1. Runtime and workspace

### Decision

Use Node.js `24.11.0` LTS and npm `10.8.0`, matching the currently installed TocoYVoy development
environment. This shared runtime pair prevents unnecessary machine-level divergence between
TocoYVoy and New Talents. The repository is a private npm workspace with packages under `apps/*`,
one root `package-lock.json`, and no globally required project CLI. Use frontend TypeScript `~6.0.3`
and backend TypeScript `5.9.3`
consistently across frontend and backend.

Declare `packageManager: "npm@10.8.0"`, `engines.node: ">=24.11.0 <25"`, an exact npm `10.8.0`
engine, and
error-level npm development-engine enforcement. Before dependency preparation, a cross-platform
Node script checks the actual Node and npm versions and exits nonzero when either is incompatible;
`.npmrc` with `engine-strict=true` remains the dependency-level safeguard.

### Rationale

Node 24.11.0 satisfies the published runtime ranges of React Native 0.86.3, NestJS 11, Nest CLI 11,
Vitest 5, Prisma 7, React Native Testing Library 14, Jest 29, and TypeScript 5.9.3/6. npm 10.8.0 supports Node
24.11.0 and is the confirmed shared package-manager version. A root workspace gives contributors one
deterministic install and one orchestration surface while preserving independent frontend and
backend runtimes. TypeScript 6 matches current Expo templates and Nest 12 tooling without adopting
TypeScript 7's changed compiler tooling model.

### Alternatives considered

- Node 26 Current: rejected because the foundation should target LTS, not the short-lived Current
  line.
- Node 22 LTS: compatible, but rejected because it would diverge from the confirmed shared Node.js
  24.11.0 development environment.
- Newer npm releases: compatible options exist, but rejected because they would introduce
  unnecessary machine-level divergence from the confirmed TocoYVoy development environment.
- pnpm, Yarn, Nx, or Turborepo: rejected because npm workspaces satisfy the current two-package scope
  with less tooling and no custom orchestration layer.
- TypeScript 7: rejected for this baseline because the selected framework templates and ecosystem
  tooling are aligned with TypeScript 6.

## 2. Expo cross-platform frontend

### Decision

Use Expo `~57.0.21`, React Native `0.86.3`, React and React DOM `19.2.3`, Expo Router
`~57.0.20`, and React Native Web `~0.21.0`. Use TypeScript `~6.0.3`, `@types/react ~19.2.2`, Jest
`29.7.0`, `@types/jest 29.5.14`, `jest-expo ~57.0.5`, React Native Testing Library `14.0.1`, and
Test Renderer `1.2.0`.
Manage Expo-owned dependency versions
through `expo install` and commit their exact lockfile resolution. The router contains only a minimal
layout and neutral startup route.

Frontend runtime configuration is limited to explicitly public `EXPO_PUBLIC_*` values, initially an
API base URL used only to prove configuration. Validation rejects absence, emptiness, the documented
placeholder sentinel, and non-HTTP(S) URLs before the UI reports ready. No secret may use the public
prefix because Expo substitutes these values into the client bundle.

### Rationale

Expo SDK versions define compatible React and React Native pairs; following that matrix is safer
than selecting each package's independent latest release. Expo Router supplies one consistent file-
based entry across web, Android, and iOS without requiring product navigation. The public-variable
boundary makes the client-side exposure model explicit.

### Alternatives considered

- Standalone React Native 0.87: rejected because Expo 57 is aligned to React Native 0.86.
- Bare React Native projects: rejected because they duplicate native setup before a feature needs
  native customization.
- Custom navigation or product shell: rejected as out of scope; the router is used only for the
  neutral entry.
- Secrets in frontend environment variables: rejected because shipped clients cannot keep bundled
  values secret.

## 3. NestJS backend and configuration

### Decision

Use NestJS `11.1.8` with aligned `@nestjs/common`, `@nestjs/core`,
`@nestjs/platform-express`, and `@nestjs/testing`; use `@nestjs/config 12.0.0` and Zod `4.6.1` for
startup validation. Pin Nest CLI to `11.0.10`, Nest Schematics to `11.0.9`, TypeScript to `5.9.3`,
and `ts-node` to `10.9.2`; retain `reflect-metadata` `0.2.2`, RxJS `7.8.2`,
`@types/node` to `24.13.4`, `@types/pg` to `8.23.1`, and
`@types/supertest` to `7.2.1`. Build the backend as an ESM TypeScript package. Validate `NODE_ENV`, `PORT`,
`DATABASE_URL`, and `ALLOWED_ORIGINS` before the HTTP listener starts.

Diagnostics identify only the configuration field/category and validation rule. They never echo the
provided value, parsed URL, credentials, or driver error. `NODE_ENV=production` disables all local
defaults and requires an explicit non-wildcard origin policy.

### Rationale

Nest 12 is the current stable framework major and is aligned with ESM-oriented new projects. Zod
provides one declarative startup schema and deterministic errors. Fail-fast validation prevents a
partially ready runtime and centralizes redaction.

Backend type checking uses TypeScript directly; Nest CLI `11.0.10` compiles production and runs
development watch through the standard TypeScript compiler, and compiled startup uses Node. Nest
Schematics `11.0.9` resolves the compatible Angular DevKit 19 line, whose Node and npm engines
accept Node `24.11.0` and npm `10.8.0`; no Angular DevKit 22 package is admitted. The final
toolchain follows the Nest CLI 11 TypeScript compilation strategy verified in TocoYVoy. Because
New Talents is ESM, its Nest CLI `entryFile` is `main.js` so `nest start` invokes the emitted
`dist/main.js` path explicitly.

### Alternatives considered

- Delayed validation in individual modules: rejected because it can let the process advertise
  readiness with incomplete configuration.
- Joi: viable, but Zod is chosen for current Nest standard-schema direction and direct TypeScript
  inference.
- Wildcard CORS in development: rejected because the specification requires an explicit allow
  decision for every environment.

## 4. Prisma without a business schema

### Decision

Pin `prisma`, `@prisma/client`, and `@prisma/adapter-pg` to `7.10.0` and `pg` to `8.23.0`. Keep
`prisma/schema.prisma` limited to generator and PostgreSQL datasource declarations. Keep connection
configuration in `prisma.config.ts` and runtime environment variables. Create exactly one
application-scoped Prisma client and adapter, close it during application shutdown, and perform a
tagged static `SELECT 1` for readiness with a five-second upper bound.

No `model`, business enum, migration, seed, fixture, or persistent health table is permitted. Client
generation is a tooling artifact, not a schema migration.

Expose an explicit backend `prisma:generate` command and invoke it before backend build/start. The
generation path must work immediately after `npm ci` without loading usable runtime credentials or
contacting PostgreSQL; it performs no migration, `db push`, table creation, or seed. Only backend
runtime startup consumes the validated `DATABASE_URL` for the adapter.

### Rationale

Prisma 7.10 is the latest stable non-RC line found during planning, supports PostgreSQL 18, requires
the PostgreSQL driver adapter for direct connections, and can issue a safe raw connectivity query
without domain models. Aligning CLI, client, and adapter versions avoids generated-client drift.

### Alternatives considered

- Prisma 8 release candidates: rejected because preview/RC dependencies are prohibited for this
  foundation.
- Creating a health table: rejected because connectivity can be proven without a business or
  operational schema object.
- `$queryRawUnsafe`: rejected because no dynamic SQL is needed.
- Driver-only database access: viable for a single probe, but rejected because the approved
  architecture calls for Prisma preparation for future bounded migrations.

## 5. Local PostgreSQL with Docker Compose

### Decision

Use `postgres:18.6-bookworm` with Compose v2. Name the service `new-talents-postgres`, container
`new-talents-postgres`, and volume `new-talents-postgres-data`. Mount the volume at
`/var/lib/postgresql`, expose container port `5432` as the required explicit host port
`${POSTGRES_HOST_PORT}`, and
use `pg_isready` for container health and Compose sequencing.

Required database name, user, and password come from an ignored
`docker/.env`; the committed example uses non-secret placeholder sentinels. A cross-platform Node
preflight runs before Compose and rejects a missing file; missing, empty, `__REQUIRED__`, or
`CHANGE_ME` values for all four settings; and a malformed or out-of-range `POSTGRES_HOST_PORT`.
The example supplies the non-secret local port `5433`. Normal
start, stop, restart, and `down` preserve the named volume. No normal root command includes
`down --volumes` or an equivalent destructive action.

### Rationale

An exact Debian-based image avoids floating-major and Alpine/musl variability. PostgreSQL 18's
official image uses `/var/lib/postgresql` as the parent for version-specific storage, allowing
upgrade-safe layout. A named volume persists independently of the container and meets the clean
restart requirement without requiring host PostgreSQL.

`pg_isready` reports server acceptance state but does not authenticate or run a real query, so it is
used only for infrastructure health. Backend readiness remains the authoritative connection check.

### Alternatives considered

- `postgres:latest` or `postgres:18`: rejected because rebuilds could change the runtime version.
- Alpine image: rejected because its smaller size does not outweigh native-library and debugging
  differences for a development foundation.
- Host PostgreSQL: rejected by the feature requirement.
- Bind-mounted data directory: rejected because host path ownership and platform behavior reduce
  portability.
- Dockerizing frontend and backend: rejected by scope and because independent host development is
  required.

## 6. Liveness and readiness contract

### Decision

Expose two unauthenticated, minimal endpoints:

- `GET /health/live`: process-serving check only; HTTP 200 and `{"status":"ok"}`.
- `GET /health/ready`: validated configuration plus a bounded authenticated PostgreSQL `SELECT 1`;
  HTTP 200 and `{"status":"ready"}`, or HTTP 503 and `{"status":"unavailable"}`.

The readiness query has an internal five-second timeout. Unavailable infrastructure, rejected
credentials, refused connections, timeouts, and unexpected probe errors all map to the same fixed
503 response. The public contract intentionally defines no health HTTP 500 response. Liveness never
calls PostgreSQL.

Both use `application/json`, `Cache-Control: no-store`, and fixed response bodies. Errors may be
logged only as sanitized categories. They never expose database URLs, credentials, raw queries,
stack traces, host names, ports, dependency versions, or business information.

### Rationale

Separating liveness from readiness prevents a database outage from causing a false process-dead
signal while also preventing the backend from claiming full readiness. Fixed, low-information
responses are sufficient for local verification and reduce accidental disclosure.

### Alternatives considered

- One combined endpoint: rejected because it conflates process health with dependency readiness.
- Detailed diagnostics in the response: rejected by the specification's secrecy boundary.
- Checking only `pg_isready`: rejected because it does not prove the application's credentials or
  query path.

## 7. Test and documentation strategy

### Decision

Use the framework-aligned test runner in each workspace: Jest with `jest-expo` and React Native
Testing Library for Expo, and Vitest with Nest testing utilities and Supertest for the ESM backend.
Root npm scripts aggregate type checks and tests while preserving independent workspace commands.

The backend runner is configured in `apps/backend/vitest.config.ts` for a Node environment, with an
optional deterministic `apps/backend/test/setup.ts`; the TypeScript/package configuration uses
NodeNext ESM semantics, and relative imports use emitted `.js` extensions where required. The
frontend runner is configured in `apps/frontend/jest.config.cjs` with the `jest-expo` preset and
`apps/frontend/tests/setup.ts` for React Native Testing Library. Runner setup precedes behavioral
tests so initial failures indicate missing behavior rather than missing transforms or environments.

Verification layers are:

1. unit checks for configuration schemas and health services;
2. HTTP contract tests for exact status, body, content type, and cache header;
3. integration checks against the Compose PostgreSQL service, including rejection and timeout;
4. frontend neutral-entry smoke checks on web, Android, and iOS;
5. one documented clean-checkout quickstart and aggregate foundation verification;
6. persistence proof in an isolated test database using a unique technical probe table and marker,
   guaranteed `finally` cleanup that drops the table and verifies absence, and never a migration or seed;
7. automated inspection for tracked real environment files, usable credentials, and leaked health
   or log values.

After the root workspace and runner configuration exist, frontend and backend work are independent
tracks. Neither waits for the other's implementation phases; the combined foundation verification
is the first point that requires both. The documented clean-environment verification covers accepted
and rejected Node versions, frontend-before-backend, backend-before-frontend, and each runtime
started on its own. Recovery from an interrupted package installation is operational guidance, not
an acceptance-validation scenario.

The persistence probe is test-owned only. It uses an isolated test database, creates a uniquely
named technical probe table and marker, performs normal Compose stop/start, verifies retention, and
drops the table in guaranteed `finally` cleanup before confirming absence. Normal application startup,
readiness, and connectivity verification create no database objects.

### Rationale

Runner alignment avoids adapters that are out of step with the framework majors. Layered checks map
directly to the specification's independent scenarios and measurable outcomes without inventing
product behavior.

## Official sources consulted

- Node.js release status and LTS lines: https://nodejs.org/en/about/previous-releases
- Node.js 24.11.0 release: https://nodejs.org/en/blog/release/v24.11.0
- npm CLI package metadata: https://github.com/npm/cli/blob/latest/package.json
- Expo SDK 57 release: https://expo.dev/changelog/sdk-57
- Expo SDK reference: https://docs.expo.dev/versions/latest/
- Expo Router installation: https://docs.expo.dev/router/installation/
- Expo environment variables: https://docs.expo.dev/guides/environment-variables/
- Expo unit testing with Jest: https://docs.expo.dev/develop/unit-testing/
- React Native Testing Library setup: https://callstack.github.io/react-native-testing-library/docs/start/quick-start
- NestJS migration guide: https://docs.nestjs.com/migration-guide
- NestJS configuration: https://docs.nestjs.com/techniques/configuration
- Prisma system requirements: https://docs.prisma.io/docs/orm/reference/system-requirements
- Prisma supported databases: https://docs.prisma.io/docs/orm/reference/supported-databases
- Prisma connection management: https://docs.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections
- Prisma raw queries: https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries
- npm package metadata used for exact stable dependency versions: https://registry.npmjs.org/
- PostgreSQL supported versions: https://www.postgresql.org/support/versioning/
- PostgreSQL `pg_isready`: https://www.postgresql.org/docs/current/app-pg-isready.html
- Official PostgreSQL container image: https://hub.docker.com/_/postgres
- Docker volumes: https://docs.docker.com/engine/storage/volumes/
- Docker Compose startup order: https://docs.docker.com/compose/how-tos/startup-order/
- Kubernetes probe semantics: https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/

All planning unknowns and open decision markers are resolved.
