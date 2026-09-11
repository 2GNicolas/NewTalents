# Phase 1 Data Model: Project Runtime Foundation

## Scope statement

Feature 001 introduces no product or business data model. There are no persisted domain entities,
Prisma models, business enums, relations, application tables, migrations, or seeds. The structures
below are technical configuration shapes, response contracts, and runtime state transitions only.

## Technical configuration shapes

### FrontendPublicConfiguration

Non-persisted values compiled into or delivered with the frontend client.

| Field | Type | Required | Validation | Sensitivity |
|-------|------|----------|------------|-------------|
| `EXPO_PUBLIC_API_BASE_URL` | absolute URL string | Yes | HTTP or HTTPS; non-empty; not a placeholder sentinel | Public by definition; MUST NOT contain credentials or tokens |

Rules:

- The application cannot enter `Frontend ready` until validation succeeds.
- Every frontend variable must be safe for disclosure in a browser or compiled mobile bundle.
- Unknown secret-looking frontend values fail review even if runtime validation accepts their shape.

### BackendRuntimeConfiguration

Non-persisted server process configuration loaded from the runtime environment.

| Field | Type | Required | Validation | Sensitivity |
|-------|------|----------|------------|-------------|
| `NODE_ENV` | enum | Yes | `development`, `test`, or `production`; no implicit production fallback | Non-secret |
| `PORT` | integer | Yes | Valid TCP port; non-empty; not a placeholder | Non-secret |
| `DATABASE_URL` | PostgreSQL URL | Yes | `postgresql:` or `postgres:` scheme; credentials and database present; not a placeholder | Secret |
| `ALLOWED_ORIGINS` | comma-delimited absolute origins | Yes | Parsed list; no implicit `*`; production values explicit | Potentially internal; do not echo in diagnostics |

Rules:

- All fields validate before the backend listens.
- A diagnostic identifies only the invalid field/category and rule, never the supplied value.
- `production` accepts no development-only default.
- The parsed object is immutable after bootstrap.

### LocalPostgresConfiguration

Non-persisted Compose interpolation values from an ignored local environment file.

| Field | Type | Required | Validation | Sensitivity |
|-------|------|----------|------------|-------------|
| `POSTGRES_DB` | identifier string | Yes | Non-empty; not placeholder | Local configuration |
| `POSTGRES_USER` | identifier string | Yes | Non-empty; not placeholder | Sensitive local configuration |
| `POSTGRES_PASSWORD` | string | Yes | Non-empty; not placeholder | Secret |
| `POSTGRES_HOST_PORT` | integer | Yes | Valid TCP port; example local value `5433`; no implicit missing value | Non-secret |

Rules:

- Container port remains `5432`.
- The backend `DATABASE_URL` must refer to the same database and credentials when run on the host.
- The committed example contains sentinel placeholders, never working credentials.
- A cross-platform Node.js preflight reads `docker/.env` before any Compose lifecycle action.
- All four fields reject missing, empty, `__REQUIRED__`, and `CHANGE_ME` values.
  `POSTGRES_HOST_PORT` additionally rejects non-integers and values outside the valid TCP port
  range. Validation failure exits nonzero and prevents Compose from starting.

## Runtime response shapes

### LivenessResponse

| Field | Type | Allowed value |
|-------|------|---------------|
| `status` | string | `ok` |

Fixed HTTP behavior: status 200, JSON content type, `Cache-Control: no-store`. No additional fields.

### ReadinessResponse

| Field | Type | Allowed values |
|-------|------|----------------|
| `status` | string | `ready`, `unavailable` |

Fixed HTTP behavior: status 200 for `ready`, status 503 for `unavailable`, JSON content type,
`Cache-Control: no-store`. The authenticated query has an internal five-second timeout, and
unavailable, rejected, refused, timed-out, or unexpected probe failures all become the same closed
503 response. No additional fields and no HTTP 500 health response are defined.

## Operational states and transitions

### Frontend runtime

```text
Not started
    └── load public configuration
          ├── valid ──> Frontend ready
          └── invalid ──> Configuration invalid (startup blocked)
```

`Frontend ready` means only that the neutral runtime entry is usable. It conveys no product
readiness.

### Backend runtime

```text
Not started
    └── validate server configuration
          ├── invalid ──> Configuration invalid (listener not opened)
          └── valid ──> Backend serving
                         ├── GET /health/live ──> Liveness ok
                         └── bounded SELECT 1
                               ├── succeeds ──> Backend ready
                               └── fails/times out ──> Backend unavailable
```

Liveness does not transition based on PostgreSQL. Readiness does.

### Local PostgreSQL service

```text
Absent/stopped
    └── Compose up
          ├── invalid/missing env ──> Startup failed
          └── container starts ──> Starting
                                  ├── pg_isready succeeds ──> Container healthy
                                  └── retry budget exhausted ──> Container unhealthy

Container healthy
    ├── normal stop ──> Stopped; named volume retained
    ├── normal restart ──> Starting; named volume reused
    └── backend SELECT 1 succeeds ──> Local database ready
```

Container health is not equivalent to backend readiness: `pg_isready` can succeed without proving
that the backend's credentials and query path work.

## Storage artifact

The only persistent artifact created by the planned foundation is the Docker-managed PostgreSQL
data directory in named volume `new-talents-postgres-data`. Its contents are PostgreSQL system
catalogs and incidental local verification data, not a New Talents domain schema.

The planned Prisma schema contains:

- a client generator with an explicit generated-client output;
- a PostgreSQL datasource;
- zero models;
- zero business enums;
- zero relations.

Prisma client generation may occur. `prisma migrate dev`, `prisma db push`, migrations, and seeds are
not part of Feature 001.

## Validation-only persistence proof

To verify named-volume persistence, the verification uses an isolated test database and direct
PostgreSQL commands to create a uniquely named technical probe table containing one unique marker,
perform a normal stop/start, and confirm the marker remains. A guaranteed `finally` cleanup block drops the
probe table even after a failed assertion and then verifies that the table is absent. The probe:

- is not a Prisma model or migration;
- contains no user, player, tutor, academy, passport, match, statistic, FEM, video, payment, or
  notification data;
- is never required by application startup or readiness;
- is removed after the persistence check;
- is never created by normal application startup, readiness, or connectivity verification.

## Explicitly absent domain model

Feature 001 defines none of the following: users, roles, permissions, tokens, players, tutors,
academies, passports, matches, statistics, FEM events, videos, payments, notifications, or any
relation among them. Later bounded feature specifications own those decisions.
