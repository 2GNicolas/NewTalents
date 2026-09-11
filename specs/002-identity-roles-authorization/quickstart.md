# Quickstart: Identity, Roles, and Authorization Validation

## Prerequisites

Use the completed Feature 001 local environment: Node `24.11.0`, npm `10.8.0`, Docker Compose
PostgreSQL, completed local environment files, and the root lockfile.

```powershell
npm ci
npm run db:up
npm run prisma:generate
```

## Planned validation

After implementation, run backend type checks and feature unit/integration suites through existing
workspace commands. Prove that active applicable roles allow only catalogued actions; incomplete,
inactive, anonymous, unsupported, cross-academy, and unrelated-tutor contexts deny safely; and
historical roles/memberships grant no access.

Real PostgreSQL tests use two independent clients for overlapping membership changes. Expected:
exactly one active membership, preserved history, complete trace for a committed change, and no
effective change after denial, audit failure, rollback, or exhausted serialization retry.
Membership transition retry verification permits one initial attempt and two `P2034` retries only
(three total attempts), with no-jitter waits of 50 ms and 100 ms; exhaustion is a controlled
conflict and all other failures do not retry.

No HTTP endpoint, login flow, frontend screen, token, session, player, passport, or academy-player
workflow is required.

## Cleanup

Use existing normal database lifecycle commands. Do not remove the persistent volume for validation.
