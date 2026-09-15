---
description: "Dependency-ordered implementation tasks for Cross-platform Authentication Frontend"
---

# Tasks: Cross-platform Authentication Frontend

**Input**: Design documents from `/specs/004-authentication-frontend/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`quickstart.md`, and `contracts/frontend-authentication.md`

**Tests**: Tests are required by the specification and plan. Each focused test must fail once for
the expected pre-implementation reason before its corresponding implementation task. Do not rerun
unchanged failing tests. Use mocks and controlled frontend fixtures; never use real credentials,
tokens, temporary credentials, or Administrator operations.

## Phase 1: Frontend Foundation and Visual System

**Purpose**: Establish the approved Expo-compatible native secure-storage dependency and reusable,
accessible visual primitives before session or route behavior.

- [X] T001 Confirm the installed Expo `~57.0.21`, React Native `0.86.3`, React `19.2.3`, Expo Router `~57.0.20`, TypeScript `~6.0.3`, Node `24.11.0`, and npm `10.8.0` remain unchanged; add only the SDK-compatible `expo-secure-store` resolution in `apps/frontend/package.json` and `package-lock.json` (plan dependency decision).
- [X] T002 [P] Write failing visual-token and reduced-motion tests for deep green-black surfaces, lime primary action, off-white text, dark-green elevated surfaces, visible web focus, stable loading, and motion reduction in `apps/frontend/src/design/tokens.spec.ts` (FR-19, FR-21–FR-23).
- [X] T003 [P] Write failing accessible primitive tests for labeled fields, associated errors, password visibility, 44×44 actions, alerts, loading indicator, and confirmation surface in `apps/frontend/src/design/components/auth-primitives.spec.tsx` (FR-005, FR-022–FR-023, SC-008).
- [X] T004 Implement reference-derived design tokens, responsive breakpoints, reduced-motion values, and vector-style branding/decorative strategy without remote fonts or rendering the reference board in `apps/frontend/src/design/tokens.ts` and `apps/frontend/src/design/brand.tsx` (FR-021–FR-023).
- [X] T005 Implement reusable accessible field, password-toggle, button, alert, loading, modal, and native confirmation-surface primitives in `apps/frontend/src/design/components/auth-primitives.tsx` (FR-005, FR-019, FR-022–FR-023).
- [X] T006 Implement mobile single-column/fixed-action and desktop split-composition layout primitives with safe keyboard behavior and stable loading geometry in `apps/frontend/src/design/components/auth-layout.tsx` (FR-021–FR-023).
- [X] T007 Verify the visual primitive tests and existing Expo runtime/configuration tests in `apps/frontend/src/design/tokens.spec.ts`, `apps/frontend/src/design/components/auth-primitives.spec.tsx`, and `apps/frontend/src/config/public-environment.spec.ts` (SC-007–SC-008).

**Checkpoint**: The visual system is accessible, responsive, dependency-compatible, and contains no
session behavior, external player photograph requirement, or product module.

## Phase 2: Authentication Core

**Purpose**: Deliver the typed API, storage, state-machine, secret-cleanup, and single-flight
refresh foundation that blocks route and screen work.

- [X] T008 [P] Write failing client contract-mapping tests for exactly `/auth/login`, `/auth/initial-credential/replace`, `/auth/refresh`, `/auth/logout`, and `/auth/logout-all`, generic failure, throttling, rejected refresh, unavailable response, and connectivity failure in `apps/frontend/src/authentication/authentication-api.spec.ts` (FR-002, FR-004, FR-006, FR-019).
- [X] T009 [P] Write failing storage tests for memory-only access material, native secure renewable storage, web `sessionStorage` availability checks, memory fallback, no `localStorage`, and complete clearing in `apps/frontend/src/authentication/session-storage.spec.ts` (FR-001, FR-007, FR-010, FR-016, SC-010).
- [X] T010 Write failing state-machine and coordinator tests for restoration states, credential-secret cleanup, one shared refresh flight, one permitted replay, rejected refresh, transport failure, logout invalidation, and loop prevention in `apps/frontend/src/authentication/authentication-state.spec.ts` and `apps/frontend/src/authentication/refresh-coordinator.spec.ts` (FR-001, FR-003–FR-004, FR-007, FR-010, FR-016, FR-018–FR-020).
- [X] T011 Implement typed Feature 003 authentication client and safe response/network classification using only the five approved operations in `apps/frontend/src/authentication/authentication-api.ts` (FR-002, FR-004, FR-006, FR-019, FR-025).
- [X] T012 Implement platform session-storage adapters: native `expo-secure-store`, explicit web `sessionStorage` availability check, in-memory fallback, memory-only access credential, and atomic clearing in `apps/frontend/src/authentication/session-storage.ts` (FR-001, FR-007, FR-010, FR-016, SC-010).
- [X] T013 Implement the explicit authentication state machine, form-secret lifecycle, safe error categories, and logout intents in `apps/frontend/src/authentication/authentication-state.ts` (FR-001, FR-005–FR-020).
- [X] T014 Implement module-level single-flight refresh coordination, one-replay marker, non-recursive renewal, and confirmed-invalid versus transport-failure handling in `apps/frontend/src/authentication/refresh-coordinator.ts` (FR-003–FR-004, FR-018–FR-020, SC-004–SC-005).
- [X] T015 Implement the authentication provider/interface that exposes state and intents without allowing screens to call storage or HTTP directly in `apps/frontend/src/authentication/authentication-provider.tsx` (FR-001, FR-003, FR-013, FR-016).
- [X] T016 Verify core contract, storage, state-machine, coordinator, and existing frontend configuration suites in `apps/frontend/src/authentication/` and `apps/frontend/src/config/public-environment.spec.ts` (SC-001, SC-004–SC-005, SC-009–SC-010).

**Checkpoint**: Shared authentication behavior is typed, single-flight, secret-safe, and testable with
no route or visual screen implementation beyond the Phase 1 primitives.

## Phase 3: Restoration, Login, and Initial Activation

**Purpose**: Deliver the unauthenticated journeys and restoration gate without protected-content
flash; activation success must enter authenticated entry through **“Continuar”**.

**Independent Test**: With mocked client/storage outcomes, start in restoration and exercise valid,
invalid, offline, login, activation, and duplicate-submit paths on narrow and wide viewports.

- [X] T017 [P] [US1] Write failing restoration/navigation tests for loading-before-route-choice, valid renewal, confirmed invalidity, connectivity, unavailable, and no protected-content flash in `apps/frontend/tests/authentication/restoration-navigation.spec.tsx` (FR-001, FR-003–FR-004, SC-001, SC-004).
- [X] T018 [P] [US2] Write failing login component tests for local email/password validation, password visibility, generic failure equality, throttling, connectivity/unavailable state, and duplicate submission in `apps/frontend/tests/authentication/login-screen.spec.tsx` (FR-005–FR-007, FR-019–FR-020, SC-002, SC-009).
- [X] T019 [P] [US3] Write failing activation component/navigation tests for external-channel explanation, exact 12–128-character password rule, confirmation, secret clearing, safe rejection, successful state, and **“Continuar”** entering authenticated entry rather than login in `apps/frontend/tests/authentication/activation-screen.spec.tsx` (FR-008–FR-011, SC-003).
- [X] T020 [US1] Implement the root restoration gate and unauthenticated/authenticated route-group selection so protected content cannot render while restoration is unresolved in `apps/frontend/app/_layout.tsx` and `apps/frontend/app/(auth)/_layout.tsx` (FR-001, FR-003–FR-004).
- [X] T021 [US2] Implement the responsive login screen using Phase 1 primitives, local validation, accessible visibility control, submitting lock, and safe backend states in `apps/frontend/app/(auth)/index.tsx` (FR-005–FR-007, FR-019–FR-023).
- [X] T022 [US3] Implement the separate initial-access activation screen with temporary credential, new-password confirmation, external-channel explanation, secret cleanup, and safe rejection states in `apps/frontend/app/(auth)/activate-initial-access.tsx` (FR-008–FR-011, FR-019–FR-023).
- [X] T023 [US3] Implement activation success presentation and the **“Continuar”** transition to the authenticated route group; do not render or navigate to an “inicio de sesión” continuation action in `apps/frontend/app/(auth)/activate-initial-access.tsx` and `apps/frontend/src/authentication/authentication-provider.tsx` (FR-011–FR-013, SC-003).
- [X] T024 [US1] Verify restoration, login, activation, mobile-width, desktop-width, screen-reader, and navigation suites in `apps/frontend/tests/authentication/` (SC-001–SC-004, SC-007–SC-009).

**Checkpoint**: Users can safely restore, sign in, or activate initial access and enter only a neutral
authenticated boundary; no product dashboard exists.

## Phase 4: Authenticated Entry and Session Closure

**Purpose**: Deliver the neutral authenticated experience, expiration, and clearly scoped session
closure with responsive confirmation behavior.

**Independent Test**: Enter authenticated state through controlled mocks, close current/all sessions,
exercise expiration and transport failure, and verify safe navigation to login.

- [X] T025 [P] [US4] Write failing neutral-entry tests proving no role, identity, passport, statistic, academy, payment, or future-product simulation appears in `apps/frontend/tests/authentication/authenticated-entry.spec.tsx` (FR-012–FR-013, FR-024–FR-025).
- [X] T026 [P] [US5] Write failing logout component/navigation tests for current-versus-all explanation, all-session confirmation, safe local clearing, retryable transport failure, and duplicate-action prevention in `apps/frontend/tests/authentication/logout-flow.spec.tsx` (FR-014–FR-017, FR-020, SC-006, SC-009).
- [X] T027 [P] [US6] Write failing session-expiration tests for shared renewal pending state, rejected refresh, retryable connectivity/unavailable state, no loop, and safe fallback in `apps/frontend/tests/authentication/session-expiration.spec.tsx` (FR-003–FR-004, FR-018–FR-020, SC-004–SC-005).
- [X] T028 [US4] Implement the approved responsive neutral authenticated entry with branding, truthful session actions, future-module indication, and no assumed identity or role content in `apps/frontend/app/(authenticated)/index.tsx` (FR-012–FR-013, FR-021–FR-025).
- [X] T029 [US5] Implement current-session closure, all-session confirmation using web modal/native confirmation surface, correct scope copy, local-clear rules, and retryable failure state in `apps/frontend/app/(authenticated)/index.tsx` and `apps/frontend/src/authentication/authentication-provider.tsx` (FR-014–FR-017, FR-020–FR-023).
- [X] T030 [US6] Implement session-expired, transparent-refresh, connectivity, backend-unavailable, retry, and safe unauthenticated fallback presentation in `apps/frontend/src/authentication/components/session-status.tsx` and `apps/frontend/src/authentication/authentication-provider.tsx` (FR-003–FR-004, FR-018–FR-020).
- [X] T031 [US4] Verify authenticated-entry, logout, expiration, responsive, keyboard, reduced-motion, and navigation suites in `apps/frontend/tests/authentication/` (SC-004–SC-009).

**Checkpoint**: The authenticated boundary remains deliberately neutral and supports safe current/all
session closure without any role-specific or product-module behavior.

## Phase 5: Integration and Final Verification

**Purpose**: Integrate only the approved frontend boundary, verify all platforms and contracts, and
audit scope, secrets, accessibility, and traceability.

- [X] T032 Integrate the provider, storage adapter, API client, refresh coordinator, restoration gate, and the two Expo Router route groups without modifying backend files in `apps/frontend/app/_layout.tsx`, `apps/frontend/app/(auth)/`, `apps/frontend/app/(authenticated)/`, and `apps/frontend/src/authentication/` (FR-001–FR-025).
- [X] T033 [P] Verify every consumed-operation mapping and absence of provisioning/reissue, Administrator, registration, recovery, MFA, social-login, role-dashboard, and product-module frontend behavior in `apps/frontend/src/authentication/authentication-api.spec.ts` and `apps/frontend/tests/authentication/` (FR-002, FR-025, SC-010).
- [X] T034 Run all frontend unit, component, navigation, contract-mock, configuration, and existing runtime suites in `apps/frontend/src/`, `apps/frontend/tests/`, and `apps/frontend/app/` (FR-001–FR-025, SC-001–SC-010).
- [X] T035 Run Expo Web export and browser smoke with a valid public API-base-url fixture in `apps/frontend/tests/smoke/web-startup.spec.ts` and `apps/frontend/package.json` (SC-007).
- [X] T036 Run Android and iOS target smoke validation where an emulator/device is available; record the host-limited iOS simulator case without failing the Windows-host validation in `apps/frontend/tests/smoke/native-targets.spec.ts` (SC-007).
- [X] T037 Run frontend TypeScript validation and verify the Expo-compatible dependency resolution without changing approved runtime versions in `apps/frontend/package.json`, `apps/frontend/tsconfig.json`, and `package-lock.json` (SC-007).
- [X] T038 Execute the Feature 004 quickstart mobile/web restoration, login, activation-**Continuar**, refresh, expiration, logout, responsive, and accessibility scenarios in `specs/004-authentication-frontend/quickstart.md` (SC-001–SC-009).
- [X] T039 Document only implementation-introduced frontend operational details, including explicit web session-storage behavior and no-secret handling, in `docs/desarrollo/autenticacion-frontend.md` (FR-002, FR-007, FR-010, FR-016, SC-010).
- [X] T040 Perform final scope, contract, accessibility, visual-reference, secret-disclosure, and FR-001–FR-025/SC-001–SC-010 traceability audit against `specs/004-authentication-frontend/spec.md`, `plan.md`, `data-model.md`, `contracts/`, `quickstart.md`, and `tasks.md` (FR-001–FR-025, SC-001–SC-010).

**Checkpoint**: Feature 004 is verified as an accessible, responsive, frontend-only authentication
boundary with no backend expansion or unapproved product scope.

## Dependencies and Execution Order

`Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5`.

- Phase 1 provides visual primitives and compatible storage dependency selection.
- Phase 2 blocks screens and routing because it owns state, storage, API mapping, and refresh safety.
- Phase 3 delivers restoration/login/activation and depends on Phase 2.
- Phase 4 adds authenticated entry/session closure after the Phase 3 route boundary exists.
- Phase 5 verifies the completed integrated feature only.

## User Story Dependencies

| Story | Phase | Depends on |
|---|---|---|
| US1 — Restore session | 3 | Phases 1–2 |
| US2 — Credential login | 3 | Phases 1–2 |
| US3 — Activate initial access | 3 | Phases 1–2 |
| US4 — Neutral authenticated entry | 4 | Phases 1–3 |
| US5 — Close sessions | 4 | Phases 1–3 |
| US6 — Expiration/connectivity | 4 | Phases 1–3 |

## Parallel Opportunities

- Phase 1: T002 and T003 own separate test files; T004, T005, and T006 follow their relevant tests.
- Phase 2: T008 and T009 may be authored in parallel; T010–T015 remain serialized around the shared authentication behavior.
- Phase 3: T017–T019 are independent focused tests; T021 and T022 can proceed after T020 and Phase 2 are complete.
- Phase 4: T025–T027 are independent focused tests; T028 and T030 can proceed after Phase 3, while T029 shares the provider and remains serialized.
- Phase 5: T033 and T039 can run in parallel after integration; T034–T038 retain their stated verification order.

## Implementation Strategy

Implement one numbered phase per future `$speckit-implement` invocation. Each phase authorizes
ordinary in-scope fixes for TypeScript, Expo, routes, mocks, storage, responsive layout,
accessibility, tests, and builds. Resume at the first unfinished task if interrupted. Stop only for
a material product decision, incompatible approved dependency replacement, destructive non-test
data operation, unavailable permission, or work outside the active phase.

## Requirement Coverage

| Coverage | Tasks |
|---|---|
| FR-001–FR-004 | T008–T020, T024, T027, T030, T032–T040 |
| FR-005–FR-011 | T018–T024, T032–T040 |
| FR-012–FR-017 | T023, T025–T031, T032–T040 |
| FR-018–FR-020 | T010–T016, T018, T027, T030–T040 |
| FR-021–FR-023 | T002–T007, T021–T022, T028–T040 |
| FR-024–FR-025 | T025, T028, T033–T040 |
| SC-001–SC-005 | T010, T017–T024, T027, T030–T040 |
| SC-006–SC-010 | T003, T025–T040 |

## Format Validation

All 40 tasks use `- [ ] T### [P?] [US?] description with path`; story labels occur only in
story phases, identifiers are consecutive, and every task has a concrete repository-relative path.
