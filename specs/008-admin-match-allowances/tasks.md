---

description: "Dependency-ordered implementation tasks for Feature 008 Administrator match allowances"

---

# Tasks: Configuración administrativa de cupos de partidos

**Input**: `specs/008-admin-match-allowances/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, and the approved desktop/mobile Administrator images supplied on 2026-10-09.

**Tests**: Focused test-first delivery is required by the plan and constitution for calendar boundaries, persistence, authorization, API contracts, concurrency, frontend states, privacy, and authenticated visual checks. Each test block precedes its implementation block. PostgreSQL suites run sequentially.

**Organization**: The four requested bounded functional phases are used; `[US1]`, `[US2]`, and `[US3]` still trace every story task to the specification. `[P]` means different files and no incomplete shared schema/service dependency. No task authorizes scheduling, usage accounting, Analyst/FEM work, payments, or subscriptions.

## Format: `[ID] [P?] [Story?] Description`

Every checklist item has a concrete repository path and observable completion target. A task without a story label is a final cross-cutting gate.

---

## Phase 1: Persistence and period rules

**Goal**: Establish one additive aggregate per passport and deterministic Colombia-local period boundaries before HTTP or UI work.

**Independent test**: An active passport can have one allowance aggregate and append-only revisions; absent rows mean unconfigured. Pure period tests cover all four cadences and consecutive boundaries without gaps, overlap, or clamp drift.

- [X] T001 [US3] Add failing pure date-boundary tests for `MONTHLY|QUARTERLY|SEMIANNUAL|ANNUAL` = 1|3|6|12 months, `[start,endExclusive)`, 2026-10-09→2026-11-09 monthly, Colombia-local day, 29–31 clamping, leap February, year rollover, and original-anchor recovery in `apps/backend/src/passport-match-allowance/domain/allowance-period.spec.ts`
- [X] T002 [US3] Implement date-only `America/Bogota` anniversary/segment calculations, preserving the original anchor on shorter months and starting a new segment only when cadence changes, in `apps/backend/src/passport-match-allowance/domain/allowance-period.ts`; make T001 pass
- [X] T003 [US1] Add failing schema-shape tests for `PassportMatchAllowance` unique `passportId`, immutable Colombia `activatedOn`, version starting at 1, absence-as-unconfigured, and append-only `PassportMatchAllowanceRevision` with `(allowanceId,sequence)`/`(allowanceId,idempotencyKey)` uniqueness, restrictive FKs, positive safe-integer limit, four-cadence enum, previous/new snapshots and actor/time in `apps/backend/src/passport-match-allowance/persistence/allowance-schema.spec.ts`
- [X] T004 [US1] Add only the allowance aggregate/revision models, restrictive relations/checks/indexes, and exact shared projection discriminants in `apps/backend/prisma/schema.prisma` and `apps/backend/src/passport-match-allowance/domain/allowance.types.ts`; preserve all existing passport/custody/approval models and make T003 pass
- [X] T005 [US1] Write the additive no-backfill migration for the two allowance tables and constraints in `apps/backend/prisma/migrations/20261009120000_admin_match_allowances/migration.sql`; do not create allowance rows for historical passports
- [X] T006 [US1] Add sequential PostgreSQL tests for one aggregate/passport, unique revision sequence/idempotency key, restrictive FKs, positive limit, unchanged existing rows, and no allowance created by approval or custody changes in `apps/backend/test/integration/passport-match-allowance-schema.integration.spec.ts`; apply and test the migration only in the isolated test database
- [X] T007 [US3] Add failing read-port tests for current rule/period lookup at a supplied Colombia date, limit-only change retaining its anchor, cadence change re-anchoring at the next old boundary, and no match/usage side effects in `apps/backend/src/passport-match-allowance/application/allowance-period-query.spec.ts`
- [X] T008 [US3] Implement the typed allowance period read port for later scheduling consumption, without a scheduling endpoint or consumer, in `apps/backend/src/passport-match-allowance/application/allowance-period-query.ts`; make T007 pass

**Checkpoint**: Database and period semantics are independently verifiable; no Administrator routes or UI exist yet.

---

## Phase 2: Authorized Administrator reads and commands

**Goal**: Expose safe all-passport cards/detail and confirmed allowance create/update/history while protecting current passport and custody authority.

**Independent tests**: US1 lists all authorized passports and confirms a first allowance; US2 confirms an update effective next period, preserves audit history, and rejects a stale version until a fresh read; US3 sees the same boundaries through the Administrator projection and the read port.

- [X] T009 [US1] Add failing policy tests for live active-identity/Administrator-role evaluation, all-passport list/detail and allowance read/write/history capabilities, inactive/revoked denial, indistinguishable missing/denied direct IDs, and no widening of Custodia or Analyst access in `apps/backend/src/authorization/administrator-allowance-authorization.spec.ts`
- [X] T010 [US1] Add only Feature 008 capabilities/resource facts to `apps/backend/src/authorization/permission-catalog.ts`, `apps/backend/src/authorization/authorization.contract.ts`, and `apps/backend/src/authorization/authorization.service.ts`; make T009 pass with server-side checks on every read/write
- [X] T011 [US1] Add failing read-model tests for one bounded stable cursor page of **all** existing authorized passports regardless of state/custody, readable authorized player label, separate masked passport reference, active-only `canConfigure`, safe detail links, and no private identity/contact/evidence disclosure in `apps/backend/src/passport-match-allowance/application/admin-passports-query.spec.ts`
- [X] T012 [US1] Implement separate Administrator passport card/detail queries in `apps/backend/src/passport-match-allowance/persistence/admin-passports.repository.ts` and `apps/backend/src/passport-match-allowance/application/admin-passports-query.ts`; do not reuse the custody-only list or change Feature 005 `/passports`, and make T011 pass
- [X] T013 [US1] Add failing projection tests for absent configuration as `null`, server `colombiaToday`, current/pending rule, immutable initial date, current `[start,endExclusive)` period, no usage fields, and non-active passport read-only state in `apps/backend/src/passport-match-allowance/application/allowance-query.spec.ts`
- [X] T014 [US1] Implement authorized minimum allowance projection from aggregate/revisions and the Phase 1 period calculator in `apps/backend/src/passport-match-allowance/application/allowance-query.ts`; make T013 pass without returning credentials, civil data, match counts, or inferred availability
- [X] T015 [US1] Add failing command tests for first creation with `expectedVersion=0`, server-computed Colombia activation date equal to `expectedActivationDate`, `MONTHLY|QUARTERLY|SEMIANNUAL|ANNUAL`, positive safe integer, invalid/past/future day rejection, active passport/Administrator recheck, one atomic aggregate/revision, cancel-before-command no-op, and rollback in `apps/backend/src/passport-match-allowance/application/allowance-command.spec.ts`
- [X] T016 [US1] Implement closed command validation, passport-row locking, serializable first-activation transaction, bounded serialization retries, safe failures and idempotent same-intention replay in `apps/backend/src/passport-match-allowance/application/allowance-command.ts` and `apps/backend/src/passport-match-allowance/persistence/allowance-transaction.runner.ts`; make T015 pass without altering approval or custody
- [X] T017 [US1] Add failing OpenAPI/controller tests for `GET /admin/passports`, `GET /admin/passports/{passportId}`, `GET|PUT /admin/passports/{passportId}/match-allowance`, cursor `limit=1..50`, closed `expectedVersion`/UUID/cadence/limit/preview-date input, `no-store`, safe 403/404/409/422, and no start-date selector in `apps/backend/test/contract/admin-passport-allowance.contract.spec.ts` and `apps/backend/src/passport-match-allowance/http/admin-allowance.controller.spec.ts`
- [X] T018 [US1] Implement the Feature 008 DTO/controller/module wiring for those four operations in `apps/backend/src/passport-match-allowance/http/admin-allowance.dto.ts`, `apps/backend/src/passport-match-allowance/http/admin-allowance.controller.ts`, `apps/backend/src/passport-match-allowance/passport-match-allowance.module.ts`, and `apps/backend/src/app.module.ts`; make T017 pass and keep existing routes unchanged
- [X] T019 [US2] Add failing update/concurrency tests for next-old-period effective date, fixed `activatedOn`, limit-only/cadence-change semantics, previous/new snapshots, monotonic version, same-key replay, different-intention key conflict, and mandatory rejection of **every stale-version command**, including one aimed at an already pending boundary, in `apps/backend/src/passport-match-allowance/application/allowance-update-concurrency.spec.ts`
- [X] T020 [US2] Extend the same atomic command aggregate in `apps/backend/src/passport-match-allowance/application/allowance-command.ts` to append an accepted revision only after current-version comparison; require a fresh authorized read and explicit new confirmation after conflict, never unconditional last-confirmation-wins; make T019 pass
- [X] T021 [US2] Add failing authorized history tests for stable cursor order, actor/time, old/new values, effective date, accepted pending changes, no canceled/conflicted entries, and no private actor identifier in `apps/backend/src/passport-match-allowance/application/allowance-history.spec.ts`
- [X] T022 [US2] Implement append-only history query/projection and `GET /admin/passports/{passportId}/match-allowance/history` in `apps/backend/src/passport-match-allowance/application/allowance-history.ts` and `apps/backend/src/passport-match-allowance/http/admin-allowance.controller.ts`; make T021 pass
- [X] T023 [US2] Add failing HTTP tests for stale 409 with safe current state, same-key/same-intention 200 replay, same-key/different-intention conflict, Colombia-day rollover conflict, ineligible passport, safe missing/denied equivalence, and `no-store` in `apps/backend/src/passport-match-allowance/http/admin-allowance-conflict.spec.ts`
- [X] T024 [US2] Complete safe exception mapping and current-state refresh envelope in `apps/backend/src/passport-match-allowance/http/admin-allowance-exception.filter.ts` and `apps/backend/src/passport-match-allowance/http/admin-allowance.controller.ts`; make T023 pass without logging protected labels or proposal contents

**Checkpoint**: Administrator API supports first confirmation, future-effective updates and audit; conflicts cannot silently overwrite newer state.

---

## Phase 3: Responsive Administrator UI

**Goal**: Add one Pasaportes card collection and an allowance section inside the existing Administrator passport detail, faithful to both approved desktop/mobile references without invented use data.

**Independent tests**: US1 finds, opens and configures an active passport; US2 reviews, confirms or discards an update and recovers from a conflict; US3 reads the correct current-period dates. Existing detail, Custodia and shell destinations remain reachable.

- [X] T025 [US1] Add failing typed API/state tests for all-passport cursor pages, safe detail/configuration parsing, no-store/non-persistence of protected data, initial Colombia day, validation, confirm-only PUT, cancel/unmount no-op, and refresh after creation in `apps/frontend/src/administrator/passports/admin-passports-state.spec.ts` and `apps/frontend/src/administrator/administrator-api.spec.ts`
- [X] T026 [US1] Implement Feature 008 typed API methods and ephemeral card/detail/allowance state in `apps/frontend/src/administrator/administrator-api.ts` and `apps/frontend/src/administrator/passports/admin-passports-state.ts`; make T025 pass with no client-generated activation date or optimistic usage
- [X] T027 [US1] Add failing shell/card tests for **Pasaportes** between Expedientes and Custodia, one responsive card collection of all passport states, accessible status and masked reference, stable pagination, loading/empty/restricted/error states, keyboard/touch navigation in `apps/frontend/src/administrator/shell/administrator-shell.spec.tsx` and `apps/frontend/src/administrator/passports/admin-passports-list.spec.tsx`
- [X] T028 [US1] Implement the unchanged-shell destination and `/admin/passports` card route in `apps/frontend/src/administrator/shell/administrator-shell.tsx`, `apps/frontend/src/administrator/passports/admin-passports-list.tsx`, and `apps/frontend/app/(admin)/admin/passports/index.tsx`; make T027 pass without changing Custodia's list semantics
- [X] T029 [US1] Add failing detail tests for preserved profile/status/linked records/custody/history, the approved allowance-section hierarchy, read-only activation date, no-configuration state, active-only editing, positive-integer errors, explicit summary/confirm/discard, and structural absence of used/available/progress/photo/scheduling content in `apps/frontend/src/administrator/passports/admin-passport-detail.spec.tsx`
- [X] T030 [US1] Compose the allowance section inside the existing Administrator passport detail/navigation, retaining safe existing sections and routes, in `apps/frontend/src/administrator/passports/admin-passport-detail.tsx`, `apps/frontend/src/administrator/passports/allowance-section.tsx`, and `apps/frontend/app/(admin)/admin/passports/[passportId].tsx`; make T029 pass against both approved screen compositions
- [X] T031 [US2] Add failing form/state tests for previous/new values and next-effective-date review, immutable initial date, pending-versus-current display, last modification/history, cancellation, same-key connectivity retry, and stale conflict requiring fresh read and **new** explicit confirmation in `apps/frontend/src/administrator/passports/allowance-update-state.spec.ts` and `apps/frontend/src/administrator/passports/allowance-section.spec.tsx`
- [X] T032 [US2] Implement update/confirmation/retry state and safe history rendering in `apps/frontend/src/administrator/passports/allowance-update-state.ts` and `apps/frontend/src/administrator/passports/allowance-section.tsx`; make T031 pass without replacing current-period values optimistically
- [X] T033 [US3] Add failing presentation tests for Colombia-local current start, inclusive UI last day derived from exclusive API end, next start, 9 October–8 November monthly, and 29–31/leap transitions in `apps/frontend/src/administrator/passports/allowance-period-presentation.spec.ts`
- [X] T034 [US3] Implement date-only accessible period labels shared by desktop/mobile detail in `apps/frontend/src/administrator/passports/allowance-period-presentation.ts`; make T033 pass without browser-timezone drift or fabricated consumption

**Checkpoint**: The responsive Administrator journey works without modifying Feature 007 passport naming, decisions or custody controls.

---

## Phase 4: Focused integration and visual verification

**Goal**: Verify the complete feature, concurrency/privacy boundaries, and both approved screen references; record evidence without committing runtime artifacts.

- [X] T035 [US1] Add sequential PostgreSQL end-to-end tests for all-passport visibility, active-only creation, exact server Colombia day, one aggregate/revision, invalid-input rollback, and unchanged passport/custody/approval rows in `apps/backend/test/integration/admin-passport-allowance-create.integration.spec.ts`
- [X] T036 [US2] Add sequential two-client PostgreSQL tests for next-period updates, immutable activation, append-only actor/old/new audit, idempotent replay, precommit rollback, and competing same-version commands where exactly one wins and the loser must reread before a new confirmation in `apps/backend/test/integration/admin-passport-allowance-update.integration.spec.ts`
- [X] T037 [US3] Add focused integration tests comparing Administrator projections and the typed read port for all four cadences, 2026-10-09→2026-11-09, 29–31/leap clamping, limit-only/cadence changes, and contiguous boundaries in `apps/backend/test/integration/admin-passport-allowance-periods.integration.spec.ts`
- [X] T038 Verify authenticated desktop/mobile `/admin/passports` and passport-detail flows against the **two approved 2026-10-09 Administrator references**, including keyboard, touch, focus, reduced motion, no horizontal scroll, and no fabricated usage/progress/photo/scheduling; record results in `specs/008-admin-match-allowances/verification/visual-accessibility.md` and keep any captures only in ignored `.runtime/feature-008-visual/`
- [X] T039 Run focused authorization/privacy and Feature 005/007 regressions in `apps/backend/src/authorization/administrator-allowance-authorization.spec.ts`, `apps/backend/test/contract/admin-passport-allowance.contract.spec.ts`, and `apps/frontend/src/administrator/passports/admin-passport-detail.spec.tsx` for denied direct IDs, no private fields/logged proposals, retained passport detail/custody navigation, and no Analyst/FEM/payment/scheduling surface; record results in `specs/008-admin-match-allowances/verification/scope-privacy.md`
- [X] T040 Execute only affected Vitest/Jest suites and backend/frontend typechecks, validate the OpenAPI projection, run `git diff --check`, and record commands/results plus the `quickstart.md` journeys in `specs/008-admin-match-allowances/verification/backend-frontend.md`; do not claim Feature 008 complete until all four phases pass

**Checkpoint**: Complete evidence-backed Feature 008 acceptance, with no runtime screenshots or synthetic credentials committed.

---

## Dependencies and execution order

1. T001→T002 period rules; T003→T004→T005→T006 schema/migration/invariants. T007→T008 follows T002 and T004. Do not run PostgreSQL suites in parallel.
2. Phase 2 begins after Phase 1. Authorization T009→T010 blocks protected reads/commands. US1 list T011→T012, projection T013→T014, creation T015→T016 and HTTP T017→T018 form the first API slice. US2 T019→T024 follows its aggregate/endpoint. Shared controller/service edits are serialized.
3. Phase 3 begins after the matching Phase 2 API slice. US1 T025→T030 yields a usable cards→detail→create flow; US2 T031→T032 adds updates; US3 T033→T034 adds safe period presentation. Shared `allowance-section.tsx` edits are serialized.
4. Phase 4 follows the relevant implementation slices. Run T035, T036 and T037 **sequentially** against PostgreSQL, then browser and final gates T038–T040. The feature's first MVP is US1 creation/consultation plus the necessary US3 period foundation, not updates or scheduling.

### Independent story completion

| Story | Earliest prerequisites | Observable completion |
|---|---|---|
| US1 (P1) Guardar/consultar | Phase 1 + authorization | All passport cards, one active-passport confirmed allowance, exact server date; cancel/invalid input leave no row. |
| US2 (P2) Actualizar/trazabilidad | US1 aggregate/API | Current period unchanged, next-boundary change and history; stale version rejected until reread/new confirmation. |
| US3 (P3) Límites recurrentes | Phase 1 period domain + US1 read | Four cadence boundaries and date-only UI/typed read-port projections agree without gaps or usage. |

### Safe parallel opportunities

- After T004, pure period-port tests in T007 and authorization tests in T009 may be prepared in different files; their implementations wait for their stated dependencies.
- After the US1 backend slice, frontend API/state tests T025 and shell/card tests T027 can be prepared in distinct files; shared `administrator-api.ts`/shell changes remain serialized.
- Contract/privacy inspection and visual-reference preparation can run in different files after the relevant UI/API exist. PostgreSQL migration/concurrency suites never run in parallel.

## Implementation strategy and guardrails

Start with the **T001–T006 foundation block**: prove period arithmetic, schema constraints, and additive migration/invariants before opening shared API/UI files. Then deliver US1 API and cards/detail/confirmation as the first usable slice; add US2 update/history/concurrency and US3 period presentation; finish with Phase 4 gates.

Every failing test block is followed by its implementation block; verify it fails for the intended reason. Preserve existing uncommitted work and Feature 007 behavior. A stale-version command never writes, even when its proposed effective boundary matches an accepted pending revision; a further change requires a fresh read and explicit confirmation. Do not introduce match scheduling, used/available counters, Analyst work, FEM, payments, subscriptions, invented photos, or unrelated redesign.
