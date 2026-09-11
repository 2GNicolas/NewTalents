# Phase 1 Quickstart: Project Runtime Foundation

## Purpose and timing

This is the validation procedure the implementation must make runnable. During the planning phase,
the commands below define the required command surface; they do not imply that application files or
scripts already exist.

## Prerequisites

- Git
- Node.js `24.11.0` with npm `10.8.0`
- Docker Desktop or Docker Engine with Docker Compose v2
- A supported web browser
- Android emulator/device and iOS simulator/device as applicable to the host platform

PostgreSQL MUST NOT be installed on the host.

## 1. Prepare a clean checkout

From the repository root:

```powershell
node --version
npm --version
docker version
docker compose version
node tools/verify-toolchain.mjs
npm ci
npm run prisma:generate
```

Expected versions are Node `v24.11.0` and npm `10.8.0`. `npm ci` must use the root lockfile and must
not require a global framework CLI; the backend uses the project-local Nest CLI. Prisma client generation must complete before backend build or
start without a reachable database, migrations, tables, or usable local/production credentials.

## 2. Prepare explicit local configuration

Copy each committed placeholder example to its ignored runtime location:

```powershell
Copy-Item docker/.env.example docker/.env
Copy-Item apps/backend/.env.example apps/backend/.env
Copy-Item apps/frontend/.env.example apps/frontend/.env
```

Replace every placeholder sentinel in the three ignored files. Use a local-only password. Ensure
the backend `DATABASE_URL` agrees with the Compose database name, user, password, host
`localhost`, and host port `5433` unless that host port is explicitly overridden.

The frontend file may contain only public `EXPO_PUBLIC_*` values. Never place credentials, tokens,
private keys, or private service URLs in it.

Confirm that no sentinel remains:

```powershell
$placeholderMatches = Select-String -Path docker/.env, apps/backend/.env, apps/frontend/.env -Pattern '__REQUIRED__|CHANGE_ME'
if ($placeholderMatches) { $placeholderMatches; throw 'Unresolved configuration placeholder' }
```

Expected result: no match. Confirm the runtime files are ignored:

```powershell
git check-ignore docker/.env apps/backend/.env apps/frontend/.env
```

Expected result: all three paths are reported.

## 3. Start and verify local PostgreSQL

Use the root command surface:

```powershell
npm run db:up
npm run db:status
```

Expected result: `new-talents-postgres` becomes healthy, its internal port is `5432`, and the local
host mapping is `5433` unless overridden. No host PostgreSQL service is needed.

`db:up` must first run the Node.js Compose preflight. A missing `docker/.env`; a missing, empty,
`__REQUIRED__`, or `CHANGE_ME` database name, user, password, or host port; or a malformed/out-of-
range host port must stop the command before Compose runs.

The infrastructure check uses `pg_isready`; application connectivity is verified separately below.

## 4. Start and verify the backend

In one terminal:

```powershell
npm run dev:backend
```

The backend development command uses project-local `nest start --watch`; production compilation uses
project-local `nest build` with the standard TypeScript compiler, and compiled startup uses Node
directly through `npm run start:prod --workspace=@new-talents/backend`. No global Nest CLI is required.

In another terminal:

```powershell
npm run health:live
npm run health:ready
```

Expected results:

- liveness: HTTP 200, `application/json`, `Cache-Control: no-store`, body `{"status":"ok"}`;
- readiness: HTTP 200, the same headers, body `{"status":"ready"}`;
- neither response nor backend logs contain environment values, credentials, database URLs, raw
  queries, stack traces, host details, or dependency versions.

Readiness must execute an authenticated, bounded `SELECT 1` through the backend's Prisma path. It
must use an internal five-second timeout and must not create or require any table. A successful
health response must be observable within 10 seconds after the backend reaches its running state.

## 5. Verify liveness/readiness separation

Stop only PostgreSQL while leaving the backend process running:

```powershell
npm run db:stop
npm run health:live
npm run health:ready
```

Expected result: liveness remains HTTP 200 while readiness becomes HTTP 503 with exactly
`{"status":"unavailable"}` within 15 seconds. Unavailable infrastructure, rejected credentials,
refused connections, timeouts, and unexpected probe errors all use this same closed 503 response;
no health HTTP 500 response is part of the contract. Restart the service:

```powershell
npm run db:start
npm run health:ready
```

Expected result: readiness returns to HTTP 200 after the database accepts connections.

## 6. Verify local persistence

Run the root persistence verification command:

```powershell
npm run db:verify-persistence
```

The command must use an isolated test database, create a uniquely named technical probe table and
marker, perform a normal PostgreSQL stop/start, confirm the marker survives, and use guaranteed
`finally` cleanup to drop the probe table and verify its absence even when verification fails. It must not
invoke Prisma migrations, `db push`, models, or seeds. Normal application startup, readiness, and
connectivity verification create no database object. Normal `db:stop`, `db:start`, and `db:down`
commands must retain `new-talents-postgres-data`.

## 7. Start and verify the neutral frontend

Web:

```powershell
npm run dev:frontend:web
```

Android and iOS, on supported host tooling:

```powershell
npm run dev:frontend:android
npm run dev:frontend:ios
```

Each target must show only the neutral startup confirmation. It must not show product navigation,
authentication, profiles, passports, statistics, videos, or simulated product functionality.

## 8. Run automated foundation checks

```powershell
npm run typecheck
npm test
npm run verify:config
npm run verify:foundation
```

The aggregate verification must cover:

- valid and invalid frontend public configuration;
- missing, empty, malformed, placeholder, and production-inappropriate backend configuration;
- exact liveness and readiness HTTP contracts;
- reachable, unavailable, rejected-credential, and timed-out database readiness;
- absence of Prisma models, migrations, seeds, and business tables;
- neutral frontend behavior on each supported target under test;
- absence of usable secrets in committed examples and of real environment files in tracking.

## 9. Clean-environment acceptance and interrupted-install recovery

Execute Sections 1 through 8 once from a fresh checkout or an equivalent clean setup with no
dependency directory, generated output, or running project containers. Record the pass/fail result
for dependency installation, configuration validation, frontend startup, backend startup,
liveness, readiness, local database startup, and persistence. The documented preparation and
startup path must fit within 30 minutes and require no undocumented assistance.

The acceptance evidence also confirms that the selected Node version is accepted, a version outside
the declared range is rejected before preparation, the frontend can start before the backend, the
backend can start before the frontend, and each runtime can start independently. These are cases in
the documented procedure, not a requirement for a second clean installation.

If a Windows package installation is interrupted and leaves a filesystem-locked partial dependency
tree, first confirm that no New Talents development server or validation process is running. Then
remove only the repository-root `node_modules` directory, preserving `package.json`,
`package-lock.json`, workspace source files, and the PostgreSQL named volume; rerun `npm ci` from
the repository root. This is operational recovery guidance, not an acceptance test; a clean
checkout or equivalent repository with no `node_modules` remains reproducibly preparable through
`npm ci`.

## Expected failure checks

Each case must fail with a nonzero command outcome and a secret-free actionable message:

| Case | Expected classification |
|------|-------------------------|
| Missing or placeholder frontend API URL | Frontend configuration invalid; no ready UI |
| Missing, empty, malformed, or placeholder backend variable | Backend configuration invalid; no listener |
| Production environment with an omitted value or wildcard origin | Backend configuration invalid |
| Missing, empty, placeholder, malformed, or out-of-range Compose setting | Local database startup blocked by preflight before Compose |
| Wrong PostgreSQL credentials | Backend readiness unavailable; liveness remains ok |
| PostgreSQL stopped or unreachable | Infrastructure unavailable; readiness HTTP 503 |
| PostgreSQL query exceeds five seconds | Readiness timeout; HTTP 503 within fifteen seconds |
| Frontend before backend, backend before frontend, or either alone | Each reports its own independent state accurately |
| Interrupted dependency preparation | Follow the documented Windows recovery guidance before retrying preparation |
| Node inside or outside the supported range | Supported version proceeds; unsupported version fails before preparation |

No failure output may echo a supplied secret or connection string.

## Cleanup without data loss

```powershell
npm run db:down
```

This stops and removes the local container/network while retaining the named volume. Destructive
volume removal is outside the normal validation workflow and must not be hidden behind a routine
root command.
