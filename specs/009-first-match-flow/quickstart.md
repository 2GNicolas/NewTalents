# Quickstart validation: First Match Passport Flow

This is a Phase 1 validation guide, not evidence that Feature 009 is implemented. Use it after implementation, against the contracts in this directory. Do not seed real personal data.

## Prerequisites and commands

1. Use Node 24 / npm 10 and the repository's normal local PostgreSQL test setup. Start from a test database with the Feature 005–008 migrations and then the planned Feature 009 migration applied. Use authorized synthetic USER/representative, ACADEMY_USER, Administrator and Analyst fixtures; include an active passport with and without custody.
2. From repository root, run:

   ```powershell
   npm run verify:toolchain
   npm run typecheck
   npm run test:backend:contract
   npm run test:backend:integration
   npm run test:frontend
   ```

3. For visual review, run `npm run dev:frontend:web` and the relevant `npm run dev:frontend:android` or `npm run dev:frontend:ios` in a configured local environment. Compare desktop/mobile at invitation, form and waiting against all six paths in `contracts/first-match-ui.md`. These are validation commands, not a new test suite or an instruction to run them during planning.

## Scenario matrix

| Scenario / spec | Action | Expected result |
|---|---|---|
| US1.1, FR-001–004 | Open an `ACTIVE` passport with no current first match as each permitted responsible actor; try a non-active/unauthorized passport | Full-screen invitation without menu only for allowed actor; safe denial otherwise |
| US1.2–4, FR-005–008 | Choose a valid match date/time and details with one available unit, including a passport without Analyst; submit twice with same key | Exactly one `WAITING` match and one `RESERVED` unit in Feature 008 date period; no Analyst access granted |
| US1.5, FR-006–007 | Try missing rule, invalid date/fields, full period, stale availability and denied direct ID | No match or unit; safe field/capacity message; no protected data leak |
| US2.1–2, FR-009 | Reschedule across periods and within one full period, then try an unconfigured date or invalid fields | Same match/unit moves once on success; failure retains original date/details/unit/version |
| US2.3–5, FR-010 | Cancel before load; repeat same key and distinct stale key; inspect desktop/mobile waiting controls | Unit released once, invitation restored if eligible; secondary actions below details; form discard is separate |
| US2.4, FR-007–008 | Race two bookings for last slot and same-passport repeat; race reschedule versus cancel/load | One coherent winner, no overbooking, no duplicate unit or used-and-released match |
| US2.6, FR-018 | With valid first-match rows, propose a lower positive limit or cadence change for one RESERVED or USED unit; separately exercise synthetic mixed-unit overfill in a focused guard unit test | Accepted proposal preserves match/unit and Feature 008 boundaries; synthetic guard rejects overfill before a revision write. No PostgreSQL overfill is claimed for this model |
| US3.1–4, FR-014–015 | Finalize passport-producing approval, retry pending deletion, explicitly activate; open/cancel custody selection | Only completed `ACTIVE` result navigates to correct existing custody detail; no automatic assignment; prior decision remains committed |
| US4.1–3, FR-011–013 | Reload/log out/change device while waiting; confirm valid load; send duplicate, foreign, failed, revoked-custody signals | Waiting persists until valid load; same unit becomes `USED` exactly once and availability stays consumed; invalid signals do not end waiting or expose private data |

## Boundary dates and projection checks

- Test match dates immediately before/on a period boundary; end is exclusive. Include monthly anchors on 29/30/31, February leap/non-leap, and a cadence change effective at the next Feature 008 boundary. Use `America/Bogota` day, not device locale, to choose the effective revision.
- Inspect computed availability before scheduling, after reservation, after same/cross-period reschedule, after pre-load cancellation, and after valid load: `limit - reserved - used` must never treat `USED` as newly available.
- Confirm a proposed allowance change groups unchanged booked dates under proposed future periods, while current/earlier periods and revision/idempotency behavior remain Feature 008-compatible.
- The current first-match model allows only one `WAITING` or `LOADED` match per passport, while Feature 008's limit is at least one. PostgreSQL checks with valid rows therefore cannot reproduce a second counted first match filling a destination or mixed `RESERVED + USED` overfill; keep those guard branches under explicitly labeled synthetic unit coverage, without relaxing constraints or claiming database reproduction.
- Inspect public/responsible projections and error bodies for civil identity, evidence, internal Analyst data, and unpublished sporting metrics. None should be present.
- Inspect the authorized audit trail for actor, instant, booking/reschedule/cancellation and `RESERVED → USED` transitions without exposing those private fields in responsible or public responses.

## Cross-platform visual checks

- Desktop: `docs/design/feature-009/first-match-invitation-desktop.png`, `first-match-scheduling-desktop.png`, `first-match-waiting-desktop.png` in the same directory.
- Mobile: corresponding `*-mobile.png` files in that directory.
- Confirm full-screen composition with no passport menu, desktop two-column vs mobile stacked form, persistent waiting details, and the separately approved secondary actions below details on both variants. Check keyboard, screen reader, safe area, errors/loading/retry and no clipped controls.
- For SC-001, time authorized web/mobile participants through invitation and successful scheduling; at least 90% should finish within three minutes without using the passport menu.
