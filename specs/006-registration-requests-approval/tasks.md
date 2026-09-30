---

description: "Implementation tasks for Feature 006 registration requests and approval"
---

# Tasks: Solicitudes de registro y aprobación

**Input**: Design documents from `specs/006-registration-requests-approval/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/`, and `docs/design/feature-006/README.md`

**Tests**: Test-first is mandatory for this feature. Focused unit, contract, PostgreSQL integration, frontend, privacy, concurrency, accessibility, and visual-regression tasks precede their corresponding implementation or completion gates.

**Organization**: The eleven phases below preserve the implementation order explicitly approved for Feature 006. Story labels provide traceability even where a phase intentionally serves several user stories.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: May run in parallel only when it changes different files and does not share an incomplete dependency or PostgreSQL database.
- **[Story]**: Maps the task to a user story in `spec.md`.
- Every task names its concrete repository path and verification target.

---

## Phase 1: Shared persistence and configuration foundation

**Purpose**: Establish the typed seven-request aggregate, additive persistence, immutable/versioned records, and fail-closed configuration without implementing business journeys.

**Checkpoint**: Prisma and runtime configuration represent the complete Feature 006 foundation, and schema/configuration tests pass before lifecycle work begins.

- [X] T001 Add failing schema-shape tests for the seven `RegistrationRequestType` values, five product states, evidence/approval/deletion states, exactly one matching typed detail, optimistic `version`, append-only events, pending-access facts, evidence metadata, decisions, confirmations, duplicate signals, and deletion executions in `apps/backend/src/registration-requests/persistence/registration-request-schema.spec.ts`
- [X] T002 Implement the additive Feature 006 enums, relations, indexes, uniqueness constraints, and typed one-to-one detail models in `apps/backend/prisma/schema.prisma`, preserving existing Feature 001–005 models and forbidding document bytes/base64 fields
- [X] T003 Create the additive SQL migration with foreign keys, check/unique constraints, indexes, and no destructive rewrite of existing identities, memberships, responsibilities, or passports in `apps/backend/prisma/migrations/20260924040523_registration_requests_foundation/migration.sql`
- [X] T004 Add sequential PostgreSQL migration/invariant tests for one typed detail per request, one final decision, one approval execution per submitted version, unique normalized fingerprints, and preservation of existing rows in `apps/backend/test/integration/registration-request-schema.integration.spec.ts`
- [X] T005 [P] Add failing configuration tests for private provider selection, private root/bucket, production encryption expectation, PDF/JPEG/PNG allowlist, 10 MiB/item, 40 MiB/request, scanner endpoint/timeout, pending-session settings, bounded batch/lease/backoff, and exactly five automatic deletion attempts in `apps/backend/src/config/registration-evidence-environment.spec.ts`
- [X] T006 Implement typed fail-closed Feature 006 environment parsing and runtime projection, rejecting undefined/public storage, missing production encryption, empty types/limits, unavailable scanner configuration, and invalid retry bounds in `apps/backend/src/config/environment.schema.ts` and `apps/backend/src/config/config.module.ts`
- [X] T007 [P] Define domain enums, typed detail discriminants, lifecycle commands, safe projections, and invariants for all seven exact request types in `apps/backend/src/registration-requests/domain/registration-request.types.ts`
- [X] T008 [P] Add failing unit tests for terminal `APPROVED`/`REJECTED`, editable `DRAFT`/`REQUIRES_CORRECTION`, immutable `SUBMITTED`, current-version enforcement, and orthogonal approval/deletion technical states in `apps/backend/src/registration-requests/domain/registration-request.aggregate.spec.ts`
- [X] T009 Implement the aggregate transition guards and append-only safe-event construction without a generic workflow engine in `apps/backend/src/registration-requests/domain/registration-request.aggregate.ts`
- [X] T010 Wire the new bounded module and persistence providers without exposing controllers yet in `apps/backend/src/registration-requests/registration-requests.module.ts` and `apps/backend/src/app.module.ts`

---

## Phase 2: Pending identity, credentials and authorization

**Purpose**: Reuse Feature 003 sessions while restricting pending applicants to request onboarding and projecting all authorization from backend facts.

**Checkpoint**: Pending applicants can authenticate, refresh, revoke, and log out but cannot access product, academy, Analyst, or Administrator capabilities.

- [X] T011 Add failing authorization tests for every public/pending, academy-scoped, and Administrator capability in `specs/006-registration-requests-approval/contracts/registration-authorization.md`, including ownership, current version, active membership, responsible authority, evidence, age, representation, dossier, deletion, and deny-by-default facts in `apps/backend/src/authorization/registration-authorization.spec.ts`
- [X] T012 Extend the static permission catalog and authorization contract with Feature 006 capabilities and request facts, keeping role labels insufficient without resource facts in `apps/backend/src/authorization/permission-catalog.ts` and `apps/backend/src/authorization/authorization.contract.ts`
- [X] T013 Add failing adapter tests for safe indistinguishable denial, request ownership, academy context derived from active membership, explicit Admin capabilities, Analyst denial, and runtime re-evaluation in `apps/backend/src/registration-requests/authorization/registration-authorization.adapter.spec.ts`
- [X] T014 Implement the registration authorization adapter and capability projector without frontend JWT-role decoding in `apps/backend/src/registration-requests/authorization/registration-authorization.adapter.ts`
- [X] T015 Add failing credential tests for atomic applicant identity/credential creation, `PENDING_ONBOARDING`, normalized-email conflict safety, password hashing, and absence of password/confirmation from DTOs, events, diagnostics, and dossier data in `apps/backend/src/authentication/pending-applicant-credential.service.spec.ts`
- [X] T016 Implement restricted applicant credential creation by reusing the existing credential/session boundary and export it through `AuthenticationModule` in `apps/backend/src/authentication/pending-applicant-credential.service.ts` and `apps/backend/src/authentication/authentication.module.ts`
- [X] T017 Add login, refresh rotation/reuse detection, logout, logout-all, revocation, and pending-capability regression tests in `apps/backend/src/authentication/authentication.service.spec.ts` and `apps/backend/src/authentication/session.service.spec.ts`
- [X] T018 [P] Add frontend route-policy tests proving pending sessions restore only public/pending request routes and cannot enter passport, academy, Analyst, or Admin routes in `apps/frontend/src/authentication/pending-route-policy.spec.ts`
- [X] T019 Implement pending-session classification, capability refresh after approval, and logout/revocation cleanup without parsing JWT roles in `apps/frontend/src/authentication/authentication-types.ts`, `apps/frontend/src/authentication/authentication-provider.tsx`, and `apps/frontend/src/authentication/authenticated-route-policy.ts`
- [X] T020 Add regression tests that active Feature 002–005 users retain existing permissions while pending identities gain no ordinary roles, memberships, responsibilities, or passport access in `apps/backend/src/authorization/authorization.service.spec.ts` and `apps/backend/src/player-passport/passport-authorization/passport-authorization.adapter.spec.ts`

---

## Phase 3: Evidence storage and privacy

**Purpose**: Deliver private streaming evidence, quarantine/scanning, controlled replacement, audited Admin access, and verified bounded deletion.

**Checkpoint**: Synthetic evidence completes the secure lifecycle; no bytes, base64, provider paths, object keys, hashes, or sensitive filenames enter ordinary JSON or persisted frontend state.

- [X] T021 Add failing provider contract tests for streaming `put`, `openStream`, idempotent `delete`, `exists`, random opaque keys, and verified absence in `apps/backend/src/registration-requests/evidence/private-evidence-store.contract.spec.ts`
- [X] T022 Define the provider-neutral `PrivateEvidenceStore` and `EvidenceMalwareScanner` ports plus safe result types in `apps/backend/src/registration-requests/evidence/private-evidence-store.ts` and `apps/backend/src/registration-requests/evidence/evidence-malware-scanner.ts`
- [X] T023 [P] Add filesystem adapter tests for containment beneath an explicit private root, traversal rejection, streaming, idempotent delete, and post-delete absence in `apps/backend/src/registration-requests/evidence/local-private-evidence-store.spec.ts`
- [X] T024 Implement the private local filesystem adapter outside served/static paths in `apps/backend/src/registration-requests/evidence/local-private-evidence-store.ts`
- [X] T025 [P] Add S3-compatible adapter tests for private/encrypted writes, blocked public addressing, streaming, version-aware deletion, waiter-based absence verification, and missing-object idempotency in `apps/backend/src/registration-requests/evidence/s3-private-evidence-store.spec.ts`
- [X] T026 Implement the production S3-compatible adapter behind the same port without returning provider URLs in `apps/backend/src/registration-requests/evidence/s3-private-evidence-store.ts`
- [X] T027 Add failing upload-pipeline tests using synthetic canaries for 10 MiB/item, 40 MiB/request, PDF/JPEG/PNG extension + declared MIME + detected magic-byte agreement, technical digest non-disclosure, quarantine, CLEAN completeness, malware, timeout, unavailable scanner, and malformed scanner response in `apps/backend/src/registration-requests/evidence/evidence-ingestion.service.spec.ts`
- [X] T028 Implement streaming validation and ClamAV INSTREAM scanning with fail-closed quarantine/rejection in `apps/backend/src/registration-requests/evidence/evidence-ingestion.service.ts` and `apps/backend/src/registration-requests/evidence/clamav-instream-scanner.ts`
- [X] T029 Add failing access tests for Admin-only current CLEAN evidence, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, safe generated filenames, per-attempt audit, and denial to applicant-after-submit, Analyst, unrelated academy, and public actors in `apps/backend/src/registration-requests/evidence/evidence-stream.controller.spec.ts`
- [X] T030 Implement reauthorized backend streaming and safe access auditing in `apps/backend/src/registration-requests/evidence/evidence-stream.controller.ts` and `apps/backend/src/registration-requests/evidence/evidence-access-audit.service.ts`
- [X] T031 Add failing replacement/deletion tests for replacement only in `REQUIRES_CORRECTION`, old-version invisibility, one durable deletion record per object/execution, lease expiry, bounded batch/backoff, five attempts, `RECOVERY_REQUIRED`, explicit idempotent Admin retry, and orphan grace-period cross-check in `apps/backend/src/registration-requests/evidence/evidence-deletion.service.spec.ts`
- [X] T032 Implement evidence replacement, verified deletion, bounded worker, explicit recovery, and orphan sweep limited to Feature 006 keys in `apps/backend/src/registration-requests/evidence/evidence-deletion.service.ts` and `apps/backend/src/registration-requests/evidence/evidence-deletion.worker.ts`
- [X] T033 Add automated canary scans asserting zero passwords, raw documents, bytes/base64, object keys, digests, candidate identities, consent text, and private representative/contact data in logs, traces, events, routes, ordinary JSON, and exports in `apps/backend/test/contract/registration-privacy.contract.spec.ts`

---

## Phase 4: Shared request lifecycle and API

**Purpose**: Expose the typed lifecycle and shared applicant/Admin APIs with safe errors, optimistic concurrency, and redacted history.

**Checkpoint**: Any supported typed request can move through draft, submit, correction, resubmit, approve preparation/finalization, or rejection under correct authorization and versioning; type-specific outcome creation remains delegated.

- [X] T034 Add failing lifecycle tests for create, editable draft, submit, correction, resubmit, approval preparation/finalization, rejection, terminal states, idempotency keys, current-version checks, and no partial mutation in `apps/backend/src/registration-requests/lifecycle/registration-request-lifecycle.service.spec.ts`
- [X] T035 Implement the shared lifecycle service over `RegistrationRequest` without generic field maps or a generic workflow engine in `apps/backend/src/registration-requests/lifecycle/registration-request-lifecycle.service.ts`
- [X] T036 [P] Add failing safe-history tests for actor/time/action/from/to/result/category while excluding passwords, documents, birth dates, contacts, evidence, fingerprints, candidates, and complete declarations in `apps/backend/src/registration-requests/history/registration-request-history.mapper.spec.ts`
- [X] T037 Implement append-only event persistence and applicant/Admin redacted projections in `apps/backend/src/registration-requests/history/registration-request-history.service.ts` and `apps/backend/src/registration-requests/history/registration-request-history.mapper.ts`
- [X] T038 Add OpenAPI contract tests for all 21 paths/22 operations, seven closed payload schemas, multipart-only evidence bytes, streamed Admin evidence, cursor limits `1..50` with default `20`, safe conflict/denial envelopes, and no private fields in ordinary responses in `apps/backend/test/contract/registration-requests.openapi.spec.ts`
- [X] T039 Implement DTO parsing and validation mirroring the exact OpenAPI constraints: `additionalProperties: false`; `privacyVersion`/declaration versions max 40; academy name max 180; country max 80; city/function max 120; training place max 180; NIT max 40; correction reason max 1000; non-empty unique correction/evidence category arrays; and controlled relationship/proof enums in `apps/backend/src/registration-requests/http/registration-request.dto.ts`
- [X] T040 Implement typed request/detail repositories, optimistic writes, cursor queries, and idempotency records in `apps/backend/src/registration-requests/persistence/registration-request.repository.ts`
- [X] T041 Implement public creation plus owned list/detail/update/submit/resubmit/evidence/deletion-status endpoints with safe ownership denial in `apps/backend/src/registration-requests/http/registration-request.controller.ts` and `apps/backend/src/registration-requests/application/applicant-request.service.ts`
- [X] T042 Add failing Admin query tests for one unified list containing all seven types, type/status filters, stable cursor pagination, safe identity/academy labels, evidence/correction indicators, and minimum-necessary detail in `apps/backend/src/registration-requests/review/admin-registration-query.service.spec.ts`
- [X] T043 Implement the unified Admin list/detail query boundary required by submitted requests, before building the Admin frontend, in `apps/backend/src/registration-requests/review/admin-registration-query.service.ts` and `apps/backend/src/registration-requests/http/admin-registration-review.controller.ts`
- [X] T044 Implement safe exception mapping for validation, stale version, duplicate conflict, forbidden/not-found indistinguishability, storage/scanner unavailability, and retryable deletion without candidate disclosure in `apps/backend/src/registration-requests/http/registration-request-exception.filter.ts`
- [X] T045 Add sequential multi-client PostgreSQL tests for racing submit/resubmit/correction/approve/reject on the same version and prove exactly one transition/decision with no duplicate outcome in `apps/backend/test/integration/registration-request-concurrency.integration.spec.ts`
- [X] T046 Register lifecycle, repositories, controllers, authorization, evidence, and history providers in `apps/backend/src/registration-requests/registration-requests.module.ts`

---

## Phase 5: Initial personal requests backend

**Purpose**: Complete adult-self and represented-minor backend journeys, including deduplication and atomic passport outcomes.

**Checkpoint**: US1 and US2 approve independently; US3 proves one USER may retain separate minor relationships and receives the correct selector behavior.

- [X] T047 [P] [US1] Add Colombia/18 boundary tests for before/on/after birthday, February 29 anniversary, client/server date disagreement, submit-time and approval-time reevaluation, and rejection of client `isAdult` authority in `apps/backend/src/registration-requests/personal/registration-age-policy.spec.ts`
- [X] T048 [P] [US1] Add personal-adult validation tests for applicant=player, optional phone, self-action declaration, privacy/truthfulness consent, required evidence categories, and no Analyst-owned sports fields in `apps/backend/src/registration-requests/personal/personal-adult-application.service.spec.ts`
- [X] T049 [P] [US2] Add represented-minor validation tests for adult representative, mandatory phone, controlled `MOTHER|FATHER|LEGAL_GUARDIAN`, authority, minor treatment, evidence completeness, and zero minor email/password/phone/account in `apps/backend/src/registration-requests/personal/represented-minor-application.service.spec.ts`
- [X] T050 [P] [US14] Add normalization/duplicate tests for normalized email/document fingerprints, exact atomic conflicts, private name/date similarity signals, generic `REGISTRATION_CONFLICT`, and zero candidate/fingerprint/internal-reason disclosure in `apps/backend/src/registration-requests/duplicates/registration-duplicate.service.spec.ts`
- [X] T051 [US1] Add failing typed-outcome tests proving approval creates/enables one USER identity, one deduplicated Player, active SELF, and exactly one private `ACTIVE` passport marked `AWAITING_ANALYST_ENRICHMENT` in `apps/backend/src/registration-requests/outcomes/personal-adult-approval.orchestrator.spec.ts`
- [X] T052 [US2] Add failing typed-outcome tests proving approval enables only the representative USER, creates/links one minor Player, active LEGAL_REPRESENTATIVE, exactly one basic passport, and no minor account/session in `apps/backend/src/registration-requests/outcomes/represented-minor-approval.orchestrator.spec.ts`
- [X] T053 [US1] Implement server-derived Colombia age policy and reuse Feature 005 encryption, normalization, and fingerprint boundaries in `apps/backend/src/registration-requests/personal/registration-age-policy.ts` and `apps/backend/src/registration-requests/duplicates/registration-duplicate.service.ts`
- [X] T054 [US1] Implement typed personal-adult draft/completeness/consent/evidence rules in `apps/backend/src/registration-requests/personal/personal-adult-application.service.ts`
- [X] T055 [US2] Implement typed represented-minor draft/completeness/representation/evidence rules without creating credentials for the minor in `apps/backend/src/registration-requests/personal/represented-minor-application.service.ts`
- [X] T056 [US1] Implement the serializable personal-adult approval outcome using the existing bounded P2034 runner and rollback on any identity/player/SELF/passport conflict in `apps/backend/src/registration-requests/outcomes/personal-adult-approval.orchestrator.ts`
- [X] T057 [US2] Implement the serializable represented-minor approval outcome with separate legal responsibility and zero minor account in `apps/backend/src/registration-requests/outcomes/represented-minor-approval.orchestrator.ts`
- [X] T058 [US3] Add and implement integration coverage for one USER representing multiple minors through separate relationships, one accessible passport opening Summary, and multiple accessible passports requiring explicit authorized selection in `apps/backend/test/integration/registration-multiple-minors.integration.spec.ts` and `apps/frontend/src/passport/passport-destination.spec.ts`
- [X] T059 [US14] Add sequential PostgreSQL duplicate/concurrency tests proving equivalent personal requests create at most one identity, player, responsibility, and passport and that rollback leaves zero partial privilege in `apps/backend/test/integration/personal-registration-approval.integration.spec.ts`

---

## Phase 6: Initial academy-creation backend

**Purpose**: Complete formal and natural-person academy creation with restricted responsible accounts and atomic initial academy context.

**Checkpoint**: US4 and US5 can be submitted, corrected/rejected, and approved independently without activating an academy or ACADEMY_USER privilege before final approval.

- [X] T060 [P] [US4] Add formal-academy validation tests for normalized institutional identity/NIT, RUT, certificate/equivalent, responsible adult identity, mandatory responsible phone, authority, privacy, truthfulness, and exact evidence categories in `apps/backend/src/registration-requests/academy/formal-academy-application.service.spec.ts`
- [X] T061 [P] [US5] Add natural-person academy tests for operating identity, non-precise location, complete responsible adult with mandatory phone, operation declaration, and at least one unique controlled proof category from `RUT|MUNICIPAL_OR_SPORT_CERTIFICATION|PLACE_USE_AUTHORIZATION|OPERATION_CONTRACT_OR_REGISTER|OTHER_CONTROLLED` in `apps/backend/src/registration-requests/academy/natural-person-academy-application.service.spec.ts`
- [X] T062 [P] [US14] Add academy duplicate tests for normalized name, NIT, responsible identity, exact conflict blocking, non-conclusive private signal, and non-enumerable applicant responses in `apps/backend/src/registration-requests/duplicates/academy-duplicate.service.spec.ts`
- [X] T063 [US4] Add failing formal-academy approval tests for exactly one Academy, enabled responsible identity, only ACADEMY_USER, active membership, responsible relationship, and atomic rollback in `apps/backend/src/registration-requests/outcomes/formal-academy-approval.orchestrator.spec.ts`
- [X] T064 [US5] Add failing natural-person approval tests for the same bounded outcome while never claiming legal certification from accepted operational evidence in `apps/backend/src/registration-requests/outcomes/natural-person-academy-approval.orchestrator.spec.ts`
- [X] T065 [US4] Implement formal-academy typed draft/completeness/evidence rules and ensure pending records create no operable Academy or organizational privilege in `apps/backend/src/registration-requests/academy/formal-academy-application.service.ts`
- [X] T066 [US5] Implement natural-person academy typed draft/completeness/evidence rules with neutral operational wording in `apps/backend/src/registration-requests/academy/natural-person-academy-application.service.ts`
- [X] T067 [US14] Implement academy normalization/fingerprint comparison and private duplicate resolution projection in `apps/backend/src/registration-requests/duplicates/academy-duplicate.service.ts`
- [X] T068 [US4] Implement the serializable formal-academy outcome and initial responsible membership as one transaction in `apps/backend/src/registration-requests/outcomes/formal-academy-approval.orchestrator.ts`
- [X] T069 [US5] Implement the serializable natural-person academy outcome without automatic certification claims in `apps/backend/src/registration-requests/outcomes/natural-person-academy-approval.orchestrator.ts`
- [X] T070 [US4] Add sequential PostgreSQL tests for duplicate/concurrent formal and natural-person approvals, no academy privileges while pending, and complete rollback of Academy/responsible/role/membership/relationship in `apps/backend/test/integration/academy-registration-approval.integration.spec.ts`

---

## Phase 7: Initial applicant frontend

**Purpose**: Deliver the first frontend priority for adult, represented-minor, formal-academy, and natural-person academy requests plus pending status/correction.

**Independent Test**: Each initial public type can select its route, save a typed draft, upload synthetic private evidence, consent, review, submit, restore a pending session, and correct only when requested on web and native layouts.

### Shared state, upload, and entry

- [X] T071 [P] [US13] Add frontend API/state-machine tests for typed snapshots, backend capabilities, version conflicts, stable retry/idempotency, pending restoration, approval capability refresh, and no JWT-role inference in `apps/frontend/src/registration-requests/registration-request-state.spec.ts`
- [X] T072 [US13] Implement the single registration API/state owner for server version, typed drafts, capabilities, lifecycle, status restoration, and safe errors in `apps/frontend/src/registration-requests/registration-request-api.ts` and `apps/frontend/src/registration-requests/registration-request-state.tsx`
- [X] T073 [P] [US9] Add document-picker/upload tests for ephemeral URI/File objects, multipart streaming, per-item progress/cancel/retry/scanning, no base64 or persisted object key/hash, and cleanup on upload, submit, logout, abandonment, and unmount in `apps/frontend/src/registration-requests/evidence/upload-queue.spec.ts`
- [X] T074 [US9] Implement private document selection, upload queue, safe labels, progress, retry, correction-only replacement, and secret/file-reference cleanup in `apps/frontend/src/registration-requests/evidence/upload-queue.ts` and `apps/frontend/src/registration-requests/components/evidence-upload.tsx`
- [X] T075 [P] [US15] Add routing tests proving the customer CTA is `Crear solicitud de registro`, public temporary activation is absent, and controlled staff provisioning/recovery remains non-public in `apps/frontend/src/authentication/public-entry-policy.spec.ts`
- [X] T076 [US15] Replace the ordinary public activation entry and add public/pending route groups in `apps/frontend/app/index.tsx`, `apps/frontend/app/(public)/registration/index.tsx`, and `apps/frontend/app/(pending)/registration/[requestId]/_layout.tsx`

### Initial type-specific flows

- [X] T077 [P] [US1] Add accessible component tests for category-first selection, Personal/Academia and adult/minor separation, keyboard/focus/touch behavior, and responsive hierarchy in `apps/frontend/src/registration-requests/components/request-type-selection.spec.tsx`
- [X] T078 [US1] Implement request-type selection and compare runtime desktop/mobile screenshots against `docs/design/feature-006/solicitud/request-type-selection-desktop-mobile.png` in `apps/frontend/app/(public)/registration/index.tsx`
- [X] T079 [P] [US1] Add adult-flow tests for credentials, identity, optional phone, documents, consent, draft validation, submission confirmation, error/retry, and reserved sports-field absence in `apps/frontend/src/registration-requests/flows/personal-adult-flow.spec.tsx`
- [X] T080 [US1] Implement adult identity and submission-review screens, then capture and compare runtime screenshots against `docs/design/feature-006/solicitud/adult-account-identity-desktop.png`, `docs/design/feature-006/solicitud/adult-account-identity-mobile.png`, `docs/design/feature-006/solicitud/adult-submission-review-desktop.png`, and `docs/design/feature-006/solicitud/adult-submission-review-mobile.png` in `apps/frontend/app/(public)/registration/personal-adult.tsx` and `apps/frontend/src/registration-requests/flows/personal-adult-flow.tsx`
- [X] T081 [P] [US2] Add represented-minor flow tests for representative mandatory phone, minor without credentials/contact, relationship, authority, treatment consent, evidence, validation, submission, and accessible errors in `apps/frontend/src/registration-requests/flows/represented-minor-flow.spec.tsx`
- [X] T082 [US2] Implement represented-minor information and review screens, then capture and compare runtime screenshots against `docs/design/feature-006/solicitud/represented-minor-information-desktop.png`, `docs/design/feature-006/solicitud/represented-minor-information-mobile.png`, `docs/design/feature-006/solicitud/represented-minor-submission-review-desktop.png`, and `docs/design/feature-006/solicitud/represented-minor-submission-review-mobile.png` in `apps/frontend/app/(public)/registration/represented-minor.tsx` and `apps/frontend/src/registration-requests/flows/represented-minor-flow.tsx`
- [X] T083 [P] [US4] Add formal/natural academy frontend tests for mandatory responsible phone, type-specific fields/evidence, at least one controlled natural-person proof, draft persistence, consent, review, and neutral non-certification copy in `apps/frontend/src/registration-requests/flows/academy-creation-flow.spec.tsx`
- [X] T084 [US4] Implement formal and natural-person academy creation flows and compare runtime screenshots against `docs/design/feature-006/solicitud/formal-academy-information-desktop.png`, `docs/design/feature-006/solicitud/formal-academy-information-mobile.png`, `docs/design/feature-006/solicitud/natural-person-academy-information-desktop.png`, `docs/design/feature-006/solicitud/natural-person-academy-information-mobile.png`, and `docs/design/feature-006/solicitud/natural-person-academy-submission-review-desktop.png` in `apps/frontend/app/(public)/registration/academy-formal.tsx`, `apps/frontend/app/(public)/registration/academy-natural-person.tsx`, and `apps/frontend/src/registration-requests/flows/academy-creation-flow.tsx`

### Pending status, correction, and visual gate

- [X] T085 [P] [US9] Add submitted/immutable, requires-correction/editable, safe-reason, deletion-status, resubmit, stale snapshot restoration, loading/empty/denied/service-failure, focus announcement, and reduced-motion tests in `apps/frontend/src/registration-requests/flows/applicant-status-flow.spec.tsx`
- [X] T086 [US9] Implement pending status and correction screens and compare runtime screenshots against `docs/design/feature-006/solicitud/applicant-correction-status-desktop.png` and `docs/design/feature-006/solicitud/applicant-correction-status-mobile.png` in `apps/frontend/app/(pending)/registration/[requestId]/index.tsx` and `apps/frontend/src/registration-requests/flows/applicant-status-flow.tsx`
- [X] T087 [US13] Record desktop and native-width runtime screenshot comparisons, keyboard/reader/focus/touch/reduced-motion results, and deviations for all 16 initial references in `specs/006-registration-requests-approval/visual-qa-initial.md`

---

## Phase 8: Initial vertical checkpoint

**Purpose**: Verify the first vertical slice only; Feature 006 remains incomplete until Phases 9–11 finish.

**Checkpoint**: Four initial types submit end-to-end with private evidence and restricted pending access, are visible through the Admin API, and grant no ordinary product privilege before approval.

- [X] T088 [US1] Add an end-to-end contract/integration checkpoint for adult draft, synthetic evidence CLEAN, consent, submit, pending status, and Admin API availability in `apps/backend/test/integration/initial-adult-registration-checkpoint.integration.spec.ts`
- [X] T089 [US2] Add an end-to-end checkpoint for represented-minor submit with mandatory representative phone/evidence and zero minor account/contact/session in `apps/backend/test/integration/initial-minor-registration-checkpoint.integration.spec.ts`
- [X] T090 [US4] Add an end-to-end checkpoint for formal-academy submit with no Academy, ACADEMY_USER, or membership materialized while pending in `apps/backend/test/integration/initial-formal-academy-checkpoint.integration.spec.ts`
- [X] T091 [US5] Add an end-to-end checkpoint for natural-person academy submit and safe correction without a certification claim in `apps/backend/test/integration/initial-natural-academy-checkpoint.integration.spec.ts`
- [X] T092 [US13] Add frontend integration tests for pending login/restoration, own status, correction/resubmit, and denial of passport/academy/analysis/Admin routes in `apps/frontend/src/registration-requests/initial-vertical-checkpoint.spec.tsx`
- [X] T093 [US9] Verify submitted evidence remains private and retrievable only by the authorized Admin stream while applicant responses expose metadata only in `apps/backend/test/contract/initial-evidence-privacy-checkpoint.contract.spec.ts`
- [X] T094 [US15] Run a static canary inspection over checkpoint responses, logs, routes, events, and exports and record zero protected values in `specs/006-registration-requests-approval/checkpoints/initial-privacy.md`
- [X] T095 [US15] Document the initial checkpoint result and explicitly list additional-account, academy-player, Administrator UI, typed final decisions, and final seven-outcome verification as remaining Feature 006 work in `specs/006-registration-requests-approval/checkpoints/initial-vertical.md`

---

## Phase 9: Approved-academy operations

**Purpose**: Complete additional-account and academy adult/minor player requests in a derived approved academy context.

**Checkpoint**: US6–US8 can be created, submitted, listed, reviewed, and approved without arbitrary academy IDs, self-approval, implicit USER/SELF, or minor/representative accounts.

- [X] T096 [P] [US6] Add backend tests for responsible authority, approved academy, active matching membership, proposed identity/function/evidence, and rejection of arbitrary or stale academy context in `apps/backend/src/registration-requests/academy/additional-academy-account.service.spec.ts`
- [X] T097 [P] [US7] Add backend tests for active academy context, adult identity/evidence/express authorization, no academy self-decision, and no USER/SELF outcome in `apps/backend/src/registration-requests/academy/academy-adult-player.service.spec.ts`
- [X] T098 [P] [US8] Add backend tests for minor civil identity, identified representative, mandatory representative phone, relationship/authority/treatment/presentation consents, separated legal/sporting relationships, and zero minor/representative automatic accounts in `apps/backend/src/registration-requests/academy/academy-minor-player.service.spec.ts`
- [X] T099 [US6] Implement typed additional-account validation and context derivation without accepting client-selected unrelated academy identifiers in `apps/backend/src/registration-requests/academy/additional-academy-account.service.ts`
- [X] T100 [US7] Implement typed academy-adult-player validation with adult authorization and active membership recheck in `apps/backend/src/registration-requests/academy/academy-adult-player.service.ts`
- [X] T101 [US8] Implement typed academy-minor-player validation with separate representative authority and sporting context in `apps/backend/src/registration-requests/academy/academy-minor-player.service.ts`
- [X] T102 [P] [US6] Add failing outcome tests for enabling only ACADEMY_USER and one active membership in the authorized academy, with no USER/Analyst/Admin privilege in `apps/backend/src/registration-requests/outcomes/additional-academy-account-approval.orchestrator.spec.ts`
- [X] T103 [P] [US7] Add failing outcome tests for Player + AcademySportingRelationship + one basic passport and no USER/SELF in `apps/backend/src/registration-requests/outcomes/academy-adult-player-approval.orchestrator.spec.ts`
- [X] T104 [P] [US8] Add failing outcome tests for minor Player + separate LEGAL_REPRESENTATIVE + AcademySportingRelationship + one passport and no automatic accounts in `apps/backend/src/registration-requests/outcomes/academy-minor-player-approval.orchestrator.spec.ts`
- [X] T105 [US6] Implement all three serializable typed academy-operation outcomes with runtime membership/authority checks and full rollback in `apps/backend/src/registration-requests/outcomes/additional-academy-account-approval.orchestrator.ts`, `apps/backend/src/registration-requests/outcomes/academy-adult-player-approval.orchestrator.ts`, and `apps/backend/src/registration-requests/outcomes/academy-minor-player-approval.orchestrator.ts`
- [X] T106 [US6] Add frontend hub/state tests, implement the approved-academy request list/choices, and compare runtime screenshots against `docs/design/feature-006/solicitud/academy-request-hub-desktop.png` and `docs/design/feature-006/solicitud/academy-request-hub-mobile.png` in `apps/frontend/app/(academy)/registration/index.tsx` and `apps/frontend/src/registration-requests/academy/academy-request-hub.tsx`
- [X] T107 [US6] Add frontend tests and implement additional-account review with exact projected context, then compare runtime screenshots against `docs/design/feature-006/solicitud/academy-additional-account-submission-review-desktop.png` and `docs/design/feature-006/solicitud/academy-additional-account-submission-review-mobile.png` in `apps/frontend/app/(academy)/registration/additional-account.tsx` and `apps/frontend/src/registration-requests/academy/additional-account-flow.tsx`
- [X] T108 [US7] Add frontend tests and implement adult-player evidence/authorization review, then compare runtime screenshots against `docs/design/feature-006/solicitud/academy-adult-player-submission-review-desktop.png` and `docs/design/feature-006/solicitud/academy-adult-player-submission-review-mobile.png` in `apps/frontend/app/(academy)/registration/player-adult.tsx` and `apps/frontend/src/registration-requests/academy/academy-adult-player-flow.tsx`
- [X] T109 [US8] Add frontend tests and implement minor/representative evidence/consent review, then compare runtime screenshots against `docs/design/feature-006/solicitud/academy-minor-player-submission-review-desktop.png` and `docs/design/feature-006/solicitud/academy-minor-player-submission-review-mobile.png` in `apps/frontend/app/(academy)/registration/player-minor.tsx` and `apps/frontend/src/registration-requests/academy/academy-minor-player-flow.tsx`

---

## Phase 10: Administrator review and decisions

**Purpose**: Complete the exclusive Administrator review UI and decision orchestration, including dossier confirmation and evidence deletion before final approval response.

**Checkpoint**: An authorized Administrator can review and decide all seven types; every other actor is safely denied, and final approval occurs once only after verified evidence absence.

- [X] T110 [P] [US10] Add Admin inbox API/state tests for all seven types, type/status filters, scroll-preserving cursor pages, loading/empty/unavailable/error states, row invalidation after decision, and no bulk selection/approval in `apps/frontend/src/registration-requests/admin/admin-inbox-state.spec.ts`
- [X] T111 [P] [US11] Add review-detail tests for minimum structured data, consent versions, projected actions, current evidence, duplicate risk state, version freshness, and no private candidate disclosure in `apps/backend/src/registration-requests/review/admin-registration-review.service.spec.ts`
- [X] T112 [P] [US12] Add correction/rejection tests for Admin-only authority, safe non-empty reason max 1000, applicant preview, immutable decision, no outcome on rejection, immediate evidence withdrawal, and durable deletion start in `apps/backend/src/registration-requests/review/admin-registration-decision.service.spec.ts`
- [X] T113 [P] [US11] Add dossier/approval tests for required confirmation `confirmed=true`, declaration version max 40, non-empty unique transferred categories, complete CLEAN evidence, valid age/representation/academy, no unresolved conflict, current version, and no outcome before verified deletion in `apps/backend/src/registration-requests/review/approval-execution.service.spec.ts`
- [X] T114 [P] [US14] Add private duplicate-review tests for `CLEAR|REVIEW_REQUIRED|RESOLVED_DISTINCT|CONFLICT`, exact-conflict blocking, distinct resolution, generic applicant result, and omission of candidate/document/academy/representative/fingerprint/internal reason in `apps/backend/src/registration-requests/review/private-duplicate-review.service.spec.ts`
- [X] T115 [US10] Implement minimum-necessary Admin review projections and seven-type action availability in `apps/backend/src/registration-requests/review/admin-registration-review.service.ts`
- [X] T116 [US12] Implement correction and final rejection with immutable decisions, safe applicant reason, immediate evidence access withdrawal, and deletion scheduling in `apps/backend/src/registration-requests/review/admin-registration-decision.service.ts`
- [X] T117 [US14] Implement private duplicate signal resolution without exposing or inventing a “coincidencia privada” applicant/UI warning in `apps/backend/src/registration-requests/review/private-duplicate-review.service.ts`
- [X] T118 [US11] Implement dossier confirmation, approval preparation lock, verified-deletion gate, typed dispatcher for all seven orchestrators, serializable finalization, P2034 retry, and recoverable non-final failure in `apps/backend/src/registration-requests/review/approval-execution.service.ts`
- [X] T119 [US11] Add sequential PostgreSQL tests for all seven typed outcomes, approve/reject races, idempotent retry, deletion failure/recovery, no final response before evidence absence, and rollback with at most one approved resource set in `apps/backend/test/integration/registration-admin-decisions.integration.spec.ts`
- [X] T120 [US10] Implement the unified responsive Admin inbox without an “Administrador autorizado” menu item, preserving filters/navigation/scroll and compare runtime desktop output against `docs/design/feature-006/admin/admin-unified-inbox-desktop.png` in `apps/frontend/app/(admin)/registration/index.tsx` and `apps/frontend/src/registration-requests/admin/admin-inbox.tsx`
- [X] T121 [US10] Implement structured request/evidence review with ordinary Administrator document access wording, exclude evidence consultation from lifecycle history, place the operational timeline at the bottom, and compare runtime screenshots against `docs/design/feature-006/admin/admin-request-evidence-review-desktop.png` and `docs/design/feature-006/admin/admin-request-evidence-review-mobile.png` in `apps/frontend/app/(admin)/registration/[requestId]/index.tsx` and `apps/frontend/src/registration-requests/admin/admin-request-review.tsx`
- [X] T122 [US12] Implement accessible correction/rejection decisions with safe applicant preview and bottom timeline, then compare runtime screenshots against `docs/design/feature-006/admin/admin-correction-rejection-decision-desktop.png` and `docs/design/feature-006/admin/admin-correction-rejection-decision-mobile.png` in `apps/frontend/app/(admin)/registration/[requestId]/decision.tsx` and `apps/frontend/src/registration-requests/admin/admin-correction-rejection.tsx`
- [X] T123 [US11] Implement dossier-name/confirmation, deletion pending/recovery, explicit retry, approval response waiting, and the bottom timeline steps “Información revisada”, “Expediente manual creado”, “Resultado revisado”, “Eliminación segura de evidencias”, “Respuesta enviada”; compare runtime screenshots against `docs/design/feature-006/admin/admin-dossier-approval-deletion-recovery-desktop.png` and `docs/design/feature-006/admin/admin-dossier-approval-deletion-recovery-mobile.png` in `apps/frontend/app/(admin)/registration/[requestId]/approval.tsx` and `apps/frontend/src/registration-requests/admin/admin-dossier-approval.tsx`
- [X] T124 [US10] Record responsive desktop/mobile, keyboard, screen-reader, focus, touch-target, non-color, pagination, viewer cleanup, and bottom-timeline comparisons for all seven Admin references in `specs/006-registration-requests-approval/visual-qa-admin.md`

---

## Phase 11: Final integration and regression verification

**Purpose**: Verify all seven journeys, privacy/authorization, contracts, cross-platform fidelity, and compatibility without expanding scope.

**Checkpoint**: Feature 006 meets every FR/SC, all 31 references have runtime evidence, and Features 001–005 retain ownership outside the approved integration points.

- [X] T125 [US15] Add regression coverage for Feature 003 login/refresh/revocation/logout and non-public internal provisioning/recovery in `apps/backend/test/integration/registration-authentication-regression.integration.spec.ts`
- [X] T126 [US15] Add regression coverage for Feature 004 restoration/accessibility and the replaced public entry, plus Feature 005 existing passports/responsibilities/TUTOR compatibility without reassignment or authority expansion in `apps/frontend/src/registration-requests/compatibility-regression.spec.tsx` and `apps/backend/test/integration/registration-passport-regression.integration.spec.ts`
- [X] T127 [P] Verify the OpenAPI document and implementation remain aligned for all operations, schemas, response envelopes, upload/stream semantics, and safe errors in `apps/backend/test/contract/registration-openapi-implementation.contract.spec.ts`
- [X] T128 [P] Verify filesystem/S3/scanner test doubles cover clean, mismatch, malware, timeout, outage, versioned delete, absent object, lease recovery, and five-attempt exhaustion in `apps/backend/src/registration-requests/evidence/evidence-provider-matrix.spec.ts`
- [X] T129 Run the complete backend unit, contract, and sequential PostgreSQL integration suites and record commands/results without real personal data in `specs/006-registration-requests-approval/verification/backend.md`
- [X] T130 Run frontend Jest, root typecheck/tests, Expo web export, and available native validation; record commands/results and unsupported native checks explicitly in `specs/006-registration-requests-approval/verification/frontend.md`
- [X] T131 Run final privacy/secret canary scans across responses, logs, traces, routes, events, exports, fixtures, frontend persistence, and completed-deletion retrieval attempts; record zero unauthorized protected values in `specs/006-registration-requests-approval/verification/privacy.md`
- [X] T132 Capture runtime screenshots and record a one-to-one visual/accessibility comparison against all 31 exact paths cataloged in `docs/design/feature-006/README.md` in `specs/006-registration-requests-approval/verification/visual-qa-31-references.md`
- [X] T133 Execute every synthetic applicant, Administrator, approval-outcome, failure, concurrency, privacy, responsive, accessibility, cleanup, and compatibility scenario from `specs/006-registration-requests-approval/quickstart.md` and record results in `specs/006-registration-requests-approval/verification/quickstart.md`
- [X] T134 Verify artifact/implementation consistency and scope exclusions—no fabricated sports data, complete Analyst enrichment, transfers, payments, publication, minor accounts, self/bulk/automatic approval, OAuth/MFA/messaging/biometrics/OCR decisions, permanent document storage, or ownership changes outside approved Feature 006 integration points—and record the final gate in `specs/006-registration-requests-approval/verification/final-scope.md`

---

## Dependencies and execution order

### Phase dependencies

1. Phase 1 blocks every later phase.
2. Phase 2 depends on Phase 1 and blocks any authenticated applicant, academy, or Admin operation.
3. Phase 3 depends on Phases 1–2 and blocks submission, review, correction replacement, rejection, and approval.
4. Phase 4 depends on Phases 1–3 and supplies the shared lifecycle/API used by all seven types.
5. Phases 5 and 6 depend on Phase 4; their focused backend work may proceed in parallel because they use separate application/orchestrator files, but their PostgreSQL suites run sequentially.
6. Phase 7 depends on the relevant Phase 4–6 APIs and completes the initial applicant UI.
7. Phase 8 depends on Phases 5–7 and is an intermediate verification boundary only.
8. Phase 9 depends on Phase 4 plus approved-academy outcomes from Phase 6; its three type-specific backend/test streams may proceed in parallel until shared orchestration/integration.
9. Phase 10 depends on the shared Admin API from Phase 4, evidence deletion from Phase 3, and all seven typed outcomes from Phases 5, 6, and 9.
10. Phase 11 depends on every implementation phase and is the final completion gate.

### User story dependencies

| Story | Earliest dependencies | Independent completion test |
|---|---|---|
| US1 Adult personal | Phases 1–4 | Submit and approve one adult to USER + SELF + one private active basic passport awaiting enrichment. |
| US2 Represented minor | Phases 1–4 | Submit and approve one minor to representative USER + LEGAL_REPRESENTATIVE + passport, with zero minor account/contact. |
| US3 Multiple minors | US2 outcome | Approve a second minor for the same USER and require an explicit authorized selector. |
| US4 Formal academy | Phases 1–4 | Submit and approve formal evidence to exactly one academy/responsible/ACADEMY_USER/membership bundle. |
| US5 Natural-person academy | Phases 1–4 | Submit, correct/reject, or approve controlled operation evidence without a legal-certification claim. |
| US6 Additional academy account | US4 or US5 approved academy | Approve only ACADEMY_USER + membership in the derived academy. |
| US7 Academy adult player | Approved academy and active membership | Approve Player + sporting relation + passport with no USER/SELF. |
| US8 Academy minor player | Approved academy and active membership | Approve minor legal and sporting relations + passport with no automatic accounts. |
| US9 Correction/resubmit | Shared lifecycle + evidence | Return one submitted version, replace only permitted evidence/fields, and resubmit with history intact. |
| US10 Unified Admin inbox | Shared Admin query API | List/filter/page all seven types and open safe detail without bulk approval. |
| US11 Dossier approval | All typed outcomes + deletion | Block approval without dossier, delete/verify evidence, then materialize exactly one typed outcome. |
| US12 Rejection/deletion | Evidence + shared decisions | Final rejection creates no outcome and makes completed evidence unrecoverable. |
| US13 Restricted pending access | Phase 2 | Restore pending session to own request only and deny all ordinary product routes/capabilities. |
| US14 Safe duplicates | Shared/private identity boundaries | Exact match blocks atomically; similarity remains private; applicant receives no candidate data. |
| US15 Compatibility | All implementation phases | Existing sessions, memberships, responsibilities, passports, and controlled staff operations remain valid. |

### TDD ordering

- Complete each failing test task before its paired implementation task.
- Contract tests precede controller implementation (`T038` before `T041`/`T043`).
- Authorization tests precede catalog/adapter/controller authorization changes (`T011`/`T013` before `T012`/`T014`).
- Visual component tests precede their corresponding screen tasks (`T077`, `T079`, `T081`, `T083`, `T085`, `T110` before `T078`, `T080`, `T082`, `T084`, `T086`, `T120`–`T123`).
- No PostgreSQL migration or integration task is parallelized; execute those suites sequentially with independent clients.

### Parallel execution notes

- Phase 1: `T005`, `T007`, and `T008` can proceed after schema intent is agreed because they touch separate config/domain test files.
- Phase 3: local and S3 adapter test/implementation streams (`T023`–`T026`) can proceed independently after ports (`T022`).
- Phase 5: age, adult, minor, and duplicate tests (`T047`–`T050`) are parallelizable; approval implementations wait for their focused tests and shared identity services.
- Phase 6: formal, natural-person, and duplicate tests (`T060`–`T064`) can run in parallel; integration remains sequential.
- Phase 7: adult, minor, academy-creation, upload, and status component tests use separate files; screens follow their own tests.
- Phase 9: US6, US7, and US8 validators/tests and outcome tests are separate streams until shared module wiring and database verification.
- Phase 10: inbox, review, decision, dossier, and duplicate-review tests are independent before their respective services; visual screens follow backend capability availability.

---

## Requirements coverage

| Requirements | Primary tasks |
|---|---|
| FR-001–FR-005 | T001–T004, T007–T009, T034–T045 |
| FR-006–FR-008 | T015–T020, T051–T057, T102–T105, T118–T119 |
| FR-009–FR-012 | T039, T047–T055, T060–T066, T096–T101 |
| FR-013–FR-019 | T021–T033, T073–T074, T112–T123 |
| FR-020–FR-023 | T047–T059 |
| FR-024–FR-027 | T060–T070 |
| FR-028–FR-032 | T096–T109 |
| FR-033–FR-036 | T051–T058, T103–T105, T126, T134 |
| FR-037–FR-041 | T042–T043, T110–T124 |
| FR-042–FR-046 | T011–T020, T071–T087 |
| FR-047–FR-050 | T033, T044–T045, T050, T059, T062, T067, T114–T119 |
| FR-051–FR-053 | T020, T075–T076, T094–T095, T125–T134 |

## Success-criterion coverage

| Success criteria | Verification tasks |
|---|---|
| SC-001–SC-002 | T038, T045, T088–T091, T119, T133 |
| SC-003–SC-005 | T015–T020, T047–T049, T071–T076, T092, T125 |
| SC-006 | T051–T059, T119 |
| SC-007 | T060–T070, T090–T091, T119 |
| SC-008–SC-009 | T096–T109, T119 |
| SC-010 | T021–T032, T112–T119, T123, T131 |
| SC-011–SC-013 | T033, T045, T050, T059, T062, T094, T114–T119, T131 |
| SC-014 | T051–T058, T103–T105, T126, T134 |
| SC-015–SC-016 | T011–T014, T029–T030, T042–T043, T110–T124 |
| SC-017 | T071–T087, T106–T109, T120–T124, T130, T132–T133 |
| SC-018–SC-019 | T017–T020, T075–T076, T125–T126 |
| SC-020 | T033, T095, T127–T134 |

## Visual-reference coverage

| Reference set | Task coverage |
|---|---|
| Selection: `docs/design/feature-006/solicitud/request-type-selection-desktop-mobile.png` | T078, T087, T132 |
| Adult identity/review desktop + mobile (4 files) | T080, T087, T132 |
| Represented-minor information/review desktop + mobile (4 files) | T082, T087, T132 |
| Formal-academy information desktop + mobile (2 files) | T084, T087, T132 |
| Natural-person academy information desktop + mobile and review desktop (3 files) | T084, T087, T132 |
| Applicant correction/status desktop + mobile (2 files) | T086, T087, T132 |
| Academy request hub desktop + mobile (2 files) | T106, T132 |
| Additional academy account review desktop + mobile (2 files) | T107, T132 |
| Academy adult-player review desktop + mobile (2 files) | T108, T132 |
| Academy minor-player review desktop + mobile (2 files) | T109, T132 |
| Admin unified inbox desktop (1 file) | T120, T124, T132 |
| Admin request/evidence review desktop + mobile (2 files) | T121, T124, T132 |
| Admin correction/rejection desktop + mobile (2 files) | T122, T124, T132 |
| Admin dossier/approval/deletion/recovery desktop + mobile (2 files) | T123, T124, T132 |

**Coverage total**: 31 of 31 approved references.

---

## Implementation strategy

### Initial vertical slice

1. Complete Phases 1–4.
2. Complete personal and academy-creation backends in Phases 5–6.
3. Complete the initial applicant frontend in Phase 7.
4. Stop at Phase 8 only to validate the bounded initial slice; do not declare Feature 006 complete.

### Full Feature 006 delivery

1. Continue with approved-academy operations in Phase 9.
2. Complete Administrator review, dossier, deletion, recovery, and all typed decisions in Phase 10.
3. Pass every final integration, privacy, compatibility, visual, and scope gate in Phase 11.

### Scope guardrails

- Keep all seven request types in this feature.
- Keep type-specific details and approval outcomes explicit; do not introduce EAV or a generic workflow engine.
- Never store document bytes/base64 in PostgreSQL or persisted frontend state.
- Never infer authorization from a visible control or JWT role label.
- Do not fabricate sports data or implement Analyst enrichment, public profiles, payments, transfers, messaging, OCR decisions, or minor accounts.
- Use only synthetic canaries in tests and preserve Feature 001–005 data/authority outside the approved integration points.
