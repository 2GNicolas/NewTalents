# Research: First Match Passport Flow

**Base**: `specs/009-first-match-flow/spec.md`, constitution 2.0.0, current Feature 005–008 contracts and repository implementation. The owner approved planning Feature 009 against the current Feature 008 contracts on 2026-10-13; this does not change Feature 008's formal draft label.

## R1 — Period and allowance source of truth

- **Decision**: Reuse `resolveAllowancePeriod` and the Colombia date/anniversary rules from `apps/backend/src/passport-match-allowance/`. Determine a match's bucket from its match date and the effective revision, not from the date it was booked or loaded. Evaluate the finite set of existing reserved/used match dates against a proposed revision before confirming an allowance change.
- **Rationale**: Feature 008 defines `[start, endExclusive)` periods, pending changes at the next current-period boundary, and cadence re-anchoring. Its query currently knows no matches or usage. Recomputing grouping at a revision boundary preserves match dates and unit identities while correctly testing changed cadence.
- **Alternatives considered**: Store mutable counters per period (risk of drift and double counting); freeze an old period ID on the match (would not test proposed cadence correctly).

## R2 — One serializing boundary per passport

- **Decision**: Use the existing Feature 008 serializable transaction and `PlayerPassport` row lock as the common boundary for booking, rescheduling, cancellation, valid-load transition, and allowance confirmation. Within that boundary, recheck authorization/state, resolve current or proposed periods, count reserved plus used units, and commit all changes together. Keep bounded serialization retries and re-read after conflict.
- **Rationale**: `allowance-transaction.runner.ts` already locks the passport row for allowance writes. The same order prevents last-slot overbooking and a revision racing a reservation. A DB uniqueness constraint on the current first match per passport and unique intent keys adds defense in depth.
- **Alternatives considered**: Read-then-write outside a transaction (overbooking); a separate global lock (unnecessary cross-passport contention); cached usage counters (extra invariant to maintain).

## R3 — Unit state and match lifecycle

- **Decision**: Represent one allowance unit per first match with exclusive states `RESERVED`, `USED`, or `RELEASED`. Booking creates `RESERVED`; a valid Analyst load changes that same unit to `USED`; pre-load cancellation changes it to `RELEASED`. Rescheduling changes the date/bucket of the `RESERVED` unit without creating another match or unit. Preserve canceled match history while allowing another first-match booking; after `USED`, this flow never restores the invitation.
- **Rationale**: A single match-owned unit makes `reserved + used` counting and exactly-once transitions explicit. It also keeps the Feature 008 aggregate free of utilization storage, consistent with its current contract.
- **Alternatives considered**: A new reservation on every reschedule (duplication risk); releasing at the end of waiting (violates approved accounting); deleting canceled rows (loses traceability).

## R4 — Analyst load boundary

- **Decision**: Define a trusted internal completion operation for a confirmed load of this exact match, carrying match ID, authorized Analyst identity, and stable load ID. The future Analyst data-entry owner invokes it at the confirmed persistence boundary. In the same atomic boundary, revalidate current custody/role, move `RESERVED` to `USED`, and end waiting. Invalid or duplicate signals make no additional transition. Do not expose this as a client-callable booking endpoint or implement Analyst entry here.
- **Rationale**: Feature 007 revokes Analyst access immediately on custody/role/identity change. An untrusted client event or timer cannot end waiting safely.
- **Alternatives considered**: Administrator approval or time-based exit (unapproved); treating an attempted upload as completion (can falsely consume a unit).

## R5 — Navigation and visual composition

- **Decision**: Add a dedicated first-match route beneath the passport identity shell but outside the passport presentation/menu component, with invitation, form, and waiting substates. Use the six PNGs in `docs/design/feature-009/` for desktop/mobile hierarchy. Place the later-approved secondary `Reagendar` and `Cancelar partido` actions below waiting details. On a completed passport-producing approval or explicit activation, route the Administrator to the existing custody detail for that passport; the Administrator still chooses and confirms assignment.
- **Rationale**: Existing Expo Router routes already expose custody detail and passport identity shell. The PNG copy and sample allowance numbers are illustrative, not authorization or data rules.
- **Compatibility note**: Feature 005's frontend contract sends an active passport to `Resumen` by default. Feature 009's owner-approved journey supersedes that default only for an authorized `ACTIVE` passport still in invitation or first-match waiting state; once loaded, return to the permitted passport presentation. Feature 008's Administrator configuration section remains configuration-only; its illustrative usage counts are not activated by this flow.
- **Alternatives considered**: Reuse the analyzed-matches passport section (would show the menu and wrong state); auto-assign an Analyst (contradicts Feature 007/manual custody).

## R6 — Authorization and response safety

- **Decision**: Reuse Feature 005 responsibility/membership facts, Feature 006 final approval result, Feature 007 custody authorization, and Feature 008 Administrator allowance capability. Every command rechecks authority inside its transaction. A direct passport ID that is missing or unauthorized returns the same safe outcome; list/state projections expose only permitted first-match details and computed allowance availability.
- **Rationale**: UI visibility and role labels are not authority under the constitution and existing contracts. Scheduling remains permitted without Analyst custody; only the load boundary requires valid custody.
- **Alternatives considered**: Frontend-only gating; requiring custody to book; exposing Analyst or civil identity in the waiting response.
