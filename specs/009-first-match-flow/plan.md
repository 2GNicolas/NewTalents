# Implementation Plan: First Match Passport Flow

**Branch**: `feature/009-first-match-flow` | **Date**: 2026-10-13 | **Spec**: `specs/009-first-match-flow/spec.md`

**Input**: Owner-approved Feature 009 specification. The owner approved current Feature 008 contracts as this plan's dependency; Feature 008's formal draft label is unchanged.

## Summary

Add a passport-scoped first-match journey: full-screen invitation, scheduling with one Feature 008 unit, persistent waiting, pre-load reschedule/cancellation, and a trusted confirmed-Analyst-load transition from `RESERVED` to `USED`. Continue final Administrator approval or explicit activation to existing manual custody assignment. Extend allowance confirmation to reject proposed revisions whose affected periods would overfill when reserved and used units are counted. No Analyst data-entry UI, FEM, payments, plans, or later-match management.

## Technical Context

**Language/Version**: TypeScript 5.9 backend; TypeScript 6 / React 19 frontend; Node 24 / npm 10 toolchain.

**Primary Dependencies**: NestJS 11, Prisma 7, PostgreSQL/`pg` backend; Expo 57, Expo Router, React Native 0.86 and React Native Web frontend. Reuse Feature 005–008 authorization, approval, custody and allowance modules.

**Storage**: PostgreSQL via Prisma. Add durable first-match, unit-state and idempotent audit records; retain Feature 008's revision tables and date-only period resolver.

**Testing**: Vitest backend unit/contract/integration and PostgreSQL concurrency tests; Jest/React Native Testing Library frontend; web/mobile visual and accessibility checks against all six PNGs.

**Target Platform**: Existing NestJS service and Expo web, Android, iOS clients; visual acceptance for desktop web and mobile.

**Project Type**: Existing npm-workspace full-stack application.

**Performance Goals**: Preserve SC-001 (90% complete invitation and scheduling within three minutes). No new throughput/latency number is approved; verify bounded per-passport critical sections under concurrency.

**Constraints**: One current first match per passport; one counted unit per current match; `reserved + used <= effective limit` per passport and period; no custody prerequisite to book; no private identity/Analyst details in client projections; full-screen flow without passport menu.

**Scale/Scope**: One first-match journey per passport, retained canceled history, finite affected booked dates for allowance changes. No global tournament or subsequent-match system.

## Constitution Check

*Gate before Phase 0 and rechecked after Phase 1.*

| Principle/gate | Before research | After design |
|---|---|---|
| I–II: approved and bounded | Pass: owner approved Feature 009 for planning on 2026-10-13; exclusions explicit | Pass: artifacts cover only first match and necessary Feature 008 guard |
| III–V: player focus, FEM, evidence | Pass | Pass: no invented sporting data, Analyst entry, FEM or publication |
| VI: privacy/authorization | Pass with design obligation | Pass: live backend checks, safe direct-ID denial, minimal projections |
| VII: simplest explicit architecture | Pass with research obligation | Pass: shared passport lock, existing period resolver, one match-owned unit; alternatives in `research.md` |
| VIII–IX: cross-platform/verification | Pass with design obligation | Pass: six PNGs mapped; accessibility, failure and concurrency checks in quickstart |
| X–XI: authority/change | Pass: Feature 008 contracts approved as dependency, not relabeled | Pass: additive 009 integration; existing 005–008 artifacts/images unchanged |
| XII: phase discipline | Pass | Pass: design only; no tasks or implementation |

**Gate result**: Pass. Feature 008's formal status remains a downstream governance note, not a change to its current contract or period semantics. No exception requested.

## Design and atomic boundaries

1. **Scheduling**: With an intent key, a passport-scoped serializable transaction locks the passport row, rechecks `ACTIVE` and live responsibility, resolves Feature 008 for match date, counts `RESERVED + USED`, and creates one `WAITING` match with one `RESERVED` unit only when capacity remains. No Analyst required.
2. **Rescheduling**: Under the same lock, require current `WAITING` version and actor. Re-resolve destination period and capacity; exclude this match's unit only if source and destination are the same period. Change date/details and the same unit together. Failure preserves original state; same-intent replay returns original result, stale different intent conflicts.
3. **Cancellation**: Under the same lock, require `WAITING`; transition match to `CANCELED` and unit to `RELEASED` once. Preserve history; restore invitation only if no current waiting/loaded first match. No post-load cancellation here.
4. **Analyst load**: A trusted internal completion operation must participate in the future Analyst data confirmation transaction. Under the passport lock, revalidate current custody/role and match identity/version; atomically persist the confirmation with match `LOADED`, unit `USED`, and waiting ended. The unit stays in match-date period. Failed, foreign, stale or duplicate signals cannot alter accounting. No Administrator approval.
5. **Allowance revision**: Extend Feature 008's locked confirmation. Before appending the proposed revision, group affected `RESERVED` and `USED` units by the period their unchanged match dates would occupy under the proposed effective rule; reject if any group exceeds the limit. Preserve current/earlier period semantics. Rejection changes no configuration, match or unit. Booking and allowance changes share the passport lock.
6. **Administrator continuation**: Only after final approval returns a created `ACTIVE` passport ID, or explicit activation succeeds, navigate directly to existing `/(admin)/admin/custody/[passportId]`. Pending evidence deletion/absent passport remains in progress. Navigation neither assigns custody nor reverses committed approval/activation.

**Existing presentation compatibility**: Feature 005's default `ACTIVE → Resumen` entry is overridden only while this authorized first-match invitation/waiting journey applies; after `LOADED`, the existing permitted passport presentation resumes. Feature 008's Administrator configuration response/UI remains configuration-only; computed usage appears only in the new authorized first-match preview.

## Project Structure

### Documentation (this feature)

```text
specs/009-first-match-flow/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── first-match.openapi.yaml
    ├── allowance-write-guard.md
    ├── analyst-load-boundary.md
    └── first-match-ui.md
```

### Source Code (repository root; planned touch points only)

```text
apps/backend/
├── prisma/schema.prisma
├── src/passport-match-allowance/       # existing resolver and locked confirmation
├── src/player-passport/                # lifecycle/responsibility
├── src/passport-custody/               # live Analyst access
├── src/registration-requests/          # final approval result
├── src/first-match/                    # planned domain/application/HTTP
└── test/{contract,integration}/
apps/frontend/
├── app/(authenticated)/passports/[passportId]/ # dedicated first-match route
├── app/(admin)/admin/custody/[passportId].tsx  # existing manual destination
├── app/(admin)/admin/registration/[requestId]/approval.tsx
├── src/passport/
├── src/administrator/
└── src/first-match/                    # planned state/screens
docs/design/feature-009/               # six unchanged PNGs
```

**Structure Decision**: Reuse existing identity, custody and allowance boundaries; isolate first-match behavior as an additive module and dedicated frontend flow. No separate service/cache.

## Verification trace

| Spec evidence | Planned verification |
|---|---|
| US1 / FR-001–008 | Invitation, authorization, no-Analyst booking, form validation, allowance date/boundary and one-unit tests |
| US2 / FR-009–010, FR-018 | Same/cross-period reschedule, rollback, cancel/retry, mixed reserved+used proposed-limit rejection |
| US3 / FR-014–015 | Final approval and activation reach exact custody detail; pending approval does not; assignment manual |
| US4 / FR-011–013 | Waiting survives sessions/devices; valid-load exactly once; invalid/foreign/revoked Analyst signal denied |
| FR-007–008, FR-012, FR-018 | PostgreSQL races: last slot, reschedule vs load/cancel, booking vs allowance update; no double count/partial write |
| FR-003–004, visuals | Invitation, form, waiting against each desktop/mobile PNG; approved secondary actions below details, no passport menu |
| FR-016–017 | Audit actor/time/unit transition without private data; regression check excludes payments, plans, Analyst entry, FEM and later-match management |

## Complexity Tracking

No constitution violation or exceptional infrastructure is proposed.
