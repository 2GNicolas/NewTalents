# Tasks: First Match Passport Flow

**Input**: `specs/009-first-match-flow/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`.

**Scope**: First-match invitation, scheduling, pre-load correction, persistent waiting, allowance accounting, trusted load boundary, and direct Administrator continuation to existing manual custody. Analyst data entry, FEM, payments, plans, publication and subsequent-match management are excluded.

**Tests**: Focused contract, integration, concurrency, frontend, privacy and visual verification are required by the plan, specification and constitution. These are future implementation tasks; generating this list runs no tests.

## Phase 1: Setup (shared test infrastructure)

**Purpose**: Reuse existing test conventions without adding a new service or substitute Analyst workflow.

- [X] T001 Create synthetic active-passport, responsibility, custody, Feature 008 revision and date-boundary fixtures in `apps/backend/test/first-match-test-helpers.ts`; completion: tests can obtain passports with/without custody and controlled reserved/used periods without real personal data.

---

## Phase 2: Foundational (blocks the user stories)

**Purpose**: Establish one durable match-owned unit and the same passport serialization boundary used by Feature 008.

- [X] T002 Add `FirstMatch` and `FirstMatchIntent` to `apps/backend/prisma/schema.prisma` with migration `apps/backend/prisma/migrations/20261013090000_first_match_flow/migration.sql`; completion: restrictive passport/player references, `playerId = PlayerPassport.playerId`, `(WAITING, RESERVED)` / `(CANCELED, RELEASED)` / `(LOADED, USED)` checks, partial unique current match (`WAITING` or `LOADED`) per passport, unique passport/idempotency key and successful `loadId`, and retained canceled history are enforced by PostgreSQL. Preserve the data-model fields `matchDate` (date-only), `matchTime` (local time), immutable `scheduledByIdentityId`/`scheduledAt`, monotonic `version`, and load/cancel actor/time pairs. Match labels are required non-empty with `maxLength: 160`; date is `YYYY-MM-DD` and time is `HH:mm` per `contracts/first-match.openapi.yaml`.
- [X] T003 Expose the existing serializable `PlayerPassport` row-lock transaction for first-match commands in `apps/backend/src/passport-match-allowance/persistence/allowance-transaction.runner.ts` and `apps/backend/src/first-match/persistence/first-match.repository.ts`; completion: booking, correction, load transition and allowance confirmation share lock order, bounded retry and one transaction, while distinct passports do not share a usage lock.
- [X] T004 Add match-owned unit queries in `apps/backend/src/first-match/persistence/first-match.repository.ts` using `apps/backend/src/passport-match-allowance/application/allowance-period-query.ts`; completion: each `RESERVED` or `USED` match date contributes once to its Feature 008 `[start, endExclusive)` period, `RELEASED` contributes zero, and missing configuration remains distinct from zero availability, including Colombia anniversaries and cadence changes.
- [X] T005 Add the first-match Nest module wiring in `apps/backend/src/first-match/first-match.module.ts` and `apps/backend/src/app.module.ts`; completion: existing responsibility, custody and allowance services can be injected without changing their authorization contracts or exposing the trusted load port as HTTP.

**Checkpoint**: Database invariants and passport-scoped atomic boundary exist before story commands.

---

## Phase 3: User Story 1 — Invite and schedule the first match (P1, MVP)

**Goal**: Authorized responsible actors see a full-screen invitation and schedule one `WAITING/RESERVED` first match, even without Analyst custody.

**Independent test**: With an `ACTIVE` passport and effective capacity, schedule once, retry the same intention, reload from another session, and observe the same waiting match/unit; reject ineligible, unauthorized, unconfigured and full cases without mutation.

### Focused tests (write before story implementation)

- [X] T006 [P] [US1] Add `GET` flow/preview and `POST` schedule contract cases from `specs/009-first-match-flow/contracts/first-match.openapi.yaml` in `apps/backend/test/contract/first-match.contract.spec.ts`; completion: field limits (`maxLength: 160`), date/time formats, safe `404/409/422/503`, no-store responses and minimal projections are asserted.
- [X] T007 [P] [US1] Add booking, no-custody, authorization, same-key replay, last-slot and Colombia period-boundary tests in `apps/backend/test/integration/first-match-scheduling.integration.spec.ts`; completion: one current match and one reserved unit, `reserved + used <= limit`, no partial write and no duplicate on retry are asserted.

### Implementation blocks

- [X] T008 [US1] Implement live `ACTIVE`/responsibility checks, date-only Feature 008 resolution, `reserved + used` admission and atomic `WAITING/RESERVED` creation with immutable actor and idempotent intent in `apps/backend/src/first-match/application/first-match-command.ts`; completion: a same-key/same-digest replay returns its prior result, a changed or stale intention conflicts, and Analyst assignment is never required.
- [X] T009 [US1] Implement authorized flow/availability projections and `GET`/`POST` HTTP endpoints in `apps/backend/src/first-match/application/first-match-query.ts` and `apps/backend/src/first-match/http/first-match.controller.ts`; completion: direct-ID denial hides missing/unauthorized resources, preview is advisory, errors are safe, and the waiting state is read from durable data rather than client memory.
- [X] T010 [P] [US1] Add typed client operations and server-derived flow state in `apps/frontend/src/first-match/first-match-api.ts` and `apps/frontend/src/first-match/first-match-state.ts`; completion: retry keeps one intent key, a capacity conflict refreshes state, and session/device reload re-fetches the match without caching protected details after access loss.
- [X] T011 [US1] Route eligible active passports to a dedicated first-match flow in `apps/frontend/app/(authenticated)/passports/[passportId]/index.tsx` and `apps/frontend/app/(authenticated)/passports/[passportId]/first-match.tsx`; completion: invitation/form/waiting use the existing identity shell without the passport presentation menu, while `LOADED` or unrelated states retain the permitted Feature 005 destination.
- [X] T012 [US1] Build desktop/mobile invitation and scheduling/confirmation views in `apps/frontend/src/first-match/first-match-invitation.tsx` and `apps/frontend/src/first-match/first-match-form.tsx`; completion: date, time, opponent, competition and venue are required; selected-date availability counts reserved plus used; unconfigured/full/error states preserve input; the form's “Cancelar” only discards an unconfirmed edit; runtime copy does not promise an Analyst when none is assigned. Use the four corresponding invitation/form PNGs under `docs/design/feature-009/` without altering them.
- [X] T013 [US1] Add focused invitation, form, persistence, denial and menu-free navigation tests in `apps/frontend/src/first-match/first-match-flow.spec.tsx`; completion: desktop/mobile state hierarchy, required fields, safe retry and no-custody booking path are asserted.

**Checkpoint**: US1 can be verified without US2–US4; the booking remains reserved while waiting.

---

## Phase 4: User Story 2 — Reschedule or cancel before load (P1)

**Goal**: Move the same reserved unit only when a destination has capacity, release it exactly once on pre-load cancellation, and reject overfilling Feature 008 revisions.

**Independent test**: Reagendar dentro del mismo período y entre períodos, rechazar una fecha sin configuración o datos inválidos sin alterar el partido, cancelar una vez y recuperar la invitación. Confirmar cambios válidos de límite o periodicidad con una única unidad `RESERVED` o `USED` y conservar el período aplicable. La guarda de sobrecupo se verifica por separado con conteos sintéticos unitarios.

### Focused tests (write before story implementation)

- [X] T014 [P] [US2] Add `PUT` reschedule and `POST` cancel contract cases in `apps/backend/test/contract/first-match-correction.contract.spec.ts`; completion: expected version/idempotency, safe conflicts, input bounds and no post-load correction match the OpenAPI contract.
- [X] T015 [P] [US2] Add PostgreSQL checks with valid rows for same/cross-period rescheduling, unchanged match/date/details/unit on missing destination configuration or invalid input, stale versions, idempotent retries, exactly-once pre-load cancellation and invitation restoration in `apps/backend/test/integration/first-match-correction.integration.spec.ts`; completion: the same match/unit moves on success, every rejected move preserves the prior row, and a canceled row remains auditable without a second release.
- [X] T016 [P] [US2] Add PostgreSQL checks with valid rows for accepted limit/cadence revisions and `[start, endExclusive)` boundaries in `apps/backend/test/integration/admin-passport-allowance-first-match.integration.spec.ts`; completion: the existing `RESERVED` or `USED` match and unit remain unchanged, current/earlier periods retain Feature 008 semantics, and the proposed rule applies from its effective boundary. Keep synthetic `RESERVED + USED` overfill-rejection coverage in `apps/backend/src/passport-match-allowance/application/allowance-update-concurrency.spec.ts` explicitly as a unit guard check, not PostgreSQL integration evidence.

### Implementation blocks

- [X] T017 [US2] Implement versioned, idempotent reschedule/cancel under the shared passport lock in `apps/backend/src/first-match/application/first-match-command.ts`; completion: same-period reschedule excludes its own unit once, cross-period reschedule moves the same unit and match together, cancellation changes `WAITING/RESERVED` to `CANCELED/RELEASED` once, and no `LOADED/USED` unit is moved or released.
- [X] T018 [US2] Add authorized `PUT` and cancel `POST` handlers in `apps/backend/src/first-match/http/first-match.controller.ts`; completion: failed validation/conflict returns a safe recoverable response without partial mutation or another passport's details.
- [X] T019 [US2] Guard Feature 008 allowance confirmation in `apps/backend/src/passport-match-allowance/application/allowance-command.ts`; completion: under the same passport lock, regroup unchanged match dates with `RESERVED` or `USED` units by proposed effective periods, reject if any `reserved + used` exceeds its proposed limit, preserve current/earlier Feature 008 semantics, and never auto-cancel, release or move a match.
- [X] T020 [US2] Build persistent waiting details and approved secondary “Reagendar” / “Cancelar partido” actions below them in `apps/frontend/src/first-match/first-match-waiting.tsx` and connect them from `apps/frontend/app/(authenticated)/passports/[passportId]/first-match.tsx`; completion: both desktop/mobile stay full-screen without passport menu, edit uses the same match/form, cancel has a distinct confirmation, failures retain original waiting details, and the actions vanish after load. Use both waiting PNGs as the visual base without editing them.
- [X] T021 [US2] Add focused correction and waiting-action tests in `apps/frontend/src/first-match/first-match-correction.spec.tsx`; completion: desktop/mobile placement below details, form-discard versus booked-match cancellation, original-state restoration and post-load action removal are asserted.

**Checkpoint**: US2 remains independently verifiable from its booked-match precondition; allowance changes cannot overfill existing reserved or used units.

**Evidencia de T020–T021 (2026-10-13)**: Las vistas de espera usan las referencias aprobadas de escritorio y móvil sin modificar los PNG, muestran los datos persistidos y ubican «Reagendar» y «Cancelar partido» debajo. Reagendar conserva el identificador y la unidad mediante los comandos existentes; cancelar un partido requiere confirmación independiente del «Cancelar» del formulario. En pruebas enfocadas de frontend pasaron 14/14 casos de `first-match-correction.spec.tsx`, `first-match-flow.spec.tsx` y `first-match-route.spec.tsx`; los typechecks de frontend y backend, la exportación web y `git diff --check` pasaron. La verificación visual integral y de accesibilidad contra las seis referencias sigue reservada para T032.

**Límite de evidencia de T015–T016**: La restricción PostgreSQL permite como máximo un primer partido `WAITING` o `LOADED` por pasaporte y Feature 008 exige un límite positivo. Por ello, con las filas válidas de este modelo no se puede crear otro primer partido que llene el período de destino ni un conjunto mixto `RESERVED + USED` que sobrepase una propuesta. Las pruebas PostgreSQL no afirman reproducir esos estados; la guarda defensiva de sobrecupo se prueba con conteos sintéticos a nivel unitario, sin modificar las restricciones ni los requisitos funcionales.

**Evidencia de T015–T016 (2026-10-13)**: `first-match-correction.integration.spec.ts` pasó 5/5 casos y `admin-passport-allowance-first-match.integration.spec.ts` pasó 2/2, ambos con filas válidas en una base PostgreSQL aislada mediante `run-feature-009-foundation.mjs`, ejecutados secuencialmente y con eliminación posterior de la base temporal. `allowance-update-concurrency.spec.ts` pasó 7/7 casos unitarios, incluidos los conteos sintéticos de la guarda; el typecheck del backend y `git diff --check` pasaron. Esta evidencia no atribuye un rechazo por sobrecupo a PostgreSQL.

---

## Phase 5: User Story 3 — Continue Administrator to manual Analyst assignment (P2)

**Goal**: After a completed approval creating an `ACTIVE` passport or explicit activation, open the existing custody detail for that exact passport without assigning automatically.

**Independent test**: Complete each success path and confirm the exact custody route; pending evidence deletion, missing passport or abandoned custody selection does not assign or undo approval/activation.

### Focused tests (write before story implementation)

- [X] T022 [P] [US3] Add completed/pending approval navigation tests in `apps/frontend/src/registration-requests/admin/admin-dossier-approval.spec.tsx`; completion: only a final `ACTIVE` passport result with ID opens `/(admin)/admin/custody/[passportId]`, while deletion/recovery/absent-passport states do not.
- [X] T023 [P] [US3] Add explicit activation navigation and manual-custody regression tests in `apps/frontend/src/passport/passport-activation-custody.spec.tsx`; completion: successful activation opens the correct existing custody detail and backing out leaves custody unchanged.

### Implementation blocks

- [X] T024 [US3] Continue final passport-producing approval directly to the existing manual custody route in `apps/frontend/app/(admin)/registration/[requestId]/approval.tsx`; completion: navigation waits for the applicable final result/`ACTIVE` passport ID, does not treat evidence deletion as completion, and does not alter approval or assignment semantics.
- [X] T025 [US3] Continue successful explicit activation to the same manual custody route in `apps/frontend/app/(authenticated)/passports/[passportId]/activate.tsx`; completion: activation remains committed even if the Administrator leaves the assignment flow, and selection/confirmation is still manual under Feature 007.

**Checkpoint**: US3 changes navigation only; no new custody or Analyst workflow is introduced.

**Evidencia de T022–T025 (2026-10-13)**: La continuación usa el resultado final `approved`/`APPROVED` con pasaporte `ACTIVE` e ID, o la activación exitosa del mismo pasaporte, para abrir su detalle existente de Custodia. La aprobación pendiente reconsulta el resultado con la misma intención; recuperación, falta de ID y resultado no activo no navegan. Cancelar la selección de Analista no invoca la asignación ni revierte la mutación previa. Pasaron 38/38 casos en siete suites enfocadas/de regresión de frontend y el typecheck de frontend.

---

## Phase 6: User Story 4 — End waiting at confirmed Analyst load (P2)

**Goal**: Define a trusted, transaction-composable completion port so future Analyst data entry can end waiting and convert the same unit from `RESERVED` to `USED` exactly once.

**Independent test**: Invoke the port from a test-only future-owner transaction that confirms durable data for the same match; valid current custody loads once, while failed/foreign/duplicate/revoked or racing signals do not end waiting or double-count.

### Focused tests (write before story implementation)

- [X] T026 [P] [US4] Add the trusted boundary's contract tests in `apps/backend/src/first-match/application/confirmed-load.service.spec.ts`; completion: caller must supply a stable `loadId`, matching match/passport and confirmed durable result, and the port has no public HTTP route or substitute data-entry UI.
- [X] T027 [P] [US4] Add transaction and custody-race tests in `apps/backend/test/integration/first-match-load.integration.spec.ts`; completion: same-transaction rollback prevents `LOADED/USED` without durable confirmation, current custody/role/identity are rechecked, duplicate `loadId` is idempotent, and cancel/reschedule/load races have one coherent winner.

### Implementation blocks

- [X] T028 [US4] Implement `confirmFirstMatchDataLoad` as the internal transaction-composable port in `apps/backend/src/first-match/application/confirmed-load.service.ts`; completion: a trusted future producer can join its durable confirmation transaction, revalidate Feature 007 custody, role and active identity under the passport lock, atomically persist `WAITING/RESERVED → LOADED/USED` for the same match/date/unit, and reject attempted, foreign, stale or duplicate-conflicting signals without new consumption. Do not implement the future producer or expose a client-callable endpoint.
- [X] T029 [US4] Present `LOADED` as a safe operational handoff in `apps/frontend/src/first-match/first-match-state.ts` and `apps/frontend/app/(authenticated)/passports/[passportId]/first-match.tsx`; completion: waiting ends after server-confirmed load, no first-match invitation or pre-load actions return, and no unpublished sports/Analyst data or Administrator approval appears.

**Checkpoint**: US4's boundary is testable without implementing Analyst data capture; `USED` remains counted in the match-date period.

**Evidencia de T026–T029 (2026-10-13)**: El puerto interno recibe la transacción serializable del llamador y un verificador confiable que lee la confirmación durable del mismo partido y `loadId` en esa transacción; los rechazos lanzan un error tipado y abortan ambas escrituras. El futuro productor deberá respetar este contrato; todavía no existe aquí. No hay endpoint ni productor deportivo. Pasaron 3/3 casos de contrato, 4/4 casos de integración PostgreSQL con tabla de confirmación exclusivamente de prueba y 17/17 casos frontend enfocados. Los cinco archivos de integración Feature 009 se ejecutaron secuencialmente en una base PostgreSQL aislada, eliminada después; pasaron los typechecks de backend y frontend. La vista solo sale de espera tras una lectura `LOADED` del servidor y descarta acciones y datos internos no permitidos.

---

## Final phase: Focused cross-cutting verification

**Purpose**: Exercise the combined invariants, privacy and approved desktop/mobile references without broad, unrelated suites.

- [X] T030 [P] Add PostgreSQL race coverage in `apps/backend/test/integration/first-match-concurrency.integration.spec.ts`; completion: last-slot double booking, distinct-passport isolation, booking versus allowance revision, load versus cancel/reschedule, same-intent replay and stale different intent never overbook, double-count, release `USED` or leave partial writes.
- [X] T031 [P] Add response/audit privacy coverage in `apps/backend/test/contract/first-match-privacy.contract.spec.ts`; completion: public/responsible projections and safe errors reveal no civil identity, evidence, internal Analyst data or provisional metrics, while authorized audit retains actor/time for schedule, move, release and `RESERVED → USED`.
- [X] T032 [P] Add focused desktop/mobile visual and accessibility verification in `apps/frontend/src/first-match/first-match-visual.spec.tsx` against `docs/design/feature-009/first-match-invitation-desktop.png`, `docs/design/feature-009/first-match-invitation-mobile.png`, `docs/design/feature-009/first-match-scheduling-desktop.png`, `docs/design/feature-009/first-match-scheduling-mobile.png`, `docs/design/feature-009/first-match-waiting-desktop.png`, and `docs/design/feature-009/first-match-waiting-mobile.png`; completion: all six hierarchies, menu-free full-screen composition, desktop two-column/mobile stacked form, approved actions below waiting details, safe areas, keyboard/screen-reader flow and loading/error/restricted/unavailable states have recorded evidence; PNGs remain unchanged. Alcance de la verificación de este turno: Chrome web de escritorio y viewport móvil, semántica del árbol accesible; no pruebas nativas ni locución de lector de pantalla.
- [X] T033 Reconcile the four stories and FR-001–018 against `specs/009-first-match-flow/quickstart.md` using only focused Feature 009 checks; completion: record passing/failing evidence for booking, correction, Administrator continuation, trusted load, mixed reserved/used revision guard and SC-001 timing, with no claim that future Analyst entry, FEM, payments or later-match management was implemented.

**Evidencia de T030–T033 (2026-10-13)**: [Conciliación](verification/acceptance-review.md) y [revisión visual](verification/visual-review.md). Siete suites PostgreSQL secuenciales pasaron 26/26 casos en una base local aislada y eliminada después (T030: 4/4, repetida también 4/4; T031: 2/2); pasaron 18/18 casos backend sin PostgreSQL, 30/30 frontend y ambos typechecks. Un conflicto `40001` del adaptador `pg` motivó reconocerlo en el reintento serializable compartido. La evidencia inicial de T032 era un montaje no autenticado con el formulario móvil defectuoso; la revisión visual enlazada documenta capturas posteriores de la ruta autenticada, las seis comparaciones y un recorrido real de programación, recarga, reagendamiento y cancelación en Chrome de escritorio y móvil. Los arreglos de payload de reagendamiento y refresco del cupo tuvieron 21/21 pruebas enfocadas y typecheck de frontend correctos. La evidencia T032 es web: no se atribuyen pruebas nativas ni locución de lector de pantalla. SC-001 no se cronometró. La guarda mixta de sobrecupo tiene evidencia unitaria sintética, no reproducción PostgreSQL válida.

---

## Dependencies & execution order

| Phase | Prerequisite | Independent outcome |
|---|---|---|
| Setup | None | Synthetic reusable fixtures |
| Foundation | T001 | Persistent one-unit invariant and common passport lock |
| US1 | T002–T005 | Book and recover one waiting/reserved first match without custody |
| US2 | US1 booking/query | Correct/release that match; guard Feature 008 revisions |
| US3 | Existing Feature 005–007 flows; foundation for integrated delivery | Direct manual custody navigation; may proceed in parallel with US1/US2 |
| US4 | US1 match/lock; US2 correction for race verification | Trusted confirmed-load boundary; may be designed in parallel with US3 |
| Cross-cutting | Relevant story implementations | Concurrency, privacy and six-reference evidence |

Within a story, write its focused tests first, then complete persistence/application work before endpoints and UI. T019 must use the same lock as T008/T017/T028; T030 verifies that integration. T028 exposes only a future-owner integration port, not a fake Analyst workflow.

## Parallel examples

- **US1**: T006 and T007 target different test files; T010 can proceed after foundation while backend T008–T009 is built. T012 follows the client contract and T011 route integration.
- **US2**: T014, T015 and T016 are separate test files; T019 (Feature 008 guard) and T020 (waiting UI) may proceed after their shared prerequisites without editing the same files.
- **US3**: T022 and T023 are independent test files; T024 approval navigation and T025 activation navigation touch different routes and may proceed in parallel after those tests.
- **US4**: T026 and T027 are independent test files; T029 frontend handoff can be prepared against the contract while T028 internal backend port is built.
- **Cross-cutting**: T030, T031 and T032 use separate verification files and can run in parallel after applicable story work.

## Implementation strategy

1. Complete Setup and Foundation, then US1 as the smallest independently testable MVP: invitation → form → durable `WAITING/RESERVED` state.
2. Add US2 to make the booking correctable and protect allowance revisions; complete US3 independently as navigation to existing manual custody.
3. Add US4 as an internal confirmed-load boundary, without Analyst entry, then perform focused integrated verification. The six approved images guide UI verification but do not change authorization or allowance rules.
