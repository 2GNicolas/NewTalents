# Implementation Plan: Identity, Roles, and Authorization

**Branch**: `feature/002-identity-roles-authorization` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

## Summary

Add the smallest backend-only identity and authorization foundation: identities, historical role
assignments, a minimal academy boundary, single-active academy memberships, controlled privileged
changes, and a framework-independent authorization evaluator. It receives only explicit context
from callers and returns safe allow/deny outcomes. No login, HTTP interface, frontend, or future
product workflow is introduced.

## Technical Context

**Language/Version**: Node.js `24.11.0`, npm `10.8.0`, TypeScript `5.9.3`

**Primary Dependencies**: NestJS `11.1.8`, Nest CLI `11.0.10`, Prisma `7.10.0`, PostgreSQL driver
`pg 8.23.0`, Zod `4.6.1`, Vitest `5.0.0`

**Storage**: PostgreSQL `18.6`, Prisma schema and migrations; static version-controlled permission
catalog, never persisted user-specific permission grants

**Testing**: Unit policy/domain tests and real PostgreSQL integration tests for constraints,
transactions, rollback, and concurrency

**Target Platform**: Existing host-run NestJS backend and Docker Compose PostgreSQL baseline

**Project Type**: Backend domain and application foundation in the npm-workspaces monorepo

**Constraints**: Deny by default; preserve Feature 001 toolchain; no credentials, sessions, tokens,
headers, HTTP endpoints, guards, decorators, frontend authorization, generic ACL engine, or future
business models

## Constitution Check

| Gate | Result | Evidence |
|---|---|---|
| Bounded delivery | PASS | Scope is only identity, authorization, membership, and traceability. |
| Player/FEM scope | PASS | No player, passport, football data, or FEM behavior is planned. |
| Privacy and authorization | PASS | Backend enforcement, least privilege, safe denial, and minor boundaries are explicit. |
| Explicit architecture | PASS | Integrity, concurrency, contract, persistence, and module decisions are documented. |
| Quality | PASS | Unit, integration, rollback, concurrency, and disclosure checks are planned. |
| Documentation and change control | PASS | The approved spec governs scope; plan decisions remain traceable. |

Post-design re-check: PASS. No constitution exception is required.

## Project Structure

```text
specs/002-identity-roles-authorization/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/authorization-evaluation.md

apps/backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/                 # Feature 002 migrations only
├── src/
│   ├── identity/
│   ├── academy-membership/
│   ├── authorization/
│   └── privileged-changes/
└── test/
    ├── unit/
    └── integration/
```

**Structure Decision**: Add bounded backend modules only. The evaluator exposes an internal
application contract, not a controller or HTTP contract. Future resource-owning modules supply
relationship facts rather than import these persistence structures.

## Design Decisions

- Persist unique identities, role assignments, minimal academies, academy memberships, and immutable
  authorization-change records. Do not use a single role field because multiple roles are approved.
- Enforce at most one active Academy User membership with a PostgreSQL partial unique index created
  through reviewed Prisma migration SQL. Keep historical memberships.
- Run role and membership changes in short Prisma interactive transactions at Serializable isolation;
  retry only `P2034` serialization conflicts: one initial attempt plus at most two retries (three
  attempts total), with deterministic no-jitter delays of 50 ms and 100 ms. Exhaustion returns a
  controlled conflict; validation, unique, foreign-key, not-found, unsupported, and unknown errors
  never retry. An audit failure aborts the change.
- Use a static, version-controlled permission catalog. A role contributes only an action-relevant
  permission and never bypasses identity status, membership, relationship, or sensitivity checks.
- Record applied and denied privileged changes with opaque actor/target identifiers, category,
  timestamp, prior/resulting state, outcome, and policy version. Denied records add security value
  without recording sensitive payloads.
- Defer first-Administrator bootstrap to Feature 003 or an approved controlled procedure. No normal
  operation may self-promote or work without an active Administrator; tests use controlled fixtures.

## Planned Implementation Sequence

1. Persistence model and reviewed migrations.
2. Identity lifecycle and role-assignment domain behavior.
3. Academy-membership integrity, atomic transitions, and history.
4. Static permission catalog and internal authorization evaluation.
5. Administrator-only privileged changes with traceability.
6. Module integration, documentation, and final verification.

Each block is independently reviewable. This plan creates no tasks and authorizes no implementation.
