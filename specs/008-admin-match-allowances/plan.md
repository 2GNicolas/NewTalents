# Implementation Plan: Configuración administrativa de cupos de partidos

**Branch**: `feature/008-admin-match-allowances` | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature 008 specification and [requirements checklist](checklists/requirements.md). This plan creates design artifacts only; implementation awaits product acceptance of the draft specification.

## Summary

Add an authorized all-passport Administrator card collection and an allowance section within the existing Administrator passport detail. One active passport may have one match-allowance aggregate. Its initial activation day is computed by the server in `America/Bogota`; an Administrator confirms a monthly, quarterly, semiannual, or annual cadence and a positive integer limit. Confirmed updates become effective at the next old-period boundary, retain an immutable initial date and append-only change history, and reject stale versions. The feature stores no matches, usage, payments, or sports metrics.

## Technical Context

**Language/Version**: Node.js 24, TypeScript 5.9 backend / TypeScript 6 frontend

**Primary Dependencies**: NestJS 11, Prisma 7, Zod 4; Expo 57, Expo Router 57, React 19, React Native 0.86

**Storage**: Existing PostgreSQL 18 via additive Prisma migration

**Testing**: Vitest backend unit/contract/integration; Jest frontend state/components; sequential PostgreSQL invariant/concurrency checks; authenticated desktop/mobile browser checks

**Target Platform**: Existing backend API and Expo web/mobile Administrator app

**Project Type**: Monorepo API plus cross-platform frontend

**Performance Goals**: Bounded, cursor-paginated all-passport list and revision history; no unbounded decrypt/search, batch write, or period materialization

**Constraints**: Existing privacy and authorization boundaries; closed/no-store API; dates are Colombia-local calendar dates, not UTC instants; no fabricated usage; existing detail/custody behavior unchanged
**Scale/Scope**: One aggregate per passport, four cadences, one Administrator collection/detail extension, one add-on API and its focused verification

## Constitution Check

**Before research — PASS for planning.** Feature 008 has a bounded specification and checklist; it does not alter Feature 007 lifecycle/custody authority or introduce Analyst/FEM work. The screen references govern visual composition, not invented usage or scheduling. Privacy, server-side authorization, additive persistence, explicit contracts, test-first implementation and web/mobile accessibility are carried into this plan. The specification remains Draft pending product approval; that is an implementation gate, not permission to expand scope here.

**After design — PASS.** [research.md](research.md) records decisions and alternatives; [data-model.md](data-model.md) specifies the additive aggregate and period arithmetic; [OpenAPI contract](contracts/admin-passport-allowances.openapi.yaml) and [UI contract](contracts/administrator-allowance-ui.md) close the API and interaction boundaries; [quickstart.md](quickstart.md) defines focused verification. A command based on a stale version is always rejected; the Administrator must read the latest version before confirming a new change. No unconditional last-confirmation-wins rule applies.

## Design and implementation sequence

1. **Persistence/domain**: Add a nullable-by-absence, unique-per-passport allowance aggregate and append-only revisions with restrictive foreign keys, positive integer and version/sequence invariants. Use an additive migration only. Implement pure Colombia date/anniversary calculations with an immutable activation anchor and segment anchors for cadence changes; expose a typed read port for later scheduling without implementing its consumer.
2. **Backend authorization and queries**: Add explicit Administrator capabilities and re-evaluate active identity/role. Build a separate all-passport cursor read model; do not widen `/passports`, the custody list, or Analyst access. Compose a safe passport detail with the existing sections, including absent/nonactive states. Restrict allowance and history projections to authorized Administrators and approved minimum fields.
3. **Backend command/API**: Validate closed cadence/positive integer inputs and a preview-only activation date. Confirm creation/update in a serializable transaction that locks the existing passport, checks active state, authority, expected version and idempotency key, computes the server date/effective boundary, then atomically appends one revision. Reject stale versions without mutation and require a fresh read before a new confirmation, including changes targeting the same future boundary. Bound serialization retries; use safe missing/denied equivalence, conflicts and `no-store` responses. Do not rewrite earlier revisions or current-period rules.
4. **Frontend**: Add Pasaportes between Expedientes and Custodia in the existing shell. Add one all-passport card route and integrate an allowance section into the existing Administrator passport detail/navigation, retaining profile, linked records, custody and history. Show the server-owned activation date read-only, current period and pending next-period change, explicit confirmation/discard, accessible errors/conflicts/empty states, and last modification. Reproduce the approved desktop/mobile composition without mock photos, utilization, available counts, progress bar or scheduling claims.
5. **Focused verification**: Test DTO/contract privacy and validation; PostgreSQL uniqueness, rollback, idempotency, stale-version and two-Administrator races; pure date boundary matrices (29–31, leap years, cadence switches, Colombia midnight); frontend state/keyboard/touch/confirmation; authenticated desktop/mobile comparison; Feature 007 passport/custody compatibility. No broad unrelated suite or scheduling test is implied.

## Project Structure

### Documentation (this feature)

```text
specs/008-admin-match-allowances/
  spec.md
  checklists/requirements.md
  plan.md
  research.md
  data-model.md
  contracts/admin-passport-allowances.openapi.yaml
  contracts/administrator-allowance-ui.md
  quickstart.md
```

### Planned source locations (not created by this plan)

```text
apps/backend/prisma/schema.prisma
apps/backend/prisma/migrations/<additive_allowance_migration>/migration.sql
apps/backend/src/authorization/{permission-catalog.ts,authorization.service.ts}
apps/backend/src/passport-match-allowance/{domain,application,persistence,http}/
apps/backend/test/{contract,integration}/
apps/frontend/src/administrator/{shell,passports,administrator-api.ts}/
apps/frontend/app/(admin)/admin/passports/{index.tsx,[passportId].tsx}
```

**Structure Decision**: A new bounded allowance module and Administrator UI slice attach to the existing monorepo. Existing passport/custody services remain owners of their current rules and routes; shared detail is composed rather than replaced.

## Complexity Tracking

No constitution violations requiring an exception.
