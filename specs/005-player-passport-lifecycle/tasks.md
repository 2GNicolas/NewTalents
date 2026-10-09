---

description: "Task list for Feature 005: vertical player passport lifecycle"
---

# Tasks: Pasaporte del jugador — ciclo de vida y experiencia vertical

**Input**: Design documents from `specs/005-player-passport-lifecycle/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`,
`contracts/passport-lifecycle.openapi.yaml`, `contracts/lifecycle-authorization.md`,
`contracts/frontend-passport-presentation.md`

**Tests**: Included because the governing task request requires tests to be written before the
corresponding implementation and each phase to end with a verification checkpoint.

**Format**: `- [ ] [TaskID] [P?] [Story?] Description with exact file path`

## Phase 1: Persistence and secure runtime configuration

**Purpose**: Establish the additive Feature 005 data layer, reviewed migration constraints, and the
three fail-closed passport secrets before any domain or frontend work begins.

**Entry dependency**: None.

### Tests for Phase 1

- [X] T001 [P] Write passport key validation tests in `apps/backend/src/player-passport/player-private-identity/passport-keys.spec.ts` covering accepted base64 32-byte keys and fail-closed rejection of absent, placeholder, wrong-length, and non-base64 values.
- [X] T002 Write database schema integration test in `apps/backend/test/integration/passport-schema.e2e-spec.ts` asserting `Player`, `PlayerPrivateIdentity`, `PlayerPassport`, `InitialTutorResponsibility`, `PassportReviewReturn`, `PassportPossibleDuplicateSignal`, and `PassportLifecycleEvent`, the `ageCategory`, `city`, `country`, and `dominantFoot` columns on `PlayerPassport`, plus the unique confirmed-duplicate fingerprint, indexed name/DOB fingerprint, origin `CHECK`, and immutable lifecycle-event trigger with no photograph column or media reference.

### Implementation for Phase 1

- [X] T003 Add Feature 005 enums and Prisma models to `apps/backend/prisma/schema.prisma` exactly per `data-model.md`, including `ageCategory`, `city`, `country`, and `dominantFoot` on `PlayerPassport`, preserving one-to-one Player/Passport/PrivateIdentity, origin fields, append-only trace intent, and no photograph/media persistence.
- [X] T004 Add reviewed migration `apps/backend/prisma/migrations/20260916000000_player_passport_lifecycle/migration.sql` with the Tutor/Academy origin `CHECK` and immutable `UPDATE`/`DELETE` trigger without rewriting any existing migration.
- [X] T005 Implement fail-closed key loading in `apps/backend/src/player-passport/player-private-identity/passport-keys.ts` using `node:crypto` base64 decoding and exact 32-byte validation.
- [X] T006 Require `PASSPORT_DOCUMENT_HMAC_KEY`, `PASSPORT_NAME_DOB_HMAC_KEY`, and `PASSPORT_PRIVATE_ENCRYPTION_KEY` in `apps/backend/src/config/environment.schema.ts` and extend `apps/backend/src/config/environment.schema.spec.ts` with invalid-value cases.
- [X] T007 From `apps/backend`, run `npx prisma migrate deploy`, verify migration status, run `npm run prisma:generate` and `npm run typecheck`, and execute `npx vitest run test/integration/passport-schema.e2e-spec.ts`; confirm generated types appear in `apps/backend/src/generated/prisma`.

**Checkpoint**: Prisma generation and typecheck pass; `apps/backend/test/integration/passport-schema.e2e-spec.ts` proves the additive schema and database constraints.

---

## Phase 2: Private player identity, encryption, fingerprints, and duplicate constraints

**Purpose**: Implement normalization, keyed fingerprint generation, AES-256-GCM protection, and
non-recoverable identity storage that powers confirmed- and possible-duplicate behavior.

**Entry dependency**: Phase 1.

### Tests for Phase 2

- [X] T008 [P] [US1] Write normalization tests in `apps/backend/src/player-passport/player-private-identity/identity-normalization.spec.ts` for exact trim, case, and canonicalization rules and no raw document-number retention in output.
- [X] T009 [P] [US1] Write fingerprint tests in `apps/backend/src/player-passport/player-private-identity/fingerprint.spec.ts` proving determinism, separate keys for document and name/DOB, and no recoverable input in the fingerprint value.
- [X] T010 [P] [US1] Write crypto tests in `apps/backend/src/player-passport/player-private-identity/passport-crypto.spec.ts` covering roundtrip, tamper detection, and unique 12-byte IV per encryption.
- [X] T011 [P] [US1] Write service tests in `apps/backend/src/player-passport/player-private-identity/private-identity.service.spec.ts` proving ciphertext plus both fingerprints are produced and no raw document number is returned.

### Implementation for Phase 2

- [X] T012 [US1] Implement normalization in `apps/backend/src/player-passport/player-private-identity/identity-normalization.ts`.
- [X] T013 [US1] Implement keyed HMAC-SHA256 fingerprints in `apps/backend/src/player-passport/player-private-identity/fingerprint.ts`.
- [X] T014 [US1] Implement AES-256-GCM encryption and decryption in `apps/backend/src/player-passport/player-private-identity/passport-crypto.ts`.
- [X] T015 [US1] Implement `apps/backend/src/player-passport/player-private-identity/private-identity.service.ts` to encrypt legal name, date of birth, document type, and document number and return only stored projections plus fingerprints.

**Checkpoint**: Run `npx vitest run src/player-passport/player-private-identity` from `apps/backend`; all Phase 2 tests pass and no raw document value enters a return type or diagnostic.

---

## Phase 3: Passport lifecycle, Tutor responsibility, Academy origin, duplicate review, and immutable trace

**Purpose**: Implement domain transactions and services that enforce lifecycle transitions,
atomic initial Tutor responsibility, Academy origin, possible-duplicate resolution, and append-only
trace redaction.

**Entry dependency**: Phase 2.

### Tests for Phase 3

- [X] T016 [P] [US1] Write lifecycle creation tests in `apps/backend/src/player-passport/passport-lifecycle/passport-lifecycle.service.spec.ts` proving atomic Tutor creation with initial responsibility and Academy creation with origin only.
- [X] T017 [P] [US2] Write transition tests in `apps/backend/src/player-passport/passport-lifecycle/passport-transition.service.spec.ts` proving edit/submit/return/resubmit rules and rejection of edits while `En revisión`.
- [X] T018 [P] [US3] Write duplicate review tests in `apps/backend/src/player-passport/duplicate-review/duplicate-review.service.spec.ts` proving `DIFFERENT_PLAYERS`, `CORRECTABLE`, and `CONFIRMED_EXISTING_PLAYER` resolution and the unresolved-signal approval block.
- [X] T019 [P] [US4] Write trace redaction tests in `apps/backend/src/player-passport/passport-lifecycle/passport-trace.service.spec.ts` proving actor/moment/action/prior/resulting state and absence of identity-document values and candidate details.
- [X] T020 [P] [US1] Write transaction retry tests in `apps/backend/src/player-passport/passport-lifecycle/transaction-runner.spec.ts` proving only `P2034` retries for three total attempts with no-jitter waits of 50 ms then 100 ms.

### Implementation for Phase 3

- [X] T021 [US1] Implement `apps/backend/src/player-passport/passport-lifecycle/transaction-runner.ts` for `Serializable` interactive transactions and the approved three-attempt `P2034` policy.
- [X] T022 [US1] Implement `apps/backend/src/player-passport/passport-lifecycle/passport-lifecycle.service.ts` for atomic Player, PrivateIdentity, Passport, initial responsibility, academy origin, and creation trace.
- [X] T023 [US2] Implement `apps/backend/src/player-passport/passport-lifecycle/passport-transition.service.ts` for edit, submit, return, and resubmit with conditional state/version writes.
- [X] T024 [US3] Implement `apps/backend/src/player-passport/duplicate-review/duplicate-review.service.ts` for possible-duplicate signal creation and Analyst resolution without a new lifecycle state.
- [X] T025 [US4] Implement `apps/backend/src/player-passport/passport-lifecycle/passport-trace.service.ts` for immutable redacted lifecycle events.

**Checkpoint**: Run `npx vitest run src/player-passport` from `apps/backend`; all Phase 3 domain tests pass, including rollback and redaction assertions.

---

## Phase 4: Authorization, authenticated HTTP operations, DTOs, and presentation capabilities

**Purpose**: Extend Feature 002 authorization, add the Feature 003 guarded HTTP surface, and
project safe lifecycle, list, trace, and presentation DTOs with backend-derived capabilities.

**Entry dependency**: Phase 3.

### Tests for Phase 4

- [X] T026 [P] [US6] Write authorization adapter tests in `apps/backend/src/player-passport/passport-authorization/passport-authorization.adapter.spec.ts` proving role, membership, relationship, and capability facts are loaded without reading JWT claims or request body.
- [X] T027 [P] [US6] Write presentation mapper tests in `apps/backend/src/player-passport/http/passport-presentation-mapper.spec.ts` proving capabilities derivation, inclusion of display name, position, age category, city, country, dominant foot, academy-of-origin name or unavailable, and `neutral-placeholder` photograph state, plus exclusion of date of birth, document values, fingerprints, precise location, candidates, and authorization mechanics.
- [X] T028 Write HTTP contract test `apps/backend/test/contract/passport-lifecycle.contract-spec.ts` covering all eleven operations, bearer security, status codes, no-store headers, profile-field DTOs, dominant-foot validation, academy available/unavailable projection, photograph-placeholder state, and non-disclosure error shapes.
- [X] T029 Write PostgreSQL integration test `apps/backend/test/integration/passport-lifecycle.e2e-spec.ts` covering full lifecycle, authorization, rollback, basic-profile persistence, academy available/unavailable projection, photograph-free storage, and non-disclosure against real PostgreSQL.

### Implementation for Phase 4

- [X] T030 [US6] Add the nine Feature 005 permissions to `apps/backend/src/authorization/permission-catalog.ts` exactly as defined in `contracts/lifecycle-authorization.md`.
- [X] T031 [US6] Implement `apps/backend/src/player-passport/passport-authorization/passport-authorization.adapter.ts` to assemble identity status, roles, academy membership, tutor relationship, and resource facts before delegating to `AuthorizationService`.
- [X] T032 [US1] Implement create-draft DTO and request mapping in `apps/backend/src/player-passport/http/passport.dto.ts` with required legal name, date of birth, document type, document number, position, age category, city, country, and dominant foot fields; validate dominant foot against `Izquierda`, `Derecha`, `Ambos`, and `No declarado`.
- [X] T033 [US2] Implement edit/submit/return request DTOs and state-aware validation in `apps/backend/src/player-passport/http/passport.dto.ts`, rejecting address/coordinates/neighborhood content in city or country and any dominant-foot value outside the approved enum.
- [X] T034 [US3] Implement duplicate-resolution and approval/activation request DTOs in `apps/backend/src/player-passport/http/passport.dto.ts`.
- [X] T035 [US5] Implement list, status, trace, and presentation response DTOs plus `capabilities` projection in `apps/backend/src/player-passport/http/passport-presentation-mapper.ts`, exposing authorized display name, position, age category, city, country, dominant foot, academy-of-origin name when applicable or unavailable, and `neutral-placeholder` photograph state without date of birth, document values, fingerprints, precise location, or contact data.
- [X] T036 [US1] Implement `apps/backend/src/player-passport/http/passport.controller.ts` using the Feature 003 guard and reading only `actor.identityId` and `actor.sessionId`.
- [X] T037 [US2] Implement edit/submit/return endpoints in `apps/backend/src/player-passport/http/passport.controller.ts` with `passport_not_found` for unauthorized and nonexistent lookups.
- [X] T038 [US3] Implement possible-duplicate resolution, approve, and activate endpoints in `apps/backend/src/player-passport/http/passport.controller.ts`.
- [X] T039 [US4] Implement status, list, history, and presentation endpoints with `Cache-Control: no-store` in `apps/backend/src/player-passport/http/passport.controller.ts`.
- [X] T040 Register `PlayerPassportModule` in `apps/backend/src/player-passport/player-passport.module.ts` and import it from `apps/backend/src/app.module.ts`.

**Checkpoint**: Run `npm run test:unit --workspace=@new-talents/backend`, `npm run test:contract --workspace=@new-talents/backend`, and `npm run test:integration --workspace=@new-talents/backend` from the repository root; all Phase 4 tests pass.

---

## Phase 5: Frontend typed API, state boundary, forms, and role-specific lifecycle interfaces

**Purpose**: Add the typed passport API/state boundary over Feature 004 authentication and the
capability-gated forms and routes for Tutor, Academy User, Analyst, and Administrator operations.

**Entry dependency**: Phase 4.

### Tests for Phase 5

- [X] T041 [P] [US6] Write typed API mapping tests in `apps/frontend/src/passport/passport-api.spec.ts` for success, validation, not-found-safe, forbidden, connectivity, and unavailable categories without JWT decoding.
- [X] T042 [P] [US6] Write passport state tests in `apps/frontend/src/passport/passport-state.spec.ts` for list, active passport, capability gating, one in-flight mutation, and secret cleanup.
- [X] T043 [P] [US1] Write draft form validation tests in `apps/frontend/tests/passport/draft-form.spec.tsx` for required/category-correct fields, declared age category, city/country without address or coordinates, dominant-foot enum, document normalization, and blocked incomplete submission.
- [X] T044 [P] [US6] Write role interface tests in `apps/frontend/tests/passport/role-interfaces.spec.tsx` proving actions render only when backend capabilities contain them.

### Implementation for Phase 5

- [X] T045 [US6] Define Feature 005 frontend types in `apps/frontend/src/passport/passport-types.ts` mirroring the OpenAPI schemas and action enum, including `DominantFoot`, basic profile fields, academy-origin presentation, and `neutral-placeholder` photograph state.
- [X] T046 [US6] Implement typed API client `apps/frontend/src/passport/passport-api.ts` over the existing Feature 004 bearer/session boundary.
- [X] T047 [US6] Implement capability-gated state and intents in `apps/frontend/src/passport/passport-state.ts` without duplicating authentication state.
- [X] T048 [US6] Implement nested authenticated passport layouts in `apps/frontend/app/(authenticated)/passports/_layout.tsx` and `apps/frontend/app/(authenticated)/passports/[passportId]/_layout.tsx` for the list/create boundary and persistent passport identity shell without modifying Feature 004's authenticated root layout ownership.
- [X] T049 [US1] Implement passport list route in `apps/frontend/app/(authenticated)/passports/index.tsx`.
- [X] T050 [US1] Implement accessible draft creation form in `apps/frontend/app/(authenticated)/passports/new.tsx` and `apps/frontend/src/passport/forms/draft-form.tsx` with position, declared age category, city, country, and dominant-foot fields.
- [X] T051 [US2] Implement draft editing and submission/correction forms in `apps/frontend/src/passport/forms/draft-form.tsx` and route `apps/frontend/app/(authenticated)/passports/[passportId]/edit.tsx`.
- [X] T052 [US3] Implement Analyst review, duplicate resolution, return, and approval routes in `apps/frontend/app/(authenticated)/passports/[passportId]/review.tsx`.
- [X] T053 [US3] Implement Administrator activation route in `apps/frontend/app/(authenticated)/passports/[passportId]/activate.tsx`.
- [X] T054 [US4] Implement status/trace view in `apps/frontend/src/passport/status-view.tsx` and integrate it with `apps/frontend/app/(authenticated)/passports/[passportId]`.
- [X] T055 [US6] Implement secret-safe error mapping and diagnostics in `apps/frontend/src/passport/passport-api.ts` with no document, fingerprint, candidate, token, session, precise location, photograph reference, or internal denial reason in route/error/analytics surfaces.

**Checkpoint**: Run `npm run test:frontend` from the repository root; all Phase 5 frontend tests pass and no route or state component decodes JWT roles.

---

## Phase 6: Responsive player-passport presentation for mobile and web

**Purpose**: Deliver the approved liquid-glass presentation shell, persistent player identity, and
Resumen/Estadísticas/Partidos/Videos navigation with explicit empty or unavailable states.

**Entry dependency**: Phase 5.

### Tests for Phase 6

- [X] T056 [P] [US5] Write section availability tests in `apps/frontend/src/passport/presentation/availability.spec.ts` and designed-state regression tests in `apps/frontend/tests/passport/passport-section-content.spec.tsx` proving missing data, unavailable academy, and photograph placeholder are never mapped to zero, inferred capability, statistic, evaluation, or sports claim; empty/restricted states and corrupt/technical presentation text remain safe.
- [X] T057 [P] [US5] Write navigation tests in `apps/frontend/tests/passport/passport-navigation.spec.tsx` proving persistent identity and mobile horizontal tabs below the identity area.
- [X] T058 [P] [US5] Write desktop navigation tests in `apps/frontend/tests/passport/passport-navigation.spec.tsx` proving vertical navigation below player information in the left column and never above main content.
- [X] T059 [P] [US5] Write accessibility tests in `apps/frontend/tests/passport/passport-accessibility.spec.tsx` covering keyboard, screen-reader labels, visible focus, field-associated errors, contrast, touch targets, and reduced motion.

### Implementation for Phase 6

- [X] T060 [US5] Implement section availability projection in `apps/frontend/src/passport/presentation/availability.ts`, including academy `available`/`unavailable` and `neutral-placeholder` photograph state.
- [X] T061 [US5] Implement section registry for Resumen, Estadísticas, Partidos, and Videos in `apps/frontend/src/passport/presentation/sections.ts`.
- [X] T062 [US5] Implement persistent player identity area in `apps/frontend/src/passport/presentation/player-identity.tsx` rendering display name, position, declared age category, city, country, dominant foot, academy-of-origin name when applicable or unavailable, and a neutral photograph placeholder with no upload or inactive controls.
- [X] T063 [US5] Implement responsive mobile/web navigation in `apps/frontend/src/passport/presentation/passport-nav.tsx` with the approved platform-specific placement.
- [X] T064 [US5] Implement Resumen, Estadísticas, Partidos, and Videos section routes under `apps/frontend/app/(authenticated)/passports/[passportId]/sections/`, with `section-screen.tsx`, `section-content.tsx`, and the responsive presentation shell in `apps/frontend/src/passport/presentation/`; reuse the design-system liquid-glass surface with isolated passport theme/icon assets, preserving the approved platform-specific navigation and never inventing future data.
- [X] T065 [US5] Implement loading, empty, unavailable, restricted, validation, Borrador, presentado/En revisión, Devuelto, Aprobado, and Activo presentation states in `apps/frontend/src/passport/presentation/status.tsx`; a confirmed duplicate that prevents continuation uses `No disponible` with no new lifecycle state.

**Checkpoint**: Run `npm run test:frontend` and `npm run export:web --workspace=@new-talents/frontend` from the repository root; the web export succeeds and responsive tests pass.

**Phase 6 visual correction revalidated (2026-09-16)**: `design-qa.md` reports `final result: passed` after eight source/runtime comparisons and focused identity/navigation comparisons. T056–T065 remain checked only for their Phase 6 scope. Focused presentation gates: 4 suites / 26 tests passed. Full frontend: 33 suites / 130 tests passed, 2 existing skipped. Frontend typecheck, sequential Expo Web export (28 static routes), and `git diff --check` passed. Local PostgreSQL, backend 3000, and Expo Web 8081 remain running. This checkpoint does not start Phase 7 or resolve the deferred adult/minor domain correction.

---

## Phase 7: Corrective contract and policy tests

**Purpose**: Encode the approved USER/relationship, Colombia/18, academy and privacy correction as failing tests before implementation.

**Entry dependency**: Phase 6 and the reconciled Feature 005 design artifacts.

- [X] T066 [P] [US1] Write backend unit tests for Colombia calendar age evaluation, exact 18th birthday, future/invalid dates, client-clock disagreement and 29-February/1-March handling in `apps/backend/src/player-passport/age-policy/passport-age-policy.service.spec.ts`.
- [X] T067 [P] [US1] Write authorization unit tests proving USER requires SELF or LEGAL_REPRESENTATIVE, TUTOR alone grants nothing, ACADEMY_USER requires current academy membership, and creator identity is irrelevant to academy management in `apps/backend/src/player-passport/authorization/passport-authorization.adapter.spec.ts`.
- [X] T068 [P] [US1] Write Prisma/schema contract tests for USER, PARTICULAR, responsibility cardinalities, representative-confirmation consumption and preservation of historical TUTOR facts in `apps/backend/test/contract/player-passport-corrective-schema.contract-spec.ts`.
- [X] T069 [P] [US1] Extend HTTP contract tests for representation confirmation, SELF/LEGAL_REPRESENTATIVE/ACADEMY creation, private draft detail/edit, explicit list context and separate ordinary/internal histories in `apps/backend/test/contract/player-passport.contract-spec.ts`.
- [X] T070 [US1] Write sequential PostgreSQL integration tests for atomic adult SELF creation, represented-minor creation, academy-minor confirmation, confirmation mismatch/expiry/reuse, one SELF passport per identity and exact-document concurrency in `apps/backend/test/integration/player-passport-responsibility.integration-spec.ts`.
- [X] T071 [P] [US4] Write mapper/service/HTTP privacy tests proving ordinary owner/representative/academy history and responses omit possible-duplicate detection, resolution, candidate existence/IDs, fingerprints, documents, matching reasons and workflow details, while authorized Analyst review receives only its minimum projection and immutable redacted trace remains available solely through internal audit in `apps/backend/src/player-passport/presentation/passport-history.mapper.spec.ts` and `apps/backend/test/contract/player-passport-history-privacy.contract-spec.ts`.
- [X] T072 [P] [US5] Write frontend routing tests proving one particular passport opens Resumen, several open a selector, Academy always opens its portfolio, mixed contexts stay separate and Active opens Resumen in `apps/frontend/tests/passport/passport-entry-routing.spec.tsx`.
- [X] T073 [P] [US1] Write frontend form/contract tests for SELF, represented minor, academy confirmation, server-derived age messaging, protected birth-date correction and absence of authoritative `isAdult` in `apps/frontend/tests/passport/passport-responsibility-forms.spec.tsx`.
- [X] T074 [P] [US6] Write reconciliation tests proving historical TUTOR processing is explicit, idempotent, append-only, never infers SELF and does not authorize incomplete facts in `apps/backend/src/player-passport/reconciliation/historical-tutor-reconciliation.service.spec.ts`.
- [X] T075 [P] [US6] Extend authentication/session regression tests so controlled USER eligibility uses existing login/renewal/revocation behavior and never creates roles or relationships during authentication in `apps/backend/src/authentication/session.service.spec.ts` and `apps/backend/test/integration/session-auth.integration-spec.ts`.

**Checkpoint**: Corrective tests fail for the intended missing behavior without changing completed T001–T065 evidence.

---

## Phase 8: Corrective persistence and domain foundations

**Purpose**: Add the minimum compatible persistence and domain services required by the failing Phase 7 tests.

**Entry dependency**: Phase 7.

- [X] T076 [US1] Extend `apps/backend/prisma/schema.prisma` with USER, PARTICULAR, PassportResponsibility, private representative confirmation, controlled reconciliation audit and authorized Academy display-name fields while retaining TUTOR, historical origin and InitialTutorResponsibility.
- [X] T077 [US1] Add and review one additive Feature 005 correction migration under `apps/backend/prisma/migrations/` with responsibility/SELF uniqueness, single-use confirmation, origin integrity and lookup indexes; do not rewrite existing migrations or historical rows.
- [X] T078 [US1] Implement the injected Colombia/18 age-policy service in `apps/backend/src/player-passport/age-policy/` and use calendar-date semantics rather than elapsed-hour arithmetic.
- [X] T079 [US1] Implement encrypted representative identity plus keyed player-document binding and 24-hour single-use confirmation storage in `apps/backend/src/player-passport/representation/`, reusing the existing passport crypto boundary.
- [X] T080 [US1] Implement responsibility persistence and invariants for SELF, LEGAL_REPRESENTATIVE and ACADEMY in `apps/backend/src/player-passport/responsibility/`, including one SELF passport per identity and no academy-as-representative inference.
- [X] T081 [US6] Implement the explicit idempotent historical TUTOR reconciliation service/command in `apps/backend/src/player-passport/reconciliation/`, preserving old role/origin/responsibility/audit facts and appending only secret-safe outcomes.
- [X] T082 [US5] Extend authorized academy persistence/fixtures with a display name only, without contact duplication, in `apps/backend/prisma/schema.prisma` and Feature 002-compatible academy mappers.

**Checkpoint**: Phase 7 domain/schema tests pass; migration SQL is additive, reviewed and preserves historical interpretation.

---

## Phase 9: Corrected backend authorization, lifecycle and contracts

**Purpose**: Replace creator/TUTOR authority assumptions with current relationship, membership, age and capability facts.

**Entry dependency**: Phase 8.

- [X] T083 [US6] Extend `apps/backend/src/authorization/permission-catalog.ts` and role catalog with generic USER particular capabilities, explicit academy/history capabilities and relationship-gated compatibility aliases for legacy passport.tutor permissions.
- [X] T084 [US6] Include USER in controlled account/session eligibility where TUTOR was previously enumerated, without changing token, login, renewal, storage, revocation or logout mechanisms in `apps/backend/src/authentication/`.
- [X] T085 [US6] Refactor `apps/backend/src/player-passport/authorization/passport-authorization.adapter.ts` to evaluate SELF, LEGAL_REPRESENTATIVE, active academy membership, Colombia age and classification; remove `createdByIdentityId` as academy ownership and deny TUTOR-only access.
- [X] T086 [US5] Implement explicit PARTICULAR selector and ACADEMY portfolio queries in `apps/backend/src/player-passport/`, ensuring contexts cannot be merged and academy lists do not depend on the creating employee.
- [X] T087 [US1] Refactor draft creation to atomically establish player, PARTICULAR/ACADEMY origin, required responsibilities, representative confirmation consumption, duplicate signal and trace in `apps/backend/src/player-passport/player-passport.service.ts` and supporting services.
- [X] T088 [US2] Implement protected draft-detail retrieval and editable private identity/date/profile updates with re-normalization, duplicate safety and relationship/age compatibility checks in `apps/backend/src/player-passport/`.
- [X] T089 [US2] Reevaluate Colombia age and current authority during submit, resubmit and every age-sensitive mutation; return safe No disponible after majority without creating SELF, transfer, account or lifecycle state in `apps/backend/src/player-passport/transitions/`.
- [X] T090 [US4] Implement structurally separate ordinary and internal history projections/endpoints; filter all duplicate detection/resolution events and details from particular/academy history without deleting immutable audit in `apps/backend/src/player-passport/presentation/` and `player-passport.controller.ts`.
- [X] T091 [US5] Populate authorized academy-of-origin display name in passport presentation while retaining explicit unavailable for PARTICULAR and never exposing academy contact data in `apps/backend/src/player-passport/presentation/passport-presentation.mapper.ts`.
- [X] T092 [US1] Implement representative-confirmation and corrected lifecycle request/response DTOs/controllers exactly as `contracts/passport-lifecycle.openapi.yaml`, rejecting extra `isAdult`, context-conflicting and academy-confirmed representation inputs.
- [x] T093 [US3] Re-run and satisfy lifecycle separation tests so Analyst review/duplicate resolution/approval and Administrator activation remain independently capability-gated after the authorization refactor.
- [x] T094 [US1] Update Feature 005 contract snapshots/fixtures to the reconciled OpenAPI and verify all protected responses remain `no-store` and non-disclosing in `apps/backend/test/contract/player-passport.contract-spec.ts`.

**Checkpoint**: Backend unit, contract and sequential integration suites pass for corrected authority, age, privacy and lifecycle behavior.

---

## Phase 10: Corrected authenticated web/mobile experience

**Purpose**: Expose the corrected backend contracts without changing the approved passport composition.

**Entry dependency**: Phase 9.

- [X] T095 [US5] Update `apps/frontend/src/passport/passport-types.ts`, `passport-api.ts` and `passport-state.ts` for explicit particular/academy contexts, responsibilities, representation confirmation, private draft data and separate history projections.
- [X] T096 [US1] Extend `apps/frontend/src/passport/forms/draft-form.tsx` and the new-passport route with SELF, represented-minor and academy-minor flows; require representative-owned confirmation and explain server-derived age without an authority checkbox.
- [X] T097 [US2] Extend the protected edit route/form to correct authorized private identity and date-of-birth fields only in editable states, surface relationship incompatibility safely and keep those fields out of presentation/status diagnostics.
- [X] T098 [US5] Refactor authenticated passport entry routing so one particular passport opens Resumen independent of create capability, several open an explicit selector, and Active always opens Resumen with status/history secondary.
- [X] T099 [US5] Implement separate particular player selector and academy portfolio components/routes; academy always receives its portfolio even with one item and mixed-role identities switch context explicitly.
- [X] T100 [US4] Update status/history UI to consume only ordinary filtered history for particular/academy users and the separate internal endpoint for authorized operators; never hide sensitive events only at render time.
- [X] T101 [US6] Project age-sensitive No disponible capabilities into forms/actions so a represented player reaching 18 cannot mutate and receives no implied account, SELF or transfer control.
- [X] T102 [US5] Re-run focused presentation/accessibility tests and preserve T056–T065 behavior: persistent identity, platform navigation, liquid-glass direction, neutral photograph marker and unavailable future sections.

**Checkpoint**: Frontend tests pass for corrected contexts/forms/privacy while the approved visual and accessibility baseline remains unchanged.

---

## Phase 11: Compatibility fixtures and corrective regression

**Purpose**: Prove the bounded correction across historical data, mixed identities and concurrency before final verification.

**Entry dependency**: Phase 10.

- [X] T103 [US6] Reconcile local fixtures for adult SELF, USER representing multiple minors, academy-created minor, mixed USER/ACADEMY_USER, birthday boundaries and complete/incomplete historical TUTOR cases without changing production data.
- [X] T104 [US1] Complete sequential integration coverage for concurrent SELF/document creation, changing academy membership, confirmation consumption rollback, date correction, birthday transition and immutable/filtered audit privacy.
- [x] T105 [US6] Add regression coverage proving health, identity, internal role governance, memberships, login/session lifecycle and Feature 004 authenticated shell remain unchanged except the approved USER eligibility boundary.
- [X] T106 [US4] Perform a secret-safety test scan of API DTOs, traces, frontend diagnostics and web-export fixtures for documents, birth dates, representative facts, duplicate events in ordinary history, contacts, tokens, precise locations and media references.

**Checkpoint**: The correction is implementation-complete and ready for final workspace gates; this checkpoint does not itself mark Phase 12 complete.

---

## Phase 12: Final integration, regression verification, and documentation

**Purpose**: Validate the corrected complete vertical slice and confirm Feature 001-004 regressions remain green without creating scope beyond Feature 005.

**Entry dependency**: Phase 11.

- [x] T107 Run `npm run typecheck` and `npm test` from the repository root across `apps/backend/src` and `apps/frontend/src`; fix only Feature 005 failures and do not modify Feature 001-004 ownership.
- [x] T108 Run `npm run test:backend:contract` and `npm run test:backend:integration` from the repository root; PostgreSQL tests remain sequential and use independent clients for overlap cases.
- [x] T109 Run `npm run test:frontend` and `npm run export:web --workspace=@new-talents/frontend` from the repository root; verify no protected data appears in built frontend output.
- [x] T110 Validate `specs/005-player-passport-lifecycle/quickstart.md` end-to-end and update only `specs/005-player-passport-lifecycle/quickstart.md` if an approved verification step is inaccurate.
- [x] T111 Cross-check `specs/005-player-passport-lifecycle/spec.md`, `plan.md`, `research.md`, `data-model.md`, and `contracts/` for consistency; record discrepancies without changing `spec.md` or the checklist.

**Checkpoint**: All workspace gates and Feature 001-004 regression suites pass; the corrected Feature 005 vertical slice is independently demonstrable.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies; starts immediately.
- **Phase 2**: Depends on Phase 1.
- **Phase 3**: Depends on Phase 2.
- **Phase 4**: Depends on Phase 3.
- **Phase 5**: Depends on Phase 4.
- **Phase 6**: Depends on Phase 5.
- **Phase 7**: Depends on Phase 6 and reconciled Feature 005 design artifacts; corrective tests come first.
- **Phase 8**: Depends on failing corrective tests in Phase 7.
- **Phase 9**: Depends on the reviewed additive persistence/domain foundation in Phase 8.
- **Phase 10**: Depends on corrected backend contracts in Phase 9.
- **Phase 11**: Depends on the corrected frontend/backend slice in Phase 10.
- **Phase 12**: Depends on all corrective implementation and regression tasks in Phase 11.

### User Story Mapping

- **US1 (Create and prepare)**: Historical Phases 1-5 plus corrective tests/foundations/backend/frontend in Phases 7-10 for USER, SELF, representation, academy confirmation and Colombia age.
- **US2 (Correct and submit)**: Historical Phases 3-5 plus T088-T089 and T097 for private correction and age-compatible authority.
- **US3 (Review, approve, activate)**: Historical review/activation plus T093 regression of independent capabilities.
- **US4 (Status and trace)**: Historical trace UI plus T071, T090 and T100 for filtered ordinary and immutable internal history.
- **US5 (Responsive presentation)**: Historical Phase 6 plus T072, T082, T086, T091 and T098-T102 for corrected entry/context behavior without visual reinterpretation.
- **US6 (Role interfaces)**: TUTOR compatibility, USER eligibility and relationship/capability authorization in T067, T074-T075, T081, T083-T085, T101, T103 and T105.

### Functional Requirement Traceability

| Requirement | Covering tasks |
|---|---|
| FR-001 | T075, T084-T085, T092, T094, T105 |
| FR-002 | T066, T068-T070, T076-T080, T087, T092, T096 |
| FR-003 | T067, T069-T070, T076-T080, T085-T087, T092, T096 |
| FR-004 | T069, T079, T088, T092, T095-T097 |
| FR-005 | T066, T069-T070, T078-T080, T088-T089, T092, T097 |
| FR-006 | T070, T077, T087-T088, T104 |
| FR-007 | T067, T069, T085, T088, T097 |
| FR-008 | T069, T089, T104 |
| FR-009 | T069, T090, T093 |
| FR-010 | T088-T089, T097, T104 |
| FR-011 | T069, T093 |
| FR-012 | T070, T077, T079-T080, T087-T089, T104 |
| FR-013 | T067, T069, T085-T086, T090, T095, T100 |
| FR-014 | T067, T074-T075, T081, T083-T085 |
| FR-015 | T071, T074, T079-T081, T087-T090, T106 |
| FR-016 | T094, T100, T102, T106 |
| FR-017 | T075, T084, T105 |
| FR-018 | T095-T102 |
| FR-019 | T071, T087, T090, T106 |
| FR-020 | T089, T093-T094 |
| FR-021 | T090, T093 |
| FR-022 | T071, T090, T106 |
| FR-023 | T102 |
| FR-024 | T102 |
| FR-025 | T102 |
| FR-026 | T069, T094-T095 |
| FR-027 | T102 |
| FR-028 | T102 |
| FR-029 | T067, T072-T073, T085, T095-T101 |
| FR-030 | T095-T102 |
| FR-031 | T102, T105 |
| FR-032 | T102, T105 |
| FR-033 | T073, T088, T096-T097, T102 |
| FR-034 | T082, T091, T102 |
| FR-035 | T102, T106 |
| FR-036 | T094, T102, T105-T106 |
| FR-037 | T067-T070, T074-T080, T083-T087, T096, T103 |
| FR-038 | T066, T070, T078, T087-T089, T092, T101, T104 |
| FR-039 | T069-T070, T079-T080, T087, T092, T096, T106 |
| FR-040 | T069-T070, T079-T080, T087, T092, T096, T104 |
| FR-041 | T066, T078, T080, T088-T089, T097, T101, T104 |
| FR-042 | T072, T086, T095, T098-T100 |
| FR-043 | T068, T074, T076-T077, T081, T083-T085, T103-T105 |
| FR-044 | T067, T085, T092, T094, T105-T106 |

### Success-Criterion Traceability

| Criterion | Covering tasks |
|---|---|
| SC-001 | T070, T077, T080, T087, T104 |
| SC-002 | T067, T070, T085, T087, T104 |
| SC-003 | T070, T077, T087-T088, T104 |
| SC-004 | T089, T104 |
| SC-005 | T090, T093-T094, T104 |
| SC-006 | T088-T090, T097, T100, T104 |
| SC-007 | T070, T077, T087-T089, T104 |
| SC-008 | T071, T079, T090, T094, T100, T106 |
| SC-009 | T067, T085-T086, T090, T100, T104 |
| SC-010 | T071, T087, T090, T104, T106 |
| SC-011 | T071, T089-T090, T093-T094, T104, T106 |
| SC-012 | T072, T098-T102 |
| SC-013 | T102 |
| SC-014 | T102 |
| SC-015 | T067, T085, T095-T101 |
| SC-016 | T102, T105 |
| SC-017 | T094, T102, T105-T106 |
| SC-018 | T082, T091, T102 |
| SC-019 | T073, T088, T096-T097, T102 |
| SC-020 | T066, T070, T078, T089, T104 |
| SC-021 | T067, T070, T076-T080, T083-T087, T103-T104 |
| SC-022 | T069-T070, T079-T080, T087, T092, T096, T104 |
| SC-023 | T072, T086, T095, T098-T100 |
| SC-024 | T074, T081, T089, T101, T103-T105 |

### Parallel Opportunities

- Phase 1: T001 and T002 are separate files and can run in parallel.
- Phase 2: T008-T011 are independent unit-test files and can run in parallel.
- Phase 3: T016-T020 are independent unit-test files and can run in parallel.
- Phase 4: T026 and T027 are independent unit-test files and can run in parallel; T028 and T029 use database/HTTP state and must run sequentially after implementation.
- Phase 5: T041-T044 are independent frontend test files and can run in parallel.
- Phase 6: T056-T059 are independent frontend test files and can run in parallel.
- Phase 7: T066-T069 and T071-T075 are independent test surfaces and can begin in parallel; T070 is sequential PostgreSQL work.
- PostgreSQL integration tasks T002, T029, T070, T104, and any shared-database checks are intentionally not marked `[P]`.

## Parallel Example: Phase 7

```bash
# Independent corrective tests, all written before implementation:
Task: "Write Colombia age-policy unit tests"
Task: "Write relationship-based authorization unit tests"
Task: "Write ordinary/internal history privacy tests"
Task: "Write frontend entry/context routing tests"
```

## Implementation Strategy

### Corrective Verification Checkpoint

1. Preserve completed T001-T065 as historical evidence for their original scope.
2. Write and observe the intended failures in Phase 7 before corrective implementation.
3. Complete persistence/domain foundations in Phase 8 and backend behavior in Phase 9.
4. Complete frontend behavior in Phase 10 and compatibility/regression work in Phase 11.
5. Run final workspace gates only in Phase 12.

### Incremental Delivery

1. Phases 1-6 record the already built Tutor-premise vertical slice and approved responsive presentation.
2. Phases 7-9 correct contracts, persistence, age, relationships, authorization and privacy test-first.
3. Phase 10 corrects role/context-specific authenticated interfaces while preserving the visual shell.
4. Phase 11 proves compatibility, concurrency and secret safety.
5. Phase 12 proves the complete corrected slice and Feature 001-004 regressions.

## Notes

- `[P]` tasks are separate files with no dependency on incomplete tasks.
- PostgreSQL tasks sharing database state are never marked `[P]`.
- Tests are written before implementation and expected to fail until the corresponding task is completed.
- Do not rewrite existing migrations. Changes to Feature 002/003/004 boundaries are limited to USER eligibility, relationship-aware passport authorization and compatible Academy display context explicitly approved by the Feature 005 specification.
- Historical TUTOR facts remain interpretable and grant no authority by themselves; never infer SELF or representation from role, creator, payment or document knowledge.
- Backend Colombia date and persisted relationship/membership facts are authoritative; never trust or persist `isAdult` as authority.
- Ordinary particular/academy history must omit possible-duplicate detection and resolution events, while internal immutable audit remains available only through its explicit capability.
- Do not hardcode `Mateo González` or representative design values, invent statistics, render missing data as zero, or create inactive future controls.
- Do not persist photograph URLs, binaries, file identifiers, or external media references, and do not add upload controls or inactive photograph actions.
