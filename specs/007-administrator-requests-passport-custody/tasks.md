---

description: "Implementation tasks for Feature 007 Administrator requests, dossiers, and passport custody"
---

# Tasks: Interfaz administrativa de solicitudes y custodia de pasaportes

**Input**: Design documents from `specs/007-administrator-requests-passport-custody/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/`, and `docs/design/admin-custody/manifest.md`

**Tests**: Focused test-first delivery is required for backend behavior, contracts, PostgreSQL invariants/concurrency, frontend state/components, authorization, privacy, accessibility, and browser visual verification. Each failing test block is immediately followed by its implementation block.

**Organization**: Tasks are grouped by user story. Feature 006 review, decision, dossier creation, evidence deletion, approval, and passport creation remain dependencies and are never rebuilt here.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: May run in parallel only when it changes different files and shares no incomplete schema, service, or PostgreSQL dependency.
- **[Story]**: Maps the task to a user story in `spec.md`; setup, foundation, and final gates have no story label.
- Every task names concrete repository paths and an observable verification target.

---

## Phase 1: Setup and contract guardrails

**Purpose**: Establish Feature 007 contract validation and synthetic fixture boundaries before persistence or application behavior changes.

### Contract block

- [X] T001 Add a document-level contract test that parses all 11 Feature 007 paths, 29 closed schemas, cursor limits `1..50`, 500-character safe-reason limit, `no-store` responses, safe denial/conflict envelopes, and absence of dossier mutation/evidence retrieval operations in `apps/backend/test/contract/admin-custody.openapi.spec.ts`
- [X] T002 [P] Add reusable synthetic Administrator, Analyst-profile, approved-request, confirmed-dossier, linked-passport, and privacy-canary builders without real identity data in `apps/backend/test/fixtures/feature-007.fixture.ts` and `apps/frontend/src/administrator/testing/feature-007-fixtures.ts`

**Checkpoint**: The approved API surface and safe synthetic data are available to every later block.

---

## Phase 2: Shared persistence, authorization, and Analyst-profile foundation

**Purpose**: Add the four authoritative Feature 007 models and fail-closed capabilities that block all stories.

**Critical**: Complete this phase before starting any story implementation.

### Persistence block — schema test then implementation

- [X] T003 Add failing schema-shape tests for `RegistrationAdminReviewProgress`, `AnalystOperationalProfile`, one `PassportCustody` per passport, append-only `PassportCustodyEvent`, UUID idempotency uniqueness, `(passportId, sequence)` uniqueness, required `ASSIGNED|CHANGED|REMOVED`, nullable prior/next Analyst rules, `safeReason varchar(500)`, version fields, and all restrictive foreign keys/indexes in `apps/backend/src/passport-custody/persistence/passport-custody-schema.spec.ts`
- [X] T004 Implement the additive enums/models/relations/indexes in `apps/backend/prisma/schema.prisma` and exact shared discriminants/projections in `apps/backend/src/passport-custody/domain/passport-custody.types.ts`, preserving all Feature 001–006 models and treating absence of a custody row as `UNASSIGNED` version `0`
- [X] T005 Create the additive migration with no rewrite of existing requests, dossier confirmations, identities, responsibilities, players, or passports in `apps/backend/prisma/migrations/20260930120000_administrator_passport_custody/migration.sql`
- [X] T006 Add sequential PostgreSQL migration/invariant coverage for one progress row/request, one operational profile/identity, one custody/passport, unique idempotency/sequence, nullable unassigned state, preservation of existing rows, and no automatic custody creation during Feature 006 approval in `apps/backend/test/integration/passport-custody-schema.integration.spec.ts`

### Authorization block — policy test then implementation

- [X] T007 Add failing authorization tests for `registration.review.progress`, `registration.dossier.list|view`, `passport.custody.list|view|list-analysts|assign|change|remove`, `analystCustodyActive`, safe missing/denied equivalence, active identity/role re-evaluation, and denial from visible role text alone in `apps/backend/src/authorization/administrator-custody-authorization.spec.ts`
- [X] T008 Extend the permission catalog, authorization resource facts/evaluator, and backend session projection with only the Feature 007 capabilities in `apps/backend/src/authorization/permission-catalog.ts`, `apps/backend/src/authorization/authorization.contract.ts`, `apps/backend/src/authorization/authorization.service.ts`, and `apps/backend/src/authentication/session-access.projection.ts`

### Analyst-profile block — validation test then implementation

- [X] T009 Add failing unit tests for a non-empty operational `displayLabel`/`normalizedLabel` maximum 120 characters, exclusion of email/document/credentials, idempotent controlled upsert, fail-closed absence, inactive identity, and missing/revoked ANALYST role in `apps/backend/src/identity/analyst-operational-profile.service.spec.ts`
- [X] T010 Implement controlled operational-profile provisioning and lookup, export it from the identity boundary, and add synthetic local provisioning without deriving labels from credentials in `apps/backend/src/identity/analyst-operational-profile.service.ts`, `apps/backend/src/identity/identity.module.ts`, and `apps/backend/src/player-passport/review-environment/local-review-provisioning.service.ts`

**Checkpoint**: Additive schema, migration, capabilities, and safe Analyst labels exist; no request decision or passport access behavior has changed yet.

---

## Phase 3: User Story 1 — Gestionar solicitudes desde un espacio operativo (Priority: P1) 🎯 First UI slice

**Goal**: Present the five operational groups and complete searchable list while routing every business action to existing Feature 006 behavior.

**Independent Test**: Populate one synthetic current-version request per group, verify the minimum card projection and filters, open each next action, and prove the existing review/decision endpoints and outcomes are unchanged.

### Backend operational projection block

- [X] T011 [US1] Add failing service tests for exact group precedence `WAITING_EVIDENCE_DELETION > REQUIRES_CORRECTION > READY_FOR_DECISION > CONTINUE_REVIEW > NEW`, current-version progress reset, monotonic `OPENED -> REVIEWED`, terminal exclusion from the queue, masked references, minimum labels/dates, and next-action mapping in `apps/backend/src/registration-requests/review/admin-operational-workspace.service.spec.ts`
- [X] T012 [US1] Implement current-version `RegistrationAdminReviewProgress`, grouped projections, stable complete-list search/filter reuse, and minimum safe card mapping without appending Feature 006 lifecycle events in `apps/backend/src/registration-requests/review/admin-review-progress.service.ts` and `apps/backend/src/registration-requests/review/admin-operational-workspace.service.ts`

### HTTP block

- [X] T013 [US1] Add failing controller tests for authorized `GET /admin/registration-requests/operations` and `PATCH /admin/registration-requests/{requestId}/review-progress`, closed `expectedRequestVersion`/`OPENED|REVIEWED` input, `no-store`, safe 404, stale 409, and unchanged existing decision routes in `apps/backend/src/registration-requests/http/admin-registration-operations.controller.spec.ts`
- [X] T014 [US1] Implement operation query/progress DTO parsing and controller endpoints, wiring only the new read/progress services into the existing module in `apps/backend/src/registration-requests/http/admin-registration-operations.dto.ts`, `apps/backend/src/registration-requests/http/admin-registration-operations.controller.ts`, and `apps/backend/src/registration-requests/registration-requests.module.ts`

### Frontend state and API block

- [X] T015 [US1] Add failing frontend API/state tests for five groups, search/type filtering, complete-list cursor pages, scroll restoration, row invalidation after an existing decision, and loading/empty/restricted/unavailable/error states in `apps/frontend/src/administrator/requests/admin-requests-state.spec.ts` and `apps/frontend/src/administrator/administrator-api.spec.ts`
- [X] T016 [US1] Implement the typed Administrator API and request workspace state while delegating decision calls to the existing registration request API in `apps/frontend/src/administrator/administrator-api.ts` and `apps/frontend/src/administrator/requests/admin-requests-state.ts`

### Responsive component block

- [X] T017 [US1] Add accessible component tests for minimum cards, group headings/counts, next-action names, complete-list entry, filters, keyboard order, focus restoration, touch targets, non-color statuses, and reduced motion in `apps/frontend/src/administrator/requests/admin-requests-workspace.spec.tsx` and `apps/frontend/src/administrator/shell/administrator-shell.spec.tsx`
- [X] T018 [US1] Implement the shared desktop sidebar/mobile bottom navigation and requests workspace using only `docs/design/admin-custody/registration-requests-desktop.png`, `registration-requests-mobile.png`, and approved shell references in `apps/frontend/src/administrator/shell/administrator-shell.tsx`, `apps/frontend/src/administrator/requests/admin-requests-workspace.tsx`, `apps/frontend/app/(admin)/admin/_layout.tsx`, and `apps/frontend/app/(admin)/admin/registration/index.tsx`

### Compatibility and visual gate

- [X] T019 [US1] Add focused regression coverage proving review, correction, rejection, dossier confirmation, evidence deletion/retry, approval, and typed passport outcomes still execute through Feature 006 services without duplicated rules in `apps/backend/test/integration/administrator-requests-feature-006-regression.integration.spec.ts` and `apps/frontend/src/administrator/requests/admin-request-routing-regression.spec.tsx`
- [X] T020 [US1] Capture desktop/mobile browser output to ignored `.runtime/feature-007-visual/requests/`, compare it only with the two approved request references plus shared shell, and record responsive/accessibility deviations without adding screenshot binaries in `specs/007-administrator-requests-passport-custody/verification/requests-visual.md`

**Checkpoint**: The redesigned requests space is independently usable and all decisions remain owned by Feature 006.

---

## Phase 4: User Story 2 — Asignar un pasaporte sin Analista (Priority: P1) 🎯 Custody MVP

**Goal**: List eligible active basic passports and Analysts, then atomically assign one existing passport with accurate workload and one history event.

**Independent Test**: Find an approved unassigned passport from Custodia and from its approved request, confirm one eligible Analyst with a safe reason, and verify the same passport moves lists, workload increases, and exactly one `ASSIGNED` event exists.

### Query block

- [X] T021 [US2] Add failing query tests for `ACTIVE` + `AWAITING_ANALYST_ENRICHMENT`, absent custody as `UNASSIGNED` version `0`, encrypted-name/reference search by bounded stable chunks, eligible Analyst = active identity + active ANALYST role + profile, live workload counts, pagination, and no credential/private-identity disclosure in `apps/backend/src/passport-custody/application/passport-custody-query.service.spec.ts`
- [X] T022 [US2] Implement custody passport/Analyst repositories, masked references, bounded authorized search, stable cursor pages, and workload aggregation from current custody rows in `apps/backend/src/passport-custody/persistence/passport-custody.repository.ts` and `apps/backend/src/passport-custody/application/passport-custody-query.service.ts`

### Assignment command block

- [X] T023 [US2] Add failing command tests for unassigned version `0`, target eligibility recheck, `reason` trimmed/non-empty/max 500, active basic passport recheck, one state row, version increment, one `ASSIGNED` event, no sports/admin privilege creation, and complete rollback on validation/storage failure in `apps/backend/src/passport-custody/application/passport-custody-command.service.spec.ts`
- [X] T024 [US2] Implement serializable passport-row locking, first-custody creation, assignment state/event persistence, safe validation, and bounded P2034 transaction retry using the existing transaction pattern in `apps/backend/src/passport-custody/application/passport-custody-command.service.ts` and `apps/backend/src/passport-custody/persistence/passport-custody-transaction.runner.ts`

### HTTP and module block

- [X] T025 [US2] Add failing contract/controller tests for Analyst/passport list queries and `POST .../{passportId}/assign`, closed DTOs, current projection, `no-store`, authorization denial, safe 404, stale/ineligible 409, invalid 422, and idempotent 200 envelopes in `apps/backend/src/passport-custody/http/passport-custody.controller.spec.ts`
- [X] T026 [US2] Implement custody DTO parsing, exception mapping, list/assignment endpoints, module wiring, and application registration in `apps/backend/src/passport-custody/http/passport-custody.dto.ts`, `apps/backend/src/passport-custody/http/passport-custody-exception.filter.ts`, `apps/backend/src/passport-custody/http/passport-custody.controller.ts`, `apps/backend/src/passport-custody/passport-custody.module.ts`, and `apps/backend/src/app.module.ts`
- [X] T027 [US2] Add sequential PostgreSQL integration coverage for assignment from Custodia and approved-request navigation resolving the same `PlayerPassport`, exact workload +1, one event, no duplicate passport/dossier, and no partial privilege on rollback in `apps/backend/test/integration/passport-custody-assignment.integration.spec.ts`

### Frontend workspace block

- [X] T028 [US2] Add failing API/state tests for unassigned/assigned pages, eligible Analysts, search, workload refresh, approved-request deep link, destination selection, assignment success, no-Analyst empty state, and protected-response non-persistence in `apps/frontend/src/administrator/custody/passport-custody-state.spec.ts` and `apps/frontend/src/administrator/administrator-api.spec.ts`
- [X] T029 [US2] Implement custody API parsing, server-owned lists/workloads, current-version assignment command, affected-query refresh, and request-to-existing-passport navigation in `apps/frontend/src/administrator/administrator-api.ts` and `apps/frontend/src/administrator/custody/passport-custody-state.ts`
- [X] T030 [US2] Add accessible workspace tests for `Sin Analista`, Analyst columns/tabs, active basic/enrichment text, masked references, workload labels, search, loading/empty/restricted/unavailable/error states, and mobile `Asignar` action in `apps/frontend/src/administrator/custody/passport-custody-workspace.spec.tsx`
- [X] T031 [US2] Implement the responsive custody workspace and route without persisting on destination selection in `apps/frontend/src/administrator/custody/passport-custody-workspace.tsx` and `apps/frontend/app/(admin)/admin/custody/index.tsx`

**Checkpoint**: Initial custody assignment is a complete backend/frontend vertical slice over an existing approved passport.

---

## Phase 5: User Story 3 — Confirmar o cancelar una asignación de forma segura (Priority: P1)

**Goal**: Make pointer drop, mobile action, and keyboard selection converge on one non-mutating confirmation boundary.

**Independent Test**: Select an Analyst by desktop drag and by the accessible selector, cancel once and confirm once, proving only final confirmation sends a command and missing reason is announced.

### Confirmation state block

- [X] T032 [US3] Add failing state tests for ephemeral passport/destination/action/reason, stable UUID across retries of the same intention, new UUID when intention changes, cancel/unmount cleanup, no API call before confirm, and recoverable connectivity retry in `apps/frontend/src/administrator/custody/custody-confirmation-state.spec.ts`
- [X] T033 [US3] Implement the confirmation state machine `idle -> selecting -> confirmation -> submitting -> applied|conflict|recoverable-error`, keeping all unconfirmed values in memory in `apps/frontend/src/administrator/custody/custody-confirmation-state.ts`

### Accessible interaction block

- [X] T034 [US3] Add component tests proving desktop drop only opens confirmation, mobile/keyboard use the same Analyst selector, Escape/cancel have zero effects, current/selected Analyst and passport are announced, empty reason receives accessible focus/error, drop zones use text/icons beyond color, and reduced motion removes required animation in `apps/frontend/src/administrator/custody/custody-confirmation.spec.tsx`
- [X] T035 [US3] Implement pointer drag selection, measured drop zones, accessible Analyst selector, mobile bottom sheet/dialog, focus return, safe-reason validation, and confirm/cancel controls in `apps/frontend/src/administrator/custody/custody-drag-selection.tsx` and `apps/frontend/src/administrator/custody/custody-confirmation.tsx`
- [X] T036 [US3] Capture desktop/mobile browser output to ignored `.runtime/feature-007-visual/custody-workspace/`, compare it only with `passport-custody-workspace-desktop.png` and `passport-custody-workspace-mobile.png`, and record pointer/keyboard/touch/reduced-motion results without committing screenshots in `specs/007-administrator-requests-passport-custody/verification/custody-workspace-visual.md`

**Checkpoint**: Selection and confirmation are platform-consistent, accessible, and mutation-safe.

---

## Phase 6: User Story 4 — Cambiar o retirar la custodia (Priority: P1)

**Goal**: Replace or remove current custody atomically while revoking prior access and recalculating live workloads.

**Independent Test**: Change one assigned passport from Analyst A to B, then remove B; verify one current assignment at each step, exact workload changes, prior access revocation, and one event per command.

### Backend transition block

- [X] T037 [US4] Add failing command tests for `CHANGED` requiring a different eligible target, `REMOVED` requiring current custody, version increment exactly once, prior/next Analyst event fields, active-basic runtime recheck, current load recalculation, unauthorized no-op, and no role/sports/passport creation in `apps/backend/src/passport-custody/application/passport-custody-change-remove.spec.ts`
- [X] T038 [US4] Implement atomic change/remove transitions over the same custody aggregate and transaction runner in `apps/backend/src/passport-custody/application/passport-custody-command.service.ts`

### HTTP block

- [X] T039 [US4] Add failing controller tests for `POST .../{passportId}/change` and `/remove`, action-specific capabilities, closed bodies, safe current-state conflicts, and indistinguishable denied/missing resources in `apps/backend/src/passport-custody/http/passport-custody-change-remove.controller.spec.ts`
- [X] T040 [US4] Implement change/remove endpoint dispatch and safe response mapping without DELETE semantics or new passport lifecycle actions in `apps/backend/src/passport-custody/http/passport-custody.controller.ts` and `apps/backend/src/passport-custody/http/passport-custody.dto.ts`
- [X] T041 [US4] Add sequential PostgreSQL tests proving A→B→unassigned leaves at most one current custody, workloads count only non-null current assignments, A/B access changes atomically, and events are exactly `ASSIGNED`, `CHANGED`, `REMOVED` in `apps/backend/test/integration/passport-custody-change-remove.integration.spec.ts`

### Frontend action block

- [X] T042 [US4] Add frontend state/component tests for `Cambiar Analista`, `Retirar custodia`, equivalent confirmation/motive requirements, current-authority refresh, disabled invalid actions, and safe failure preserving the displayed prior state in `apps/frontend/src/administrator/custody/custody-change-remove.spec.tsx`
- [X] T043 [US4] Implement change/remove flows using the shared confirmation state and refresh affected passport/Analyst workloads only from server results in `apps/frontend/src/administrator/custody/custody-change-remove.tsx` and `apps/frontend/src/administrator/custody/passport-custody-state.ts`

**Checkpoint**: Assignment, replacement, and removal preserve one authoritative custody and immediate workload/access consistency.

---

## Phase 7: User Story 5 — Resolver conflictos y reintentar fallos (Priority: P1)

**Goal**: Guarantee exactly-once observable custody under concurrent Administrators, retries, and injected failures.

**Independent Test**: Race two assignments from version 0, inject a pre-commit failure, replay one successful command, and verify one state/event, no partial effects, and recoverable current-state responses.

### Idempotency and failure block

- [X] T044 [US5] Add failing service tests for same-key/same-intention replay, same-key/different-intention conflict, event-result reconstruction, pre-commit rollback, bounded P2034 retry, exhausted retry, stale version, and no duplicate sequence in `apps/backend/src/passport-custody/application/passport-custody-concurrency.spec.ts`
- [X] T045 [US5] Implement idempotency intent comparison, replay projection, unique-conflict handling, bounded serializable retry, and recoverable failure outcomes without logging safe reasons or protected projections in `apps/backend/src/passport-custody/application/passport-custody-command.service.ts` and `apps/backend/src/passport-custody/persistence/passport-custody-transaction.runner.ts`
- [X] T046 [US5] Add sequential multi-client PostgreSQL tests for competing destinations, simultaneous change/remove, command replay, injected rollback, exactly one winning version/event, authoritative workload/access, and retry after refresh in `apps/backend/test/integration/passport-custody-concurrency.integration.spec.ts`

### Conflict contract and UI block

- [X] T047 [US5] Add backend envelope tests and frontend state tests for `CUSTODY_CONFLICT` with minimum current state, `IDEMPOTENCY_CONFLICT`, denied/not-found secrecy, refresh-before-new-intention, connectivity retry with the same key, and no optimistic card move in `apps/backend/src/passport-custody/http/passport-custody-conflict.spec.ts` and `apps/frontend/src/administrator/custody/custody-conflict-state.spec.ts`
- [X] T048 [US5] Implement conflict/error mapping and frontend recoverable-result handling, clearing stale selections while preserving only safe retry state in `apps/backend/src/passport-custody/http/passport-custody-exception.filter.ts` and `apps/frontend/src/administrator/custody/passport-custody-state.ts`

**Checkpoint**: Concurrent and repeated commands cannot overwrite newer custody or duplicate audit history.

---

## Phase 8: User Story 7 — Acceso del Analista según custodia vigente (Priority: P1)

**Goal**: Restrict Analyst collections and passport operations to current custody with immediate grant/revocation.

**Independent Test**: Assign to A, change to B, remove, and inspect both Analyst sessions after each commit; only the current custodian can list or open the passport.

### Authorization adapter block

- [X] T049 [US7] Add failing adapter tests for active ANALYST + matching current custody, role without custody denial, custody without active role/identity denial, unassigned denial, reassignment/removal revocation, safe passport-not-found, and Administrator/User/academy/representative compatibility in `apps/backend/src/player-passport/passport-authorization/passport-custody-authorization.adapter.spec.ts`
- [X] T050 [US7] Implement per-request `analystCustodyActive` lookup and split Analyst from Administrator internal permissions without trusting JWT text in `apps/backend/src/player-passport/passport-authorization/passport-authorization.adapter.ts`, `apps/backend/src/authorization/authorization.contract.ts`, and `apps/backend/src/authorization/authorization.service.ts`

### Analyst collection block

- [X] T051 [US7] Add failing query/controller tests for `GET /analyst/passports`, stable current-custody pages, omission of unassigned/other-Analyst passports, detail/presentation/history reauthorization, `no-store`, and immediate changed/removed denial in `apps/backend/src/passport-custody/http/analyst-passports.controller.spec.ts`
- [X] T052 [US7] Implement the Analyst custody collection endpoint and change only the Analyst branch of accessible passport queries while preserving ordinary role/relationship branches in `apps/backend/src/passport-custody/http/analyst-passports.controller.ts`, `apps/backend/src/passport-custody/application/analyst-passports-query.service.ts`, and `apps/backend/src/player-passport/player-passport.service.ts`
- [X] T053 [US7] Add PostgreSQL integration coverage for commit-visible A grant, A→B revocation/grant, removal revocation, role/profile inactivation, stale session tokens, and indistinguishable direct-ID denial in `apps/backend/test/integration/analyst-custody-access.integration.spec.ts`

### Analyst frontend block

- [X] T054 [US7] Add frontend API/state/route tests for custody-only Analyst lists, direct detail denial after reassignment/removal, selection cleanup, refresh, and zero JWT-role inference in `apps/frontend/src/passport/analyst-custody-access.spec.ts` and `apps/frontend/src/authentication/authenticated-route-policy.spec.ts`
- [X] T055 [US7] Implement Analyst custody collection loading and denied-detail cleanup through backend projections in `apps/frontend/src/passport/passport-api.ts`, `apps/frontend/src/passport/passport-state.ts`, and `apps/frontend/src/authentication/authenticated-route-policy.ts`
- [X] T056 [US7] Add focused regression tests proving USER/SELF, legal representative, academy membership, Administrator activation/history, and pending-applicant restrictions retain their existing authority while ANALYST becomes custody-scoped in `apps/backend/src/player-passport/passport-authorization/passport-authorization.adapter.spec.ts` and `apps/backend/test/integration/passport-custody-authorization-regression.integration.spec.ts`

**Checkpoint**: Current custody is the immediate source of Analyst authority; all unrelated passport authority remains compatible.

---

## Phase 9: User Story 6 — Consultar el pasaporte y el historial de custodia (Priority: P2)

**Goal**: Expose minimum Administrator passport detail, current custody, safe linked records, and chronological custody history.

**Independent Test**: Open a passport after assign/change/remove, verify ordered safe history and links, and confirm protected identities and evidence are absent.

### History projection block

- [X] T057 [US6] Add failing mapper tests for chronological stable `(createdAt,id)` order, `ASSIGNED|CHANGED|REMOVED`, generic/allowed Administrator actor label, prior/next operational Analyst labels, max-500 safe reason, derived “created unassigned” presentation milestone, and exclusion of email/document/contact/credential/private IDs in `apps/backend/src/passport-custody/application/passport-custody-history.mapper.spec.ts`
- [X] T058 [US6] Implement minimum custody history and linked request/dossier projections without adding a synthetic persisted creation event in `apps/backend/src/passport-custody/application/passport-custody-history.mapper.ts` and `apps/backend/src/passport-custody/application/passport-custody-detail.service.ts`

### Detail endpoint block

- [X] T059 [US6] Add failing detail controller tests for passport state, current custody, projected actions, safe history, origin request, confirmed dossier, missing-link handling, `no-store`, and authorized-only navigation in `apps/backend/src/passport-custody/http/passport-custody-detail.controller.spec.ts`
- [X] T060 [US6] Implement custody detail response and safe link resolution through typed `RegistrationRequestPlayer.linkedPlayerId -> Player.passport` relations in `apps/backend/src/passport-custody/http/passport-custody.controller.ts` and `apps/backend/src/passport-custody/application/passport-custody-detail.service.ts`

### Detail UI and visual gate

- [X] T061 [US6] Add frontend detail tests for current custody, allowed actions, linked request/dossier navigation, ordered history, restricted/missing/unavailable/error states, focus headings, keyboard/touch operation, and absence of protected fields in `apps/frontend/src/administrator/custody/passport-custody-detail.spec.tsx`
- [X] T062 [US6] Implement Administrator passport detail and route with shared assign/change/remove confirmation in `apps/frontend/src/administrator/custody/passport-custody-detail.tsx` and `apps/frontend/app/(admin)/admin/custody/[passportId].tsx`
- [X] T063 [US6] Capture desktop/mobile browser output to ignored `.runtime/feature-007-visual/passport-detail/`, compare it only with `administrator-passport-detail-desktop.png` and `administrator-passport-detail-mobile.png`, and record history/navigation/accessibility results without committing screenshots in `specs/007-administrator-requests-passport-custody/verification/passport-detail-visual.md`

**Checkpoint**: Administrators can audit current and historical custody through minimum safe projections.

---

## Phase 10: User Story 8 — Consultar expedientes confirmados (Priority: P2)

**Goal**: Deliver a standalone, authorized, read-only dossier list/detail with stable pagination and safe navigation.

**Independent Test**: Open Expedientes from the menu, traverse three stable pages, search/filter, open dossiers with and without linked passports, navigate and return with context, and verify zero edit/confirm/approve/evidence actions.

### Dossier read-model block

- [X] T064 [US8] Add failing service tests for confirmed rows only, derived `CONFIRMED|DELETION_PENDING|RECOVERY_REQUIRED|APPROVED`, stable `(confirmedAt,id)` cursor order, backward context support, type/status/date filters, bounded encrypted-name/reference search, optional `notApplicable` passport, safe confirmation history, inaccessible link handling, and zero evidence/category/private identity fields in `apps/backend/src/registration-requests/review/admin-dossier-query.service.spec.ts`
- [X] T065 [US8] Implement the read-only dossier repository/service over existing confirmations, executions, request events, deletion aggregates, and typed request-player-passport links without writing Feature 006 records in `apps/backend/src/registration-requests/persistence/admin-dossier.repository.ts` and `apps/backend/src/registration-requests/review/admin-dossier-query.service.ts`

### Dossier HTTP block

- [X] T066 [US8] Add failing controller/contract tests for `GET /admin/dossiers` and `GET /admin/dossiers/{dossierId}`, limit `1..50` default `20`, search/status/type/date parsing, `no-store`, safe collection denial, indistinguishable detail 404, closed projections, and absence of mutation/evidence routes in `apps/backend/src/registration-requests/http/admin-dossier.controller.spec.ts`
- [X] T067 [US8] Implement dossier query DTOs, list/detail controller, authorization projection, and module wiring without exposing `transferredCategories`, declaration text, evidence metadata, objects, or identity documents in `apps/backend/src/registration-requests/http/admin-dossier.dto.ts`, `apps/backend/src/registration-requests/http/admin-dossier.controller.ts`, and `apps/backend/src/registration-requests/registration-requests.module.ts`
- [X] T068 [US8] Add sequential PostgreSQL integration tests proving no duplicate/omitted rows over stable pages, current status after refresh, confirmed-only inclusion, all seven origin types, typed optional passport links, and no mutation of confirmation/approval/deletion rows in `apps/backend/test/integration/administrator-dossiers.integration.spec.ts`
- [X] T069 [US8] Add dossier-specific privacy canaries asserting zero deleted evidence, object keys, digests, civil documents, contacts, credentials, transferred evidence categories, and inaccessible linked-resource data in responses/errors/log projections in `apps/backend/test/contract/administrator-dossier-privacy.contract.spec.ts`

### Dossier frontend block

- [X] T070 [US8] Add frontend API/state tests for direct menu entry, stable next/previous cursor stack, search/filters, loading/empty/no-results/restricted/unavailable/error states, retry, scroll restoration, linked navigation, `notApplicable`, and no persistent protected detail in `apps/frontend/src/administrator/dossiers/admin-dossiers-state.spec.ts` and `apps/frontend/src/administrator/administrator-api.spec.ts`
- [X] T071 [US8] Implement dossier API parsing and ephemeral list/detail navigation state with query/filter/page/scroll restoration in `apps/frontend/src/administrator/administrator-api.ts` and `apps/frontend/src/administrator/dossiers/admin-dossiers-state.ts`
- [X] T072 [US8] Add accessible component tests for responsive list/cards/table, filters, explicit empty/error states, detail confirmation history, request/passport links, focus restoration, touch targets, and structural absence of edit/confirm/approve/evidence controls in `apps/frontend/src/administrator/dossiers/admin-dossiers-list.spec.tsx` and `apps/frontend/src/administrator/dossiers/admin-dossier-detail.spec.tsx`
- [X] T073 [US8] Implement standalone dossier list/detail and routes inside the shared shell using confirmed read-only content only in `apps/frontend/src/administrator/dossiers/admin-dossiers-list.tsx`, `apps/frontend/src/administrator/dossiers/admin-dossier-detail.tsx`, `apps/frontend/app/(admin)/admin/dossiers/index.tsx`, and `apps/frontend/app/(admin)/admin/dossiers/[dossierId].tsx`
- [X] T074 [US8] Capture desktop/mobile browser output to ignored `.runtime/feature-007-visual/dossiers/`, compare only with the four dossier references while omitting out-of-scope pending/confirm actions, and record responsive/accessibility deviations without committing screenshots in `specs/007-administrator-requests-passport-custody/verification/dossiers-visual.md`

**Checkpoint**: Expedientes is independently searchable and navigable but strictly read-only and privacy-minimal.

---

## Phase 11: Final integration, privacy, accessibility, and scope verification

**Purpose**: Verify all stories together without expanding scope or rebuilding Feature 006.

- [X] T075 Verify the implementation matches all 11 Feature 007 paths, 29 closed schemas, `no-store` semantics, safe errors, and current generated API behavior while Feature 005/006 contracts remain unchanged in `apps/backend/test/contract/admin-custody-implementation.contract.spec.ts`
- [X] T076 Run final static/runtime privacy canary checks across custody/dossier/request responses, conflicts, logs, events, frontend state, routes, and completed-evidence retrieval attempts; record zero unauthorized protected values in `specs/007-administrator-requests-passport-custody/verification/privacy.md`
- [X] T077 Run the focused backend unit/contract suites, sequential PostgreSQL Feature 007 integration suites, frontend Administrator/Analyst Jest suites, and targeted typechecks; record commands/results without rerunning unrelated broad suites in `specs/007-administrator-requests-passport-custody/verification/backend-frontend.md`
- [X] T078 Execute all 13 synthetic journeys in `specs/007-administrator-requests-passport-custody/quickstart.md`, including Feature 006 regression, exact-once concurrency, immediate Analyst revocation, and read-only dossiers; record results in `specs/007-administrator-requests-passport-custody/verification/quickstart.md`
- [X] T079 Complete one-to-one browser comparison and accessibility verification for all 12 references under `docs/design/admin-custody/`, including desktop/mobile, keyboard, reader, focus, touch, non-color, reduced-motion, and no horizontal-scroll checks; keep screenshot binaries in ignored `.runtime/feature-007-visual/` and record results in `specs/007-administrator-requests-passport-custody/verification/visual-accessibility.md`
- [X] T080 Verify final artifact/implementation consistency and exclusions—no Feature 006 rule changes, dossier editing/confirmation, evidence recovery, duplicate passport creation, sports data, FEM execution, automatic/bulk custody, JWT-role authorization, or committed runtime screenshots—and record the completion gate in `specs/007-administrator-requests-passport-custody/verification/final-scope.md`

---

## Phase 12: Administrator acceptance corrections

**Purpose**: Correct the accepted Feature 007 read models, terminal-request navigation, and full-page Administrator background without changing Feature 006 approval rules.

- [X] T081 Add failing focused backend/frontend tests for authorized readable names on dossier/passport links in `apps/backend/src/registration-requests/review/admin-dossier-query.service.spec.ts`, `apps/backend/src/passport-custody/application/passport-custody-detail.service.spec.ts`, `apps/frontend/src/administrator/administrator-api.spec.ts`, `apps/frontend/src/administrator/dossiers/admin-dossier-detail.spec.tsx`, and `apps/frontend/src/administrator/custody/passport-custody-detail.spec.tsx`
- [X] T082 Implement authorized link labels in the closed contract and dossier/passport projections without exposing protected identity fields in `specs/007-administrator-requests-passport-custody/contracts/admin-custody.openapi.yaml`, `apps/backend/src/registration-requests/review/admin-dossier-query.service.ts`, `apps/backend/src/passport-custody/application/passport-custody-detail.service.ts`, `apps/frontend/src/administrator/administrator-api.ts`, `apps/frontend/src/administrator/dossiers/admin-dossier-detail.tsx`, and `apps/frontend/src/administrator/custody/passport-custody-detail.tsx`
- [X] T083 Add failing focused frontend tests for terminal approved-request read-only presentation, absence of decision/evidence controls, and Administrator-shell navigation in `apps/frontend/src/administrator/requests/admin-terminal-request-detail.spec.tsx` and `apps/frontend/src/administrator/requests/admin-terminal-request-routing.spec.ts`
- [X] T084 Implement terminal-request read-only detail inside the shared Administrator shell while preserving actionable Feature 006 review routing in `apps/frontend/src/administrator/requests/admin-terminal-request-detail.tsx`, `apps/frontend/src/administrator/requests/admin-terminal-request-routing.ts`, `apps/frontend/src/registration-requests/admin/admin-request-review.tsx`, `apps/frontend/app/(admin)/registration/[requestId]/index.tsx`, and `apps/frontend/app/(admin)/admin/registration/[requestId]/index.tsx`
- [X] T085 Add focused shell coverage and implement viewport/document-height background styling across Administrator routes without enlarging the image in `apps/frontend/src/administrator/shell/administrator-shell.spec.tsx`, `apps/frontend/src/administrator/shell/administrator-shell.tsx`, and the existing Feature 006 Administrator screen backgrounds
- [X] T086 Run affected backend/frontend tests, relevant typechecks, web export, `git diff --check`, and authenticated desktop/mobile browser verification including bottom-of-page scrolling; leave manual acceptance pending

---

## Phase 13: Dossier-linked navigation acceptance corrections

**Purpose**: Preserve dossier context across linked request/passport consultation, reject reference-shaped names when an authorized readable name is available, and remove the obsolete standalone request-review presentation.

- [X] T087 Add focused failing tests for dossier return context, contextual back labels, readable-name candidate selection, and absence of the legacy standalone request shell
- [X] T088 Implement explicit dossier return routing for linked request/passport views, authoritative readable-name selection, and one shared-shell request detail implementation
- [X] T089 Run affected tests/typechecks/export/diff checks, verify desktop/mobile dossier round trips in the authenticated app, and leave PostgreSQL, ClamAV, backend, and frontend running for manual acceptance

---

## Dependencies and execution order

## Phase 14: Dossier-name persistence acceptance correction

- [X] T090 Add focused failing approval DTO/service, dossier query/search, frontend API/component, and PostgreSQL integration tests for exact `dossierName`, validation, legacy null, and non-inference.
- [X] T091 Add nullable dossier-name persistence, pass the form value through the existing approval transaction, and expose/search it only in authorized dossier list/detail projections; update the affected contracts without changing approval decisions.
- [X] T092 Apply a narrowly targeted idempotent local correction only to dossier `74dc9bc0-0a0f-4930-80a4-c0cd882b754d` with `exp-prueba-001`, verify storage, and leave all other legacy names null.
- [X] T093 Verify named dossier list/detail/search and a newly confirmed dossier in the authenticated localhost app; run only affected tests, typechecks, and `git diff --check`.

---

### Phase dependencies

1. Phase 1 establishes contract and fixture guardrails.
2. Phase 2 depends on Phase 1 and blocks every user story.
3. Phase 3 (US1 requests workspace) depends only on Phase 2.
4. Phase 4 (US2 initial custody) depends on Phase 2 and blocks US3, US4, US5, US6, and US7.
5. Phase 5 (US3 confirmation UX) and Phase 6 (US4 change/remove) may proceed in parallel after US2 because they primarily touch separate frontend and backend files; their shared state/service edits must be serialized.
6. Phase 7 (US5 concurrency) depends on US2 and backend transitions from US4.
7. Phase 8 (US7 Analyst access) depends on US2 and US4 so grant and both revocation paths exist.
8. Phase 9 (US6 detail/history) depends on US2 and US4; it does not require US5 to begin, but its final integration uses the exact-once behavior.
9. Phase 10 (US8 dossiers) depends only on Phase 2 and may run in parallel with Phases 3–9 because it is a read model over existing Feature 006 data.
10. Phase 11 depends on every selected story phase.

### User story dependencies

| Story | Earliest dependencies | Independent completion test |
|---|---|---|
| US1 Requests workspace | Foundation | Five exact groups, minimum cards, full list, and existing Feature 006 action outcomes unchanged. |
| US2 Initial assignment | Foundation | One existing active basic passport becomes assigned once with workload +1 and one event. |
| US3 Safe confirmation | US2 | Drop/button/keyboard select only; cancel/no reason do not mutate; confirm does. |
| US4 Change/remove | US2 | A→B→unassigned updates one authority, loads, access, and one event per transition. |
| US5 Conflict/retry | US2 + US4 backend | Concurrent/replayed/failed commands produce one authoritative state/event and recoverable loser. |
| US7 Analyst access | US2 + US4 | Only current custodian lists/opens; change/remove revoke immediately. |
| US6 Detail/history | US2 + US4 | Administrator sees current custody, safe ordered history, and authorized links. |
| US8 Dossier consultation | Foundation | Stable confirmed-only pages and safe read-only detail/navigation with no evidence or actions. |

### Within each block

- Write the focused failing test task first and confirm it fails for the intended reason.
- Complete its immediately following implementation task before opening another shared-file block.
- Apply Prisma schema before migration, and migration before PostgreSQL integration suites.
- Run PostgreSQL suites sequentially with independent clients; never mark them parallel.
- Frontend visual verification follows component behavior and accessibility tests, not the reverse.

### Parallel opportunities

- T001 and T002 may run in parallel.
- After Phase 2, US1 and US8 are independent of the custody command stream.
- Within US2, query tests can be prepared separately from command tests, but implementations converge before controller wiring.
- After US2, US3 frontend confirmation and US4 backend transitions can proceed in parallel until shared state/service files are edited.
- US6 history mapper work can begin after US4 while US5 concurrency and US7 authorization proceed in separate files.
- Browser visual checks for requests, custody, passport detail, and dossiers use separate ignored output folders and verification documents.

## Parallel execution examples

### After foundation

```text
Stream A: T011–T020 — US1 operational requests workspace
Stream B: T021–T031 — US2 initial custody assignment
Stream C: T064–T074 — US8 read-only dossier consultation
```

### After initial assignment

```text
Stream A: T032–T036 — US3 accessible confirmation interaction
Stream B: T037–T043 — US4 change/remove backend and frontend
```

### After change/remove

```text
Stream A: T044–T048 — US5 concurrency and idempotent retry
Stream B: T049–T056 — US7 current-custody Analyst authorization
Stream C: T057–T063 — US6 detail and history
```

---

## Requirements coverage

| Requirements | Primary tasks |
|---|---|
| FR-001–FR-007 | T011–T020, T075, T080 |
| FR-008–FR-014 | T021–T031 |
| FR-015–FR-020 | T032–T036, T042–T043 |
| FR-021–FR-030 | T023–T027, T037–T048 |
| FR-031–FR-038 | T049–T069, T076 |
| FR-039–FR-044 | T017–T020, T030–T036, T061–T063, T072–T074, T079 |
| FR-045–FR-054 | T064–T074, T075–T080 |

## Success-criterion coverage

| Success criteria | Verification tasks |
|---|---|
| SC-001–SC-003 | T011–T020, T064–T074, T078 |
| SC-004–SC-006 | T028–T036, T078–T079 |
| SC-007–SC-012 | T023–T056, T077–T078 |
| SC-013–SC-015 | T057–T063, T069, T076, T079 |
| SC-016–SC-019 | T064–T080 |

## Visual-reference coverage

| Approved references | Tasks |
|---|---|
| Administrator home desktop/mobile | T017–T018, T079 |
| Registration requests desktop/mobile | T017–T020, T079 |
| Dossiers list/detail desktop/mobile | T072–T074, T079 |
| Passport custody workspace desktop/mobile | T030–T036, T079 |
| Administrator passport detail desktop/mobile | T061–T063, T079 |

**Coverage**: 12 of 12 references under `docs/design/admin-custody/`; zero Feature 006 visual references.

---

## Implementation strategy

### First implementation block

1. Complete Phase 1 contract/fixture guardrails.
2. Complete Phase 2 schema, migration, invariants, authorization, and Analyst operational profiles.
3. Stop and verify the foundation before any UI or custody command work.

### First usable slice

1. Complete the first implementation block.
2. Complete US1 for the redesigned requests workspace.
3. Complete US2 and US3 for one safely confirmed initial assignment.
4. Validate these stories independently; do not claim Feature 007 complete.

### Full delivery

1. Add US4 and US5 for change/remove/concurrency.
2. Add US7 for custody-scoped Analyst access.
3. Add US6 and US8 for audit/detail and dossier consultation.
4. Pass Phase 11 gates without expanding scope.

## Scope guardrails

- Reuse Feature 006 review, correction, rejection, dossier confirmation, evidence deletion, approval, and outcome creation; do not create replacement services or endpoints.
- Expedientes is confirmed-record consultation only; do not implement edit, confirm, approve, retry deletion, or evidence retrieval there.
- Custody operates on the existing passport and never creates another passport, role, membership, responsibility, sports data, or FEM result.
- Role labels and frontend controls never authorize; re-evaluate backend facts at execution/read time.
- Use only `docs/design/admin-custody/` for visual comparison and keep runtime screenshots out of Git.
- Use synthetic canaries only; never add real personal data, credentials, document bytes, object keys, or deleted evidence to fixtures or verification artifacts.
