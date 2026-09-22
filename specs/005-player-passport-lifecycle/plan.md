# Implementation Plan: Pasaporte del jugador — ciclo de vida y experiencia vertical

**Branch**: `feature/005-player-passport-lifecycle`
**Specification**: `specs/005-player-passport-lifecycle/spec.md`
**Status**: Reconciled design; implementation pending

## Summary

Feature 005 delivers one authenticated vertical slice across NestJS, PostgreSQL/Prisma and Expo mobile/web. It preserves the implemented lifecycle and visual passport while correcting the particular-account model: `USER` is the generic account role; authority over a passport comes from `SELF`, `LEGAL_REPRESENTATIVE`, `ACADEMY`, or an explicit internal capability. Creation, relationship establishment and audit remain atomic.

The correction is additive and compatibility-safe. New particular passports use origin `PARTICULAR`; historical `TUTOR` origin and role facts remain readable but grant no authority by themselves. Colombia (`America/Bogota`) and 18 completed years govern product age decisions. No client-provided `isAdult`, payment, document entry, historical role or creator identity can confer access.

## Technical Context

- **Backend**: Node.js 24, TypeScript, NestJS, Prisma 7, PostgreSQL.
- **Frontend**: Expo Router, React Native/Web and the Feature 004 authenticated shell.
- **Tests**: Vitest/Supertest for backend; Jest and Testing Library for frontend.
- **Authentication**: existing Feature 003 bearer/session mechanism, unchanged.
- **Authorization**: existing Feature 002 catalog/evaluator, extended with current relationship and age facts.
- **Sensitive data**: application-layer encryption plus keyed fingerprints for normalized documents; no sensitive values in logs, traces or sports presentation.
- **Time policy**: injected backend clock, calendar date in `America/Bogota`, majority threshold 18, 29 February anniversary on 1 March in non-leap years.
- **Visual authority**: `docs/design/passport-*.png`; no production use of representative names, values or portrait.
- **Scope**: lifecycle, authorized histories, basic profile, responsive shell and unavailable future tabs. No public profile, payments, transfers, media, FEM, matches, calculated statistics or minor login.

## Constitution Check

| Principle | Design response |
|---|---|
| I. Modular bounded contexts | Player passport owns lifecycle, relationships and private representation facts; identity, memberships and sessions remain in Features 002–003. |
| II. Contract-first integration | OpenAPI, authorization and frontend contracts define the corrected boundary before implementation. |
| III. Test-first behavior | Every corrective implementation group begins with failing unit/contract/integration or frontend tests. |
| IV. Secure defaults | Deny by default; backend date and persisted facts are authoritative. |
| V. Transactional integrity | Passport, player, relationships, confirmation consumption and audit commit together or not at all. |
| VI. Privacy by design | Ordinary histories filter duplicate-review events; immutable internal audit remains available only to authorized operators. |
| VII. Traceable state changes | Lifecycle and reconciliation append evidence without rewriting historical events. |
| VIII. Accessible cross-platform UX | Existing responsive identity shell and accessibility baseline are preserved. |
| IX. Truthful completion | Existing T001–T065 remain historical completed scope; correction tasks are separate and uncompleted. |
| X. Spec-code convergence | Final verification is deferred until the correction tasks are implemented. |
| XI. Ordered delivery | Correction precedes final integration gates. |
| XII. Minimal dependencies | Reuse current crypto, auth, validation, persistence and UI stack. |

No constitution exception is required.

## Project Structure

### Documentation

```text
specs/005-player-passport-lifecycle/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── checklists/requirements.md
└── contracts/
    ├── passport-lifecycle.openapi.yaml
    ├── lifecycle-authorization.md
    └── frontend-passport-presentation.md
```

### Implementation surfaces

```text
apps/backend/
├── prisma/
├── src/authorization/
├── src/authentication/
├── src/player-passport/
└── test/{contract,integration}/

apps/frontend/
├── app/(authenticated)/passports/
├── src/passport/
└── tests/passport/
```

## Architecture and Design Decisions

### 1. Account role, origin and authority are separate

- Add `USER` as the generic particular account role without internal or organizational permissions.
- Retain `TUTOR` temporarily as a historical compatibility value. A `TUTOR` assignment alone authorizes nothing in Feature 005.
- Extend `PassportOrigin` with `PARTICULAR`; keep historical `TUTOR` and current `ACADEMY` values readable. New particular creation writes `PARTICULAR`.
- Persist passport authority as explicit responsibility facts: `SELF`, `LEGAL_REPRESENTATIVE`, and `ACADEMY`.
- A `USER` can have at most one active `SELF` relationship, but can have multiple active representative relationships to minors.
- Academy management follows active membership in the passport's academy, not `createdByIdentityId`.

### 2. Representation confirmation

- A particular `USER` creating for a minor confirms their own representation in the authenticated creation operation.
- An academy cannot confirm for the representative. Before academy creation, the identified representative uses an authenticated endpoint to create a single-use confirmation bound to the player's normalized-document fingerprint.
- The confirmation expires after 24 hours, is consumed only inside successful academy creation, and contains no contact data.
- Persist representative identity, encrypted legal name/document data, declared relationship (`MOTHER`, `FATHER`, `LEGAL_GUARDIAN`), confirmation actor and time. This is product evidence, not judicial certification.
- Confirmation identifiers and private facts never enter sports presentation, ordinary history or denial responses.

### 3. Age policy

- Implement one injectable backend age-policy service used at create, submit and every age-sensitive authorization.
- Validate a real, non-future date of birth and calculate completed years using the current Colombia calendar date.
- Before the 18th birthday the player is a minor; from the birthday the player is an adult. A 29 February birth reaches its non-leap-year anniversary on 1 March.
- Ignore and reject `isAdult` as an authority input. Declared football category remains independent.
- If a represented minor becomes adult, historical responsibility remains, but representative mutations return safe `No disponible`; no `SELF`, account or transfer is created.
- An editable date correction that makes the current relationship incompatible is rejected atomically.

### 4. Persistence and migration

Create one new additive migration after the current Feature 005 migration:

- add `USER` and `PARTICULAR` enum values while retaining historical values;
- add responsibility, representative-confirmation and reconciliation-audit structures described in `data-model.md`;
- add an authorized academy display name if the current academy record lacks one, without adding contact fields;
- add partial/compound unique constraints for one passport per player, one `SELF` passport per identity, responsibility uniqueness and one-time confirmation consumption;
- update origin integrity constraints to permit `PARTICULAR`, preserve historical `TUTOR`, and require academy identity only for `ACADEMY`;
- add indexes for actor relationships, academy portfolio, confirmation fingerprint/expiry and filtered histories.

Migration SQL is reviewed before applying. Existing migrations and historical rows are never rewritten.

### 5. Controlled TUTOR reconciliation

- Run an idempotent reconciliation service/command under explicit operational control, never during login, token refresh or normal reads.
- Preserve identity IDs, role assignments, passport origin, `InitialTutorResponsibility` and all old audit rows.
- Create a `LEGAL_REPRESENTATIVE` responsibility only where a historical relationship is complete, the player is a minor under the current policy, and required authority evidence has been confirmed.
- Never infer `SELF` from `TUTOR`, matching names, documents, payment or creator identity.
- Incomplete or ambiguous records remain unchanged and unauthorized, with a non-sensitive reconciliation result appended to audit.

### 6. Authorization

- Add particular create/manage/history capabilities for `USER`; retain academy and internal capabilities independently.
- The evaluator receives current relationship, academy membership, lifecycle state, age-policy result and information classification.
- `USER` plus `SELF` authorizes own-passport operations; `USER` plus current `LEGAL_REPRESENTATIVE` authorizes permitted minor operations.
- `ACADEMY_USER` plus active membership authorizes the academy portfolio and eligible lifecycle operations, regardless of which employee created the record.
- Analyst review and Administrator activation remain separate capabilities. Identities holding both are evaluated operation by operation.
- Existing `passport.tutor.*` permissions become compatibility aliases only after a verified relationship has been reconciled; they do not make the role authoritative.

### 7. Lifecycle, duplicate prevention and audit

- Keep states `DRAFT`, `IN_REVIEW`, `RETURNED_FOR_CORRECTION`, `APPROVED`, `ACTIVE` and existing legal transitions.
- Exact normalized document fingerprint uniqueness rejects a second passport atomically without disclosure.
- Name/date similarity may create a private signal and does not block submission; unresolved signals block approval.
- Duplicate review is immutable internal audit. Ordinary particular/academy history excludes signal detection, candidate data and every duplicate-resolution event or detail.
- Internal history is a separate authorized projection for Analysts/Administrators and never includes raw document numbers, birth date or complete declarations.
- Any transition, relationship creation, confirmation consumption or trace failure rolls back the complete operation.

### 8. HTTP contract

- Preserve current passport lifecycle routes and safe 401/403/404/409 behavior.
- Add authenticated representative-confirmation creation for the academy-minor flow.
- Creation explicitly selects `SELF`, `LEGAL_REPRESENTATIVE`, or `ACADEMY`; the backend derives age and validates that combination.
- Split ordinary history and internal history projections. Ordinary clients cannot request internal event classes through parameters.
- Private editable data is exposed only by an authorized draft-detail contract, never by sports presentation.
- Responses use `Cache-Control: no-store`; protected denials do not confirm existence.

### 9. Frontend behavior

- After authentication and authorization resolution, one accessible particular passport opens `Resumen`; multiple particular passports open an explicit player selector.
- Academy context always opens its portfolio, even with one result. Particular and academy contexts never merge implicitly.
- An active passport opens `Resumen`; lifecycle status/history remain secondary routes.
- Particular creation offers “mi pasaporte” or “represento a un menor” according to backend capabilities. Academy minor creation requires a valid representative confirmation.
- Forms explain that age is determined by the server and never collect an authoritative adult checkbox.
- Draft/private editing may include date of birth only through the protected draft contract. Presentation never receives it.
- Existing persistent identity, platform navigation, liquid-glass direction and neutral photograph marker remain unchanged.
- `Estadísticas`, `Partidos` and `Videos` stay explicitly unavailable pending their own features.

## Verification Strategy

Corrective work is test-first and ordered:

1. Contract and migration tests fail for `USER`, relationships, confirmation privacy, age boundaries and academy portfolio behavior.
2. Unit tests cover Colombia dates, leap-day handling, role/relationship separation, history projection and reconciliation idempotency.
3. Integration tests cover atomic creation, concurrency, confirmation consumption, changing memberships, birthday transitions and non-disclosure.
4. Frontend tests cover entry routing, selector/portfolio separation, representative forms, unavailable mutations and private-history filtering.
5. Regression tests prove login/session mechanisms, existing internal capabilities, lifecycle transitions and visual/accessibility behavior remain intact.
6. Only after all correction tasks are complete run typecheck, all test suites, web export, migration verification, quickstart and artifact consistency checks.

## Complexity Tracking

| Complexity | Why required | Containment |
|---|---|---|
| Historical `TUTOR` compatibility | Existing data and completed work use the former premise. | Retain values read-only, reconcile explicitly, never grant authority from the role alone. |
| Private representative confirmation | Academy-created minors require proof that the representative acted. | One authenticated, short-lived, single-use confirmation; no documents or declarations in public projections. |
| Age-sensitive authority | Authority changes at the Colombia birthday boundary. | One backend policy service with injected clock and no client authority. |
| Two history projections | Ordinary users must not see private duplicate-review events while operators retain immutable audit. | Separate fixed projections and authorization capabilities, not a client filter. |

## Planned Implementation Sequence

1. Freeze corrected contracts and write failing backend contract/unit tests.
2. Add reviewed additive migration and persistence tests.
3. Implement age policy, responsibilities, representative confirmation and controlled reconciliation.
4. Correct authorization catalog/adapter and academy portfolio semantics.
5. Correct lifecycle services, private draft editing and history projections.
6. Update frontend contracts, forms, context routing and authorized history UI.
7. Reconcile fixtures and privacy/regression coverage.
8. Run final integration and documentation verification only after steps 1–7 pass.
